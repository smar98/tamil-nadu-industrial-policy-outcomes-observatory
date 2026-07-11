#!/usr/bin/env python3
"""Assemble disclosure-safe public data for the observatory website."""

from __future__ import annotations

import csv
import json
import math
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE_DATA = ROOT / "site" / "public" / "data"
OUTPUT = SITE_DATA / "observatory.json"

STATE_NAMES = {
    "06": "Haryana",
    "24": "Gujarat",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "33": "Tamil Nadu",
    "36": "Telangana",
}

METRICS = {
    "employees": {"label": "People engaged", "format": "count", "note": "Estimated people engaged in registered factories."},
    "gva_output_ratio": {"label": "Value-added share", "format": "percent", "note": "Gross value added divided by gross output."},
    "female_direct_worker_share": {"label": "Women among direct workers", "format": "percent", "note": "Women divided by all directly employed workers."},
    "contract_worker_share": {"label": "Contract-worker share", "format": "percent", "note": "Contract workers divided by all workers."},
    "rd_gva_share": {"label": "R&D intensity", "format": "percent", "note": "Reported R&D expenditure divided by GVA; available from 2015-16."},
    "training_factory_share": {"label": "Factories providing training", "format": "percent", "note": "Share of reporting factories with formal training; available from 2020-21."},
}


def load_json(path: Path):
    return json.loads(path.read_text())


def finite(value):
    return value if isinstance(value, (int, float)) and math.isfinite(value) else None


def main() -> int:
    corpus = load_json(ROOT / "data" / "policies" / "policy_corpus.json")
    assessments = load_json(ROOT / "data" / "policy_assessments.json")
    asi = load_json(ROOT / "outputs" / "asi_policy_outcomes.json")
    solar = load_json(ROOT / "data" / "companion" / "tn_solar_capacity_2023.json")
    validation = load_json(ROOT / "outputs" / "asi_benchmark_validation.json")

    gsva = []
    with (ROOT / "data" / "companion" / "tn_manufacturing_gsva.csv").open() as handle:
        for row in csv.DictReader(handle):
            gsva.append(
                {
                    "year": int(row["year"]),
                    "year_label": row["year_label"],
                    "current_rupees_crore": float(row["current_rupees_crore"]),
                    "current_growth_pct": float(row["current_growth_pct"]) if row["current_growth_pct"] else None,
                    "current_share_gsva_pct": float(row["current_share_gsva_pct"]),
                    "constant_rupees_crore": float(row["constant_2011_12_rupees_crore"]),
                    "real_growth_pct": float(row["real_growth_pct"]) if row["real_growth_pct"] else None,
                    "constant_share_gsva_pct": float(row["constant_share_gsva_pct"]),
                    "estimate_status": row["estimate_status"],
                }
            )

    document_by_id = {document["id"]: document for document in corpus["documents"]}
    sector_by_id = {
        sector["id"]: sector for sector in asi["metadata"]["sector_definitions"]
    }
    relevant_sectors = {
        assessment["asi_sector_id"]
        for assessment in assessments["assessments"]
        if assessment["asi_sector_id"]
    }
    relevant_sectors.add("all-manufacturing")

    records = []
    for record in asi["records"]:
        state = str(record["state"]).zfill(2)
        if state not in STATE_NAMES or record["sector_id"] not in relevant_sectors:
            continue
        output = {
            "year": int(record["year"]),
            "year_label": record["year_label"],
            "state": state,
            "state_name": STATE_NAMES[state],
            "sector_id": record["sector_id"],
            "stability": record["stability"],
            "sample_factories": int(record["sample_factories"]),
        }
        for metric in METRICS:
            output[metric] = finite(record.get(metric))
        records.append(output)

    tn_by_sector = {}
    for record in records:
        if record["state"] == "33":
            tn_by_sector.setdefault(record["sector_id"], []).append(record)
    for sector_records in tn_by_sector.values():
        sector_records.sort(key=lambda item: item["year"])

    policies = []
    all_targets = []
    for assessment in assessments["assessments"]:
        document = document_by_id[assessment["policy_id"]]
        targets = assessment["targets"]
        all_targets.extend(targets)
        sector_id = assessment["asi_sector_id"]
        sector_records = tn_by_sector.get(sector_id, []) if sector_id else []
        latest = sector_records[-1] if sector_records else None
        post_policy = [row for row in sector_records if row["year"] >= document["year"]]
        latest_three = post_policy[-3:]
        summary = None
        if latest:
            summary = {
                "latest_year": latest["year_label"],
                "stability": latest["stability"],
                "sample_factories": latest["sample_factories"],
                "post_policy_observations": len(post_policy),
                "latest": {metric: latest.get(metric) for metric in METRICS},
                "latest_three_year_average": {
                    metric: (
                        sum(row[metric] for row in latest_three if row.get(metric) is not None)
                        / len([row for row in latest_three if row.get(metric) is not None])
                        if any(row.get(metric) is not None for row in latest_three)
                        else None
                    )
                    for metric in METRICS
                },
            }
        policies.append(
            {
                "id": document["id"],
                "title": document["title"],
                "year": document["year"],
                "type": document["type"],
                "sector": document["sector"],
                "issuer": document["issuer"],
                "status": document["status"],
                "source_url": document["source_url"],
                "source_tier": document["source_tier"],
                "asi_sector_id": sector_id,
                "asi_sector_label": sector_by_id.get(sector_id, {}).get("label") if sector_id else None,
                "coverage_note": assessment["coverage_note"],
                "targets": targets,
                "asi_summary": summary,
            }
        )

    evidence_counts = Counter(target["evidence_class"] for target in all_targets)
    verdict_counts = Counter(target.get("verdict", "not_scored") for target in all_targets)
    policies.sort(key=lambda policy: (policy["year"], policy["title"]))

    payload = {
        "metadata": {
            "title": "Tamil Nadu Industrial Policy Outcomes Observatory",
            "updated": "2026-07-10",
            "policy_count": len(policies),
            "target_count": len(all_targets),
            "evidence_counts": dict(evidence_counts),
            "verdict_counts": dict(verdict_counts),
            "asi_coverage": asi["metadata"]["coverage"],
            "asi_source_url": asi["metadata"]["source_url"],
            "asi_benchmark_passed": validation["passed"],
            "asi_benchmark_max_error": max(record["relative_error"] for record in validation["records"]),
            "causal_note": "The observatory describes outcomes before and after policies. It does not claim the policy caused the observed change.",
            "price_note": asi["metadata"]["price_basis"],
            "disclosure_note": asi["metadata"]["disclosure"],
        },
        "evidence_classes": assessments["evidence_classes"],
        "metrics": METRICS,
        "states": STATE_NAMES,
        "sectors": [sector_by_id[sector_id] for sector_id in sorted(relevant_sectors)],
        "policies": policies,
        "asi_records": records,
        "gsva": gsva,
        "solar": solar,
        "benchmark_validation": validation,
    }
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
