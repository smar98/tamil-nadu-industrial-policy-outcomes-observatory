#!/usr/bin/env python3
"""Build disclosure-safe ASI outcome panels for the policy observatory.

The restricted unit records remain under data/asi_raw. Only weighted aggregates
and cell-quality diagnostics are written to outputs.
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


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "asi_raw"
SECTORS_PATH = ROOT / "data" / "asi_sector_definitions.json"
OUTPUT_JSON = ROOT / "outputs" / "asi_policy_outcomes.json"
OUTPUT_CSV = ROOT / "outputs" / "asi_policy_outcomes.csv"
ARCHIVE_RE = re.compile(r"ASI_DATA_(\d{4})_(\d{2})_CSV\.zip$", re.IGNORECASE)
TN_CODE = "33"


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


def numeric(series: pd.Series | None, index: pd.Index | None = None) -> pd.Series:
    if series is None:
        return pd.Series(0.0, index=index, dtype="float64")
    return pd.to_numeric(series, errors="coerce").fillna(0.0)


def string_values(series: pd.Series | None, index: pd.Index | None = None) -> pd.Series:
    if series is None:
        return pd.Series(pd.NA, index=index, dtype="string")
    return (
        series.astype("string")
        .str.strip()
        .str.replace(r"\.0+$", "", regex=True)
        .replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "<NA>": pd.NA})
    )


def choose_member(members: list[str], block: str) -> str:
    candidates = []
    pattern = re.compile(
        rf"^(?:blk|block[-_ ]*)?{block.lower()}(?:[-_ .]|\d|$)", re.IGNORECASE
    )
    for member in members:
        if not member.lower().endswith(".csv"):
            continue
        if pattern.match(Path(member).name):
            candidates.append(member)
    if len(candidates) != 1:
        raise ValueError(f"Expected one Block {block}; found {candidates}")
    return candidates[0]


def read_block(archive: zipfile.ZipFile, block: str) -> pd.DataFrame:
    member = choose_member(archive.namelist(), block)
    with archive.open(member) as handle:
        return pd.read_csv(handle, low_memory=False, encoding_errors="replace")


def dsl_column(frame: pd.DataFrame, block: str) -> str:
    result = pick_column(
        list(frame.columns),
        ("dsl", f"a{block.lower()}01", f"{block.lower()}01", "a1"),
        ("dispatchserial", "despatchserial"),
    )
    if result is None:
        raise ValueError(f"DSL missing in block {block}: {list(frame.columns)}")
    return result


def base_index(frame: pd.DataFrame, block: str) -> pd.Series:
    return string_values(frame[dsl_column(frame, block)])


def select_total_row(
    frame: pd.DataFrame,
    block: str,
    serials: set[int],
    codes: set[str] | None = None,
) -> pd.DataFrame:
    serial_col = pick_column(
        list(frame.columns),
        (
            f"{block.lower()}i1",
            f"{block.lower()}itm1",
            f"{block.lower()}11",
            "sno",
            "sno1",
            "snoo",
            "slno",
        ),
        ("serial",),
    )
    if serial_col is None:
        serial_col = pick_column(list(frame.columns), ("c11", "di1", "ei1", "hi1", "ii1", "j11"))
    serial = pd.to_numeric(frame[serial_col], errors="coerce") if serial_col else pd.Series(np.nan, index=frame.index)
    mask = serial.isin(serials)
    if codes:
        code_col = pick_column(
            list(frame.columns),
            (
                "itemcode",
                f"{block.lower()}i3",
                f"{block.lower()}itm3",
                f"{block.lower()}13",
                "item",
            ),
        )
        if code_col:
            code = string_values(frame[code_col]).str.replace(r"\s+", "", regex=True)
            mask |= code.isin(codes)
    return frame.loc[mask].copy()


def series_from_rows(
    frame: pd.DataFrame,
    block: str,
    serials: set[int],
    value_candidates: tuple[str, ...],
    name: str,
    codes: set[str] | None = None,
) -> pd.DataFrame:
    rows = select_total_row(frame, block, serials, codes)
    value_col = pick_column(list(rows.columns), value_candidates)
    if value_col is None:
        return pd.DataFrame(columns=["dsl", name])
    output = pd.DataFrame(
        {"dsl": base_index(rows, block), name: numeric(rows[value_col])}
    )
    return output.groupby("dsl", as_index=False)[name].sum()


def one_row_values(
    frame: pd.DataFrame,
    block: str,
    definitions: dict[str, tuple[tuple[str, ...], tuple[str, ...]]],
) -> pd.DataFrame:
    output = pd.DataFrame({"dsl": base_index(frame, block)})
    for name, (exact, contains) in definitions.items():
        column = pick_column(list(frame.columns), exact, contains)
        output[name] = numeric(frame[column], frame.index) if column else 0.0
    return output.groupby("dsl", as_index=False).sum(numeric_only=True)


def employment_values(frame: pd.DataFrame, year: int) -> pd.DataFrame:
    serial_col = pick_column(list(frame.columns), ("eitm1", "ei1", "e11", "sno", "snoo"))
    avg_col = pick_column(
        list(frame.columns),
        ("eitm6", "ei6", "e16", "avgpersonwork", "avenumberpersonwork", "averagenumberpersonsworked"),
        ("avgperson", "avgnoofpersons", "avenumber"),
    )
    wage_col = pick_column(
        list(frame.columns),
        ("eitm8", "ei8", "e18", "wages", "wagessalariesrs"),
        ("wage",),
    )
    work = pd.DataFrame(
        {
            "dsl": base_index(frame, "E"),
            "serial": pd.to_numeric(frame[serial_col], errors="coerce"),
            "persons": numeric(frame[avg_col]),
            "wages": numeric(frame[wage_col]),
        }
    )
    if year >= 2023:
        metrics = {
            "male_direct_workers": 1,
            "female_direct_workers": 2,
            "other_direct_workers": 3,
            "contract_workers": 5,
            "workers": 6,
            "supervisory_workers": 7,
            "employees": 10,
        }
        total_row = 10
    else:
        metrics = {
            "male_direct_workers": 1,
            "female_direct_workers": 2,
            "contract_workers": 4,
            "workers": 5,
            "supervisory_workers": 6,
            "employees": 9,
        }
        total_row = 9
    pieces = []
    for name, serial in metrics.items():
        part = work.loc[work["serial"].eq(serial), ["dsl", "persons"]]
        part = part.groupby("dsl", as_index=False)["persons"].sum().rename(columns={"persons": name})
        pieces.append(part)
    wages = work.loc[work["serial"].eq(total_row), ["dsl", "wages"]]
    wages = wages.groupby("dsl", as_index=False)["wages"].sum()
    output = pieces[0]
    for part in [*pieces[1:], wages]:
        output = output.merge(part, on="dsl", how="outer")
    if "other_direct_workers" not in output:
        output["other_direct_workers"] = 0.0
    return output.fillna(0.0)


def fixed_asset_values(frame: pd.DataFrame) -> pd.DataFrame:
    rows = select_total_row(frame, "C", {10})
    definitions = {
        "revaluation": (("c14", "citm4", "revaluation", "gvalueaddduetorevaluation", "grossvalueaddduetoreval"), ("revaluation", "reval")),
        "depreciation": (("c19", "citm9", "provdyear", "depprovideduringtheyear"), ("provided", "depprovided")),
        "net_opening": (("c112", "citm12", "netvalop", "nvop", "nvo"), ("netvalueopening",)),
        "fixed_capital": (("c113", "citm13", "netvalcl", "nvcl", "nvc"), ("netvalueclosing",)),
    }
    output = pd.DataFrame({"dsl": base_index(rows, "C")})
    for name, (exact, contains) in definitions.items():
        column = pick_column(list(rows.columns), exact, contains)
        output[name] = numeric(rows[column], rows.index) if column else 0.0
    return output.groupby("dsl", as_index=False).sum(numeric_only=True)


def factory_base(a: pd.DataFrame, b: pd.DataFrame, year: int) -> pd.DataFrame:
    columns = list(a.columns)
    dsl = dsl_column(a, "A")
    state = pick_column(columns, ("statecode", "statecd", "a7", "aitm7"), ("state",))
    district = pick_column(columns, ("district", "districtcode", "districtcd", "a8", "aitm8"))
    nic = pick_column(
        columns,
        ("nic5digit", "inc5digit", "indcd", "indcdreturn", "a5", "aitm5"),
        ("nic5",),
    )
    rural = pick_column(columns, ("ruralurban", "ruralurbancd", "a9", "aitm9"), ("ruralurban",))
    status = pick_column(columns, ("statusofunit", "unitstatus", "a12", "aitm12"), ("status",))
    weight = pick_column(columns, ("wgt", "weight", "mult", "multiplier", "multilplier"), ("mult",))
    units = pick_column(columns, ("noofunits", "a11", "aitm11"), ("noofunit",))
    bonus = pick_column(columns, ("bonus", "eitm10"))
    pf = pick_column(columns, ("pf", "providentfund", "eitm11"), ("provident",))
    welfare_columns = [
        column
        for column in columns
        if normalized_name(column)
        in {"welfare", "eitm12", "workmenstaffwelfare"}
    ]
    export_share = pick_column(columns, ("expshare", "share", "jitm13"), ("expshare",))

    state_text = string_values(a[state]).str.zfill(2)
    nic_text = string_values(a[nic]).str.replace(r"\D", "", regex=True).str.zfill(5)
    result = pd.DataFrame(
        {
            "dsl": string_values(a[dsl]),
            "year": year,
            "state": state_text,
            "district": string_values(a[district]).str.zfill(2),
            "nic5": nic_text,
            "rural_urban": string_values(a[rural]),
            "status": pd.to_numeric(a[status], errors="coerce"),
            "weight": numeric(a[weight]).replace(0, 1.0) if weight else 1.0,
            "reported_units": numeric(a[units]).replace(0, 1.0) if units else 1.0,
            "bonus": numeric(a[bonus], a.index) if bonus else 0.0,
            "provident_fund": numeric(a[pf], a.index) if pf else 0.0,
            "welfare": (
                sum((numeric(a[column], a.index) for column in welfare_columns), start=pd.Series(0.0, index=a.index))
                if welfare_columns
                else 0.0
            ),
            "export_share": numeric(a[export_share], a.index) if export_share else 0.0,
        }
    )

    b_columns = list(b.columns)
    b_result = pd.DataFrame({"dsl": base_index(b, "B")})
    b_defs = {
        "initial_production_year": (("b05", "bitm7", "yearofinprod", "yrinitialproduction", "initprod"), ("initialprod", "yearofinprod")),
        "foreign_share": (("b08", "sharecap"), ("sharecapital",)),
        "rd_unit": (("b09", "randd"), ("randd",)),
        "formal_training": (("b11",), ("formaltraining",)),
    }
    for name, (exact, contains) in b_defs.items():
        column = pick_column(b_columns, exact, contains)
        b_result[name] = numeric(b[column], b.index) if column else np.nan
    b_result = b_result.drop_duplicates("dsl")
    return result.merge(b_result, on="dsl", how="left")


def build_factory_frame(archive_path: Path, year: int) -> pd.DataFrame:
    with zipfile.ZipFile(archive_path) as archive:
        a = read_block(archive, "A")
        b = read_block(archive, "B")
        base = factory_base(a, b, year)
        del a, b

        c = fixed_asset_values(read_block(archive, "C"))
        e = employment_values(read_block(archive, "E"), year)
        f = one_row_values(
            read_block(archive, "F"),
            "F",
            {
                "f1": (("f1", "fitm1", "workdoneby", "workdonebyothers"), ("workdone",)),
                "f2a": (("f2a", "fitm2a", "repmaintbldg", "repmaintbuildgotherconst"), ("repmaintb",)),
                "f2b": (("f2b", "fitm2b", "repmaintothfixedasset", "repmaintotherfixedassetsoperatin"), ("repmaintoth",)),
                "f3": (("f3", "fitm3", "opexpenses", "opertexp"), ("opexp", "operatingexp")),
                "f4": (("f4", "fitm4", "nonoperatingexp", "expensesonrowmaterials", "expensesonrawmaterial"), ("nonoperating", "expensesonraw")),
                "f5": (("f5", "fitm5", "insurancecharges", "inscharges"), ("insurance", "inscharges")),
                "f6": (("f6", "fitm6", "rentpaidpmfixedassets", "rentpaidplamachothfixasst"), ("rentpaidp",)),
                "f7_raw": (("f7", "fitm7", "exprd"), ("exprd", "researchdevelopment", "totalexpenses")),
                "f8": (("f8", "fitm8", "rentbldg", "rentpaidbuild"), ("rentbldg", "rentpaidbuild")),
                "f11": (("f11", "fitm11", "purvalgoods", "purchvalgoodssold"), ("purvalgoods", "purchasevalueofgoods")),
            },
        )
        f["rd_expense"] = f["f7_raw"] if year >= 2015 else 0.0
        g = one_row_values(
            read_block(archive, "G"),
            "G",
            {
                "g1": (("g1", "gitm1", "incomeserv", "recptmanufservices"), ("manufacturingservices", "manufservices")),
                "g2": (("g2", "gitm2", "varstsemifin", "recptnonmanufservices"), ("nonmanufservices", "varstsemi")),
                "g3": (("g3", "gitm3", "valelecgensold", "valueelecgeneratsold"), ("elec", "generatedsold")),
                "g4": (("g4", "gitm4", "valowncons", "valueownconst"), ("ownconst",)),
                "g6": (("g6", "gitm6", "rentrecpm", "rentrecplanmach"), ("rentrecp", "rentrecdforplant")),
                "g7": (("g7", "gitm7", "totreceipt", "varstoksemfingoods"), ("varstok", "varinstock")),
                "g8": (("g8", "gitm8", "rentbldg", "rentrecbldg"), ("rentbldg", "rentrecdforbuild")),
                "g11_raw": (("g11", "gitm11", "salevalgoods"), ("salevalgoods",)),
                "g12_raw": (("g12", "gitm12", "othersub", "totsub"), ("othersub", "totsub")),
            },
        )
        g["g11"] = g["g12_raw"] if year <= 2009 else g["g11_raw"]
        if year < 2015:
            # Before 2015 G2 was the semi-finished-stock variation and G7 a subtotal.
            g["g7"] = 0.0

        h = series_from_rows(
            read_block(archive, "H"),
            "H",
            {23},
            ("hi6", "hitm6", "h16", "purchasevalue", "purchaseval", "purval"),
            "indigenous_inputs",
            {"99930", "9993000"},
        )
        i = series_from_rows(
            read_block(archive, "I"),
            "I",
            {7},
            ("ii6", "iitm6", "i16", "purchasevalue", "purchvalue", "purchaseval", "purvaldel", "purval"),
            "direct_imports",
            {"99940", "9994000"},
        )
        j_frame = read_block(archive, "J")
        j_output = series_from_rows(
            j_frame,
            "J",
            {12},
            ("j113", "ji13", "jitm13", "exfactvalqtymanft", "exfactvaloutput"),
            "product_output",
            {"99950", "9995000"},
        )
        j_sales = series_from_rows(
            j_frame,
            "J",
            {12},
            ("j17", "ji7", "jitm7", "grosssalevalue", "grosssalval"),
            "gross_product_sales",
            {"99950", "9995000"},
        )

    frame = base
    for part in (c, e, f, g, h, i, j_output, j_sales):
        frame = frame.merge(part, on="dsl", how="left")
    value_columns = [
        column
        for column in frame.columns
        if column not in {"dsl", "state", "district", "nic5", "rural_urban"}
    ]
    for column in value_columns:
        frame[column] = numeric(frame[column], frame.index)

    if year < 2015:
        frame["total_input"] = (
            frame[["f1", "f2a", "f2b", "f3", "f4", "f5", "f6", "f11"]].sum(axis=1)
            + frame["indigenous_inputs"]
            + frame["direct_imports"]
        )
        frame["total_output"] = frame["product_output"] + frame[
            ["g1", "g2", "g3", "g4", "g6", "g11"]
        ].sum(axis=1)
    elif year < 2018:
        frame["total_input"] = (
            frame[["f1", "f2a", "f2b", "f3", "f4", "f6", "rd_expense", "f11"]].sum(axis=1)
            + frame["indigenous_inputs"]
            + frame["direct_imports"]
        )
        frame["total_output"] = frame["product_output"] + frame[
            ["g1", "g2", "g3", "g4", "g6", "g7", "g11"]
        ].sum(axis=1)
    else:
        frame["total_input"] = (
            frame[["f1", "f2a", "f2b", "f3", "f4", "f6", "rd_expense", "f8", "f11"]].sum(axis=1)
            + frame["indigenous_inputs"]
            + frame["direct_imports"]
        )
        frame["total_output"] = (
            frame["product_output"]
            + frame[["g1", "g2", "g3", "g4", "g6", "g7", "g8", "g11"]].sum(axis=1)
            + frame["rd_expense"]
        )
    frame["gva"] = frame["total_output"] - frame["total_input"]
    frame["emoluments"] = frame["wages"] + frame["bonus"]
    frame["compensation_employees"] = (
        frame["emoluments"] + frame["provident_fund"] + frame["welfare"]
    )
    frame["gfcf"] = (
        frame["fixed_capital"]
        - frame["net_opening"]
        - frame["revaluation"]
        + frame["depreciation"]
        + frame["rd_expense"].where(frame["year"].ge(2018), 0.0)
    )
    frame["direct_exports"] = frame["gross_product_sales"] * frame["export_share"].clip(0, 100) / 100.0
    frame["estimated_factories"] = frame["reported_units"]
    frame["young_factory"] = (
        frame["initial_production_year"].between(year - 4, year, inclusive="both")
    ).astype(float)
    return frame.loc[
        frame["status"].isin([1, 2, 3])
        & frame["nic5"].str[:2].isin([f"{value:02d}" for value in range(10, 39)])
    ].copy()


def sector_memberships(nic: str, sectors: list[dict]) -> list[str]:
    return [sector["id"] for sector in sectors if any(nic.startswith(prefix) for prefix in sector["prefixes"])]


SUM_COLUMNS = [
    "estimated_factories",
    "employees",
    "workers",
    "male_direct_workers",
    "female_direct_workers",
    "other_direct_workers",
    "contract_workers",
    "supervisory_workers",
    "wages",
    "emoluments",
    "compensation_employees",
    "fixed_capital",
    "gfcf",
    "total_input",
    "total_output",
    "gva",
    "direct_imports",
    "direct_exports",
    "rd_expense",
]


def aggregate_cell(group: pd.DataFrame) -> pd.Series:
    weight = group["weight"]
    output = {column: float((group[column] * weight).sum()) for column in SUM_COLUMNS}
    output["sample_factories"] = int(group["dsl"].nunique())
    output["effective_sample_size"] = float(weight.sum() ** 2 / (weight.pow(2).sum() or np.nan))
    output["young_factory_share"] = float((group["young_factory"] * weight).sum() / max(weight.sum(), 1e-12))
    output["foreign_factory_share"] = float((group["foreign_share"].eq(1) * weight).sum() / max(weight.sum(), 1e-12))
    output["rd_unit_share"] = float((group["rd_unit"].isin([1, 2]) * weight).sum() / max(weight.sum(), 1e-12))
    valid_training = group["formal_training"].isin([1, 2])
    output["training_factory_share"] = (
        float((group.loc[valid_training, "formal_training"].eq(1) * group.loc[valid_training, "weight"]).sum() / group.loc[valid_training, "weight"].sum())
        if valid_training.any()
        else math.nan
    )
    weighted_abs_gva = (group["gva"].abs() * weight)
    output["largest_gva_contributor_share"] = float(weighted_abs_gva.max() / weighted_abs_gva.sum()) if weighted_abs_gva.sum() else 0.0
    return pd.Series(output)


def add_ratios(frame: pd.DataFrame) -> pd.DataFrame:
    def ratio(numerator: str, denominator: str) -> pd.Series:
        result = frame[numerator] / frame[denominator].replace(0, np.nan)
        return result.replace([np.inf, -np.inf], np.nan)

    frame["gva_output_ratio"] = ratio("gva", "total_output")
    frame["gva_per_worker"] = ratio("gva", "employees")
    frame["emoluments_per_employee"] = ratio("emoluments", "employees")
    frame["labour_share_gva"] = ratio("compensation_employees", "gva")
    frame["contract_worker_share"] = ratio("contract_workers", "workers")
    frame["female_direct_worker_share"] = ratio("female_direct_workers", "male_direct_workers")
    frame["female_direct_worker_share"] = frame["female_direct_workers"] / (
        frame["female_direct_workers"]
        + frame["male_direct_workers"]
        + frame["other_direct_workers"]
    ).replace(0, np.nan)
    frame["import_input_share"] = ratio("direct_imports", "total_input")
    frame["direct_export_output_share"] = ratio("direct_exports", "total_output")
    frame["rd_gva_share"] = ratio("rd_expense", "gva")
    frame["stability"] = np.select(
        [
            (frame["sample_factories"] >= 30) & (frame["largest_gva_contributor_share"] <= 0.5),
            (frame["sample_factories"] >= 10) & (frame["largest_gva_contributor_share"] <= 0.7),
        ],
        ["high", "moderate"],
        default="suppress",
    )
    return frame


def aggregate_year(factory: pd.DataFrame, sectors: list[dict]) -> pd.DataFrame:
    long = factory.copy()
    long["sector_id"] = long["nic5"].map(lambda nic: sector_memberships(nic, sectors))
    long = long.explode("sector_id").dropna(subset=["sector_id"])
    grouped = (
        long.groupby(["year", "state", "sector_id"], dropna=False, sort=False)
        .apply(aggregate_cell, include_groups=False)
        .reset_index()
    )
    return add_ratios(grouped)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year", type=int, default=2008)
    parser.add_argument("--end-year", type=int, default=2023)
    args = parser.parse_args()

    sector_data = json.loads(SECTORS_PATH.read_text())
    sectors = sector_data["definitions"]
    outputs = []
    for archive_path in sorted(RAW_DIR.glob("ASI_DATA_*_CSV.zip")):
        match = ARCHIVE_RE.match(archive_path.name)
        if not match:
            continue
        year = int(match.group(1))
        if not args.start_year <= year <= args.end_year:
            continue
        print(f"Processing ASI {year}-{str(year + 1)[-2:]}")
        factory = build_factory_frame(archive_path, year)
        outputs.append(aggregate_year(factory, sectors))

    panel = pd.concat(outputs, ignore_index=True).sort_values(["sector_id", "state", "year"])
    panel["year_label"] = panel["year"].map(lambda year: f"{year}-{str(year + 1)[-2:]}")
    panel.to_csv(OUTPUT_CSV, index=False)

    public = panel.loc[panel["stability"].ne("suppress")].copy()
    records = json.loads(public.replace({np.nan: None}).to_json(orient="records"))
    metadata = {
        "title": "Annual Survey of Industries policy outcome aggregates",
        "coverage": f"{args.start_year}-{str(args.start_year + 1)[-2:]} to {args.end_year}-{str(args.end_year + 1)[-2:]}",
        "price_basis": "Current rupees. Monetary growth rates must not be described as real growth until deflators are applied.",
        "universe": "Registered factories and other establishments covered by ASI; not all manufacturing activity or employment.",
        "estimation": "Unit values are multiplied by the public-use multiplier. Ratios are ratios of weighted aggregate totals.",
        "uncertainty": "Exact MoSPI RSEs require public-use subsample identifiers that are not present in these files. Cells are graded by unweighted sample count, effective sample size and largest-contributor concentration; cells graded suppress are not exported to JSON.",
        "disclosure": "Public JSON requires at least 10 sampled factories and no factory contributing more than 70 percent of absolute weighted GVA in the cell.",
        "formula_source": "MoSPI ASI 2023-24 Instruction Manual, Annexure VIII and scrutiny formulas; version-specific column names are harmonized in the build script.",
        "source_url": "https://microdata.gov.in/NADA/index.php/catalog/ASI",
        "sector_definitions": sectors,
        "record_count": len(records),
    }
    OUTPUT_JSON.write_text(json.dumps({"metadata": metadata, "records": records}, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
