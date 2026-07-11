#!/usr/bin/env python3
"""Audit ASI identifier masking and electricity-variable continuity.

Only disclosure-safe aggregate diagnostics are written to outputs. The script
never writes factory identifiers or row-level values outside the restricted raw
archives.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd


ARCHIVE_RE = re.compile(r"ASI_DATA_(\d{4})_(\d{2})_CSV\.zip$", re.IGNORECASE)


def normalized_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def pick_column(
    columns: list[str], exact: tuple[str, ...], contains: tuple[str, ...] = ()
) -> str | None:
    normalized = {column: normalized_name(column) for column in columns}
    for target in exact:
        for column, name in normalized.items():
            if name == target:
                return column
    for target in contains:
        for column, name in normalized.items():
            if target in name:
                return column
    return None


def choose_member(members: list[str], block: str, year: int) -> str:
    csv_members = [name for name in members if name.lower().endswith(".csv")]

    def basename(name: str) -> str:
        return Path(name).name.lower()

    if block == "H" and year == 2000:
        h1 = [name for name in csv_members if re.match(r"^h1[-_ ]", basename(name))]
        if len(h1) == 1:
            return h1[0]

    patterns = {
        "A": r"^(blka|block[-_ ]?a|a[-_ ])",
        "B": r"^(blkb|block[-_ ]?b|b[-_ ])",
        "H": r"^(blkh|block[-_ ]?h|h[-_ ])",
    }
    candidates = [name for name in csv_members if re.match(patterns[block], basename(name))]
    if len(candidates) != 1:
        raise ValueError(f"Expected one Block {block} file, found {candidates}")
    return candidates[0]


def read_member(archive: zipfile.ZipFile, member: str) -> pd.DataFrame:
    with archive.open(member) as file:
        return pd.read_csv(file, low_memory=False, encoding_errors="replace")


def string_values(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.strip()
        .str.replace(r"\.0+$", "", regex=True)
        .replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "<NA>": pd.NA})
    )


def identifier_summary(series: pd.Series | None, prefix: str) -> dict:
    if series is None:
        return {
            f"{prefix}_column": None,
            f"{prefix}_unique": None,
            f"{prefix}_missing_share": None,
            f"{prefix}_masked_share": None,
            f"{prefix}_top_share": None,
        }
    values = string_values(series)
    valid = values.dropna()
    if valid.empty:
        return {
            f"{prefix}_column": series.name,
            f"{prefix}_unique": 0,
            f"{prefix}_missing_share": 1.0,
            f"{prefix}_masked_share": 0.0,
            f"{prefix}_top_share": None,
        }
    masked = valid.str.fullmatch(r"9+") | valid.isin({"0", "00", "00000"})
    return {
        f"{prefix}_column": series.name,
        f"{prefix}_unique": int(valid.nunique()),
        f"{prefix}_missing_share": float(values.isna().mean()),
        f"{prefix}_masked_share": float(masked.mean()),
        f"{prefix}_top_share": float(valid.value_counts(normalize=True).iloc[0]),
    }


def numeric(series: pd.Series | None) -> pd.Series:
    if series is None:
        return pd.Series(dtype="float64")
    return pd.to_numeric(series, errors="coerce")


def code_values(series: pd.Series | None) -> pd.Series:
    if series is None:
        return pd.Series(dtype="string")
    return string_values(series).str.replace(r"\s+", "", regex=True)


def finite_or_none(value: float) -> float | None:
    return float(value) if math.isfinite(value) else None


def power_mask(
    frame: pd.DataFrame,
    year: int,
    kind: str,
    serial_col: str | None,
    code_col: str | None,
    unit_col: str | None,
) -> pd.Series:
    index = frame.index
    serial_text = string_values(frame[serial_col]) if serial_col else pd.Series(pd.NA, index=index)
    serial_number = pd.to_numeric(serial_text, errors="coerce")
    description = serial_text.str.lower().fillna("")
    codes = code_values(frame[code_col]) if code_col else pd.Series(pd.NA, index=index)
    units = string_values(frame[unit_col]).str.upper() if unit_col else pd.Series(pd.NA, index=index)

    if kind == "own":
        mask = description.str.contains("electricity own", na=False) | codes.isin(
            {"99904", "9990400"}
        )
        if year == 2000:
            mask |= serial_number.eq(1)
        return mask

    if kind == "purchased":
        mask = description.str.contains("electricity purchased", na=False) | codes.isin(
            {"99905", "9990500"}
        )
        if year == 2000:
            mask |= serial_number.eq(2)
        return mask

    mask = description.str.contains("unmet demand|additional requirement", regex=True, na=False)
    mask |= codes.eq("9999999")
    if not mask.any() and year == 2002:
        blank_code = codes.isna() | codes.isin({"0", "00", "00000"})
        mask |= serial_number.eq(18) & blank_code
    elif not mask.any() and 2003 <= year <= 2007:
        blank_code = codes.isna() | codes.isin({"0", "00", "00000"})
        mask |= serial_number.eq(23) & blank_code
    elif not mask.any() and 2010 <= year <= 2013:
        blank_code = codes.isna() | codes.isin({"0", "00", "00000"})
        mask |= serial_number.eq(24) & blank_code
    return mask


def aggregate_power(
    frame: pd.DataFrame,
    mask: pd.Series,
    kind: str,
    dsl_col: str,
    quantity_col: str,
    value_col: str | None,
) -> pd.DataFrame:
    selected = frame.loc[mask, [dsl_col, quantity_col] + ([value_col] if value_col else [])].copy()
    selected["dsl_key"] = string_values(selected[dsl_col])
    selected["quantity"] = numeric(selected[quantity_col])
    selected["value"] = numeric(selected[value_col]) if value_col else np.nan
    grouped = selected.groupby("dsl_key", dropna=True, as_index=False).agg(
        quantity=("quantity", "sum"), value=("value", "sum")
    )
    grouped["kind"] = kind
    return grouped


def audit_archive(path: Path) -> dict:
    match = ARCHIVE_RE.search(path.name)
    if not match:
        raise ValueError(f"Could not parse year from {path.name}")
    year = int(match.group(1))

    with zipfile.ZipFile(path) as archive:
        a_name = choose_member(archive.namelist(), "A", year)
        b_name = choose_member(archive.namelist(), "B", year)
        h_name = choose_member(archive.namelist(), "H", year)
        a = read_member(archive, a_name)
        b = read_member(archive, b_name)
        h = read_member(archive, h_name)

    a_columns = list(a.columns)
    b_columns = list(b.columns)
    h_columns = list(h.columns)

    a_dsl = pick_column(a_columns, ("dsl", "a1"), ("dispatchserial", "despatchserial"))
    psl = pick_column(a_columns, ("psl", "a2", "aitm2"))
    state = pick_column(a_columns, ("state", "statecode", "statecd", "a7", "aitm7"))
    weight = pick_column(a_columns, ("wgt", "weight", "mult", "multiplier", "multilplier"), ("mult",))
    status = pick_column(a_columns, ("statusunit", "a12", "aitm12"), ("status",))
    industry = pick_column(
        a_columns,
        ("inc5digit", "nic5digit", "indcd", "indcdreturn", "a5", "aitm5"),
        ("nic", "inc5"),
    )
    district = pick_column(
        a_columns, ("district", "districtcode", "districtcd", "a8", "aitm8")
    )
    cin = pick_column(b_columns, ("cin", "b03"), ("corporateidentification",))

    if a_dsl is None:
        raise ValueError(f"DSL column not found in {path.name}: {a_columns}")

    state_text = string_values(a[state]) if state else pd.Series(pd.NA, index=a.index)
    state_numeric = pd.to_numeric(state_text, errors="coerce")
    is_tn = state_numeric.eq(33) | state_text.str.lower().str.replace(
        r"[^a-z]", "", regex=True
    ).eq("tamilnadu")
    a_work = pd.DataFrame(
        {
            "dsl_key": string_values(a[a_dsl]),
            "state": state_numeric,
            "is_tn": is_tn.fillna(False),
            "weight": numeric(a[weight]).fillna(1.0) if weight else 1.0,
            "status": numeric(a[status]) if status else np.nan,
        }
    ).drop_duplicates("dsl_key")

    h_dsl = pick_column(h_columns, ("dsl", "ah01"), ("dispatchserial", "despatchserial"))
    serial = pick_column(
        h_columns, ("sno", "sino", "hi1", "h11", "hitm1", "hitm01", "hitm1")
    )
    item_code = pick_column(h_columns, ("itemcode", "item", "hi3", "h13", "hitm3"))
    unit = pick_column(
        h_columns, ("unitcode", "unitofqty", "uom", "hi4", "h14", "hitm4")
    )
    if year == 2000 and normalized_name(h_name).find("h1") >= 0:
        quantity = pick_column(h_columns, ("hitm4",))
        value = pick_column(h_columns, ("hitm5",))
        item_code = None
        unit = None
    else:
        quantity = pick_column(
            h_columns, ("qtycons", "qtyconsumed", "hi5", "h15", "hitm5")
        )
        value = pick_column(
            h_columns,
            ("purchasevalue", "purchaseval", "purval", "hi6", "h16", "hitm6"),
        )

    if h_dsl is None or serial is None or quantity is None:
        raise ValueError(
            f"Power columns not found in {path.name}: "
            f"dsl={h_dsl}, serial={serial}, quantity={quantity}, columns={h_columns}"
        )

    masks = {
        kind: power_mask(h, year, kind, serial, item_code, unit)
        for kind in ("own", "purchased", "unmet")
    }
    power = {
        kind: aggregate_power(h, mask, kind, h_dsl, quantity, value)
        for kind, mask in masks.items()
    }
    merged = {
        kind: values.merge(a_work, on="dsl_key", how="left")
        for kind, values in power.items()
    }

    purchased = merged["purchased"]
    valid_price = purchased[(purchased["quantity"] > 0) & (purchased["value"] >= 0)].copy()
    valid_price["realized_cost"] = valid_price["value"] / valid_price["quantity"]
    valid_price = valid_price.replace([np.inf, -np.inf], np.nan).dropna(subset=["realized_cost"])
    valid_price = valid_price[
        (valid_price["realized_cost"] >= 0) & (valid_price["realized_cost"] <= 1000)
    ]

    own_weighted = float((merged["own"]["quantity"].fillna(0) * merged["own"]["weight"].fillna(1)).sum())
    purchased_weighted = float(
        (purchased["quantity"].fillna(0) * purchased["weight"].fillna(1)).sum()
    )
    denominator = own_weighted + purchased_weighted
    unmet = merged["unmet"]
    tn_unmet = unmet[unmet["is_tn"]]
    tn_purchased = purchased[purchased["is_tn"]]

    result = {
        "year": year,
        "archive": path.name,
        "a_file": a_name,
        "b_file": b_name,
        "h_file": h_name,
        "a_rows": int(len(a)),
        "dsl_unique": int(string_values(a[a_dsl]).nunique()),
        "state_column": state,
        "district_column": district,
        "industry_column": industry,
        "weight_column": weight,
        "status_column": status,
        **identifier_summary(a[psl] if psl else None, "psl"),
        **identifier_summary(b[cin] if cin else None, "cin"),
        "h_rows": int(len(h)),
        "h_factories": int(string_values(h[h_dsl]).nunique()),
        "own_rows": int(len(power["own"])),
        "own_positive_rows": int((power["own"]["quantity"] > 0).sum()),
        "purchased_rows": int(len(purchased)),
        "purchased_positive_rows": int((purchased["quantity"] > 0).sum()),
        "unmet_rows": int(len(unmet)),
        "unmet_positive_rows": int((unmet["quantity"] > 0).sum()),
        "unmet_row_share_of_h_factories": finite_or_none(
            len(unmet) / string_values(h[h_dsl]).nunique()
            if string_values(h[h_dsl]).nunique()
            else float("nan")
        ),
        "unmet_weighted_positive_factories": finite_or_none(
            float(unmet.loc[unmet["quantity"] > 0, "weight"].fillna(1).sum())
        ),
        "tn_purchased_rows": int(len(tn_purchased)),
        "tn_unmet_rows": int(len(tn_unmet)),
        "tn_unmet_positive_rows": int((tn_unmet["quantity"] > 0).sum()),
        "self_generation_share_weighted_kwh": finite_or_none(
            own_weighted / denominator if denominator > 0 else float("nan")
        ),
        "realized_cost_median": finite_or_none(valid_price["realized_cost"].median()),
        "realized_cost_p01": finite_or_none(valid_price["realized_cost"].quantile(0.01)),
        "realized_cost_p99": finite_or_none(valid_price["realized_cost"].quantile(0.99)),
    }
    return result


def markdown_table(frame: pd.DataFrame, columns: list[str]) -> str:
    display = frame[columns].copy()
    for column in display.columns:
        if pd.api.types.is_float_dtype(display[column]):
            display[column] = display[column].map(
                lambda value: "" if pd.isna(value) else f"{value:.4g}"
            )
    header = "| " + " | ".join(display.columns) + " |"
    divider = "| " + " | ".join(["---"] * len(display.columns)) + " |"
    rows = [
        "| " + " | ".join(str(value) for value in row) + " |"
        for row in display.itertuples(index=False, name=None)
    ]
    return "\n".join([header, divider, *rows])


def write_report(frame: pd.DataFrame, destination: Path) -> None:
    complete_masking = frame["psl_masked_share"].fillna(0).eq(1)
    psl_absent = frame["psl_column"].isna()
    no_cin = frame["cin_column"].isna() | frame["cin_masked_share"].fillna(0).eq(1)
    power_columns = [
        "year",
        "purchased_rows",
        "unmet_rows",
        "unmet_positive_rows",
        "tn_unmet_positive_rows",
        "unmet_row_share_of_h_factories",
        "realized_cost_median",
        "realized_cost_p01",
        "realized_cost_p99",
    ]
    identifier_columns = [
        "year",
        "a_rows",
        "dsl_unique",
        "psl_column",
        "psl_unique",
        "psl_masked_share",
        "cin_column",
        "cin_unique",
        "cin_masked_share",
    ]
    absent_unmet_years = ", ".join(
        str(int(year)) for year in frame.loc[frame["unmet_rows"].eq(0), "year"]
    )
    near_complete_years = ", ".join(
        str(int(year))
        for year in frame.loc[frame["unmet_row_share_of_h_factories"].ge(0.9), "year"]
    )
    lines = [
        "# ASI Identifier and Electricity Audit",
        "",
        "This report contains disclosure-safe aggregate diagnostics only.",
        "",
        "## Identifier finding",
        "",
        f"Permanent serial numbers are completely masked in {int(complete_masking.sum())} "
        f"vintages and omitted in {int(psl_absent.sum())} vintages. A usable corporate identifier is absent or "
        f"completely masked in {int(no_cin.sum())} vintages.",
        "",
        markdown_table(frame, identifier_columns),
        "",
        "## Electricity finding",
        "",
        "The unmet-demand item is evaluated by its official description/code, not by "
        "serial number alone. Historical schedules changed, and additional-sheet raw "
        "materials can reuse serial numbers above the printed form.",
        "",
        f"The unmet-demand row is absent in start-years {absent_unmet_years}. It is "
        f"near-universally present only in {near_complete_years}; surrounding years "
        "mostly contain sparse positive-only or unexplained zero records. In 2023-24, "
        "only seven national rows appear and all report zero quantity. This is not a "
        "credible longitudinal reliability series.",
        "",
        markdown_table(frame, power_columns),
        "",
        "## Interpretation rules",
        "",
        "- A masked PSL/CIN cannot support a longitudinal factory panel.",
        "- Missing unmet-demand rows are not treated as zero without documentation.",
        "- Realized electricity cost is purchase expenditure divided by recorded kWh; "
        "it is not a tariff and is not composition-adjusted.",
        "- Self-generation is descriptive and does not by itself identify grid unreliability.",
        "- Verdict: reject a historical unmet-power dashboard. Purchased-electricity "
        "cost can be studied separately only after sector/composition adjustment and "
        "outlier controls.",
    ]
    destination.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=Path("data/asi_raw"))
    parser.add_argument("--output-dir", type=Path, default=Path("outputs"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    archives = sorted(
        path for path in args.input_dir.glob("ASI_DATA_*_CSV.zip") if ARCHIVE_RE.search(path.name)
    )
    if not archives:
        raise SystemExit("No ASI CSV archives found")

    results = []
    for index, archive in enumerate(archives, start=1):
        print(f"[{index}/{len(archives)}] auditing {archive.name}", flush=True)
        results.append(audit_archive(archive))

    frame = pd.DataFrame(results).sort_values("year")
    frame.to_csv(args.output_dir / "asi_methodology_audit.csv", index=False)
    (args.output_dir / "asi_methodology_audit.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )
    write_report(frame, args.output_dir / "asi_methodology_audit.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
