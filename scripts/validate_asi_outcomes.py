#!/usr/bin/env python3
"""Benchmark harmonized unit-record formulas against MoSPI publications."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from build_asi_outcomes import RAW_DIR, build_factory_frame


ROOT = Path(__file__).resolve().parents[1]
BENCHMARKS = ROOT / "data" / "official_asi_benchmarks.csv"
OUTPUT_JSON = ROOT / "outputs" / "asi_benchmark_validation.json"
OUTPUT_MD = ROOT / "outputs" / "asi_benchmark_validation.md"
TOLERANCE = 0.05
MONEY_METRICS = {
    "fixed_capital",
    "total_input",
    "total_output",
    "gva",
    "emoluments",
}


def calculated_totals(year: int) -> dict[str, float]:
    archive = next(RAW_DIR.glob(f"ASI_DATA_{year}_*_CSV.zip"))
    frame = build_factory_frame(archive, year)
    frame = frame.loc[frame["state"].eq("33")]
    weight = frame["weight"]
    metrics = set(pd.read_csv(BENCHMARKS).loc[lambda x: x["year"].eq(year), "metric"])
    totals = {metric: float((frame[metric] * weight).sum()) for metric in metrics}
    return {
        metric: value / 100_000 if metric in MONEY_METRICS else value
        for metric, value in totals.items()
    }


def main() -> int:
    benchmarks = pd.read_csv(BENCHMARKS)
    totals = {year: calculated_totals(int(year)) for year in sorted(benchmarks["year"].unique())}
    records = []
    for row in benchmarks.itertuples(index=False):
        calculated = totals[int(row.year)][row.metric]
        relative_error = abs(calculated - row.official_value) / abs(row.official_value)
        records.append(
            {
                "year": int(row.year),
                "metric": row.metric,
                "official": float(row.official_value),
                "calculated": calculated,
                "relative_error": relative_error,
                "pass": relative_error <= TOLERANCE,
                "source_url": row.source_url,
            }
        )

    passed = all(record["pass"] for record in records)
    payload = {
        "passed": passed,
        "tolerance": TOLERANCE,
        "scope_note": (
            "MoSPI benchmarks cover the full reported factory sector. The validation frame "
            "keeps status 1-3 units and NIC divisions 10-38, so a small systematic shortfall "
            "is expected. The test detects formula or schema failures, not exact table replication."
        ),
        "records": records,
    }
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2) + "\n")

    lines = [
        "# ASI Benchmark Validation",
        "",
        payload["scope_note"],
        "",
        f"Tolerance: {TOLERANCE:.0%}. Overall: **{'PASS' if passed else 'FAIL'}**.",
        "",
        "| Year | Metric | Official | Rebuilt | Error | Result |",
        "| --- | --- | ---: | ---: | ---: | --- |",
    ]
    for record in records:
        lines.append(
            f"| {record['year']}-{str(record['year'] + 1)[-2:]} | {record['metric']} | "
            f"{record['official']:,.1f} | {record['calculated']:,.1f} | "
            f"{record['relative_error']:.2%} | {'PASS' if record['pass'] else 'FAIL'} |"
        )
    OUTPUT_MD.write_text("\n".join(lines) + "\n")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
