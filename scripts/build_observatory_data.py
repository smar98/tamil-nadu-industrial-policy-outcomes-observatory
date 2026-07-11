#!/usr/bin/env python3
"""Assemble disclosure-safe public data for the observatory website."""

from __future__ import annotations

import csv
import json
import math
from collections import Counter
from datetime import date
from pathlib import Path
from statistics import median


ROOT = Path(__file__).resolve().parents[1]
SITE_DATA = ROOT / "site" / "public" / "data"
OUTPUT = SITE_DATA / "observatory.json"

# Peer rule: the six largest registered-manufacturing states by weighted ASI GVA
# in the latest survey year. ASI codes Telangana separately from 2012-13; the two
# successor states are combined into one series so the panel is a consistent
# (undivided) territory across the 2014 bifurcation.
STATE_NAMES = {
    "06": "Haryana",
    "09": "Uttar Pradesh",
    "24": "Gujarat",
    "27": "Maharashtra",
    "28+36": "Andhra Pradesh & Telangana",
    "29": "Karnataka",
    "33": "Tamil Nadu",
}
AP_SPLIT_YEAR = 2012  # first ASI survey year with separate state codes 28 and 36

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
    gsdp_archived = load_json(ROOT / "data" / "companion" / "tn_gsdp_2004_05_base.json")
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

    for record in asi["records"]:
        assert record["stability"] != "suppress", f"suppressed cell leaked: {record}"
        assert record["sample_factories"] >= 10, f"disclosure violation: {record}"
        assert record["largest_gva_contributor_share"] <= 0.7, f"disclosure violation: {record}"

    def combine_ap_telangana(rows):
        """Merge state 28 and 36 into one series (undivided territory).

        Before AP_SPLIT_YEAR only code 28 exists and already covers the undivided
        state. From AP_SPLIT_YEAR, both successor cells must be publishable for the
        combined cell to be published; ratios are recomputed from summed aggregates.
        """
        if len(rows) == 1 and rows[0]["year"] < AP_SPLIT_YEAR:
            return dict(rows[0])
        if len(rows) != 2:
            return None
        a, b = rows
        combined = dict(a)
        sums = {}
        for column in (
            "employees", "workers", "gva", "total_output", "total_input",
            "female_direct_workers", "male_direct_workers", "other_direct_workers",
            "contract_workers", "rd_expense", "estimated_factories",
        ):
            values = [a.get(column), b.get(column)]
            sums[column] = sum(v for v in values if v is not None) if any(v is not None for v in values) else None
        def ratio(num, den):
            return sums[num] / sums[den] if sums.get(num) is not None and sums.get(den) else None
        combined["employees"] = sums["employees"]
        combined["gva_output_ratio"] = ratio("gva", "total_output")
        direct = sum(sums[c] or 0 for c in ("female_direct_workers", "male_direct_workers", "other_direct_workers"))
        combined["female_direct_worker_share"] = (sums["female_direct_workers"] / direct) if direct else None
        combined["contract_worker_share"] = ratio("contract_workers", "workers")
        combined["rd_gva_share"] = ratio("rd_expense", "gva")
        # Factory-count-weighted mean of the two states' training shares.
        weights = [(row.get("training_factory_share"), row.get("estimated_factories")) for row in rows]
        weights = [(share, count) for share, count in weights if share is not None and count]
        combined["training_factory_share"] = (
            sum(share * count for share, count in weights) / sum(count for _, count in weights)
            if weights else None
        )
        combined["sample_factories"] = int(a["sample_factories"] + b["sample_factories"])
        combined["stability"] = "moderate" if "moderate" in (a["stability"], b["stability"]) else "high"
        return combined

    ap_cells = {}
    records = []
    raw_by_key = {}
    for record in asi["records"]:
        state = str(record["state"]).zfill(2)
        if record["sector_id"] not in relevant_sectors:
            continue
        if state in {"28", "36"}:
            ap_cells.setdefault((record["sector_id"], int(record["year"])), []).append(record)
            continue
        if state not in STATE_NAMES:
            continue
        raw_by_key[(state, record["sector_id"], int(record["year"]))] = record

    for (sector_id, year), rows in ap_cells.items():
        merged = combine_ap_telangana(sorted(rows, key=lambda row: str(row["state"])))
        if merged is not None:
            merged["state"] = "28+36"
            raw_by_key[("28+36", sector_id, year)] = merged

    for (state, sector_id, year), record in sorted(raw_by_key.items()):
        output = {
            "year": year,
            "year_label": record["year_label"],
            "state": state,
            "state_name": STATE_NAMES[state],
            "sector_id": sector_id,
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

    employees_series = {}
    for record in records:
        if record.get("employees"):
            employees_series.setdefault((record["state"], record["sector_id"]), {})[record["year"]] = record["employees"]

    def window_cagr(state, sector_id, start, end):
        series = employees_series.get((state, sector_id), {})
        first, last = series.get(start), series.get(end)
        if not first or not last or end <= start:
            return None
        return (last / first) ** (1 / (end - start)) - 1

    def trajectory_for(sector_id, policy_year):
        """Pre/post registered-factory employment CAGR around the policy year.

        The boundary observation is the last pre-policy survey year (policy year
        minus one, since ASI year Y covers FY Y to Y+1). Associational only.
        """
        tn_years = sorted(employees_series.get(("33", sector_id), {}))
        if not tn_years:
            return None
        boundary = policy_year - 1
        pre_start = max(tn_years[0], boundary - 5)
        latest = tn_years[-1]
        if boundary - pre_start < 3 or latest - boundary < 2:
            return None
        tn_pre = window_cagr("33", sector_id, pre_start, boundary)
        tn_post = window_cagr("33", sector_id, boundary, latest)
        if tn_pre is None or tn_post is None:
            return None
        peer_pre, peer_post = [], []
        for state in STATE_NAMES:
            if state == "33":
                continue
            pre = window_cagr(state, sector_id, pre_start, boundary)
            post = window_cagr(state, sector_id, boundary, latest)
            if pre is not None and post is not None:
                peer_pre.append(pre)
                peer_post.append(post)
        return {
            "metric": "employees",
            "pre_window": f"{pre_start}-{str(pre_start + 1)[-2:]} to {boundary}-{str(boundary + 1)[-2:]}",
            "post_window": f"{boundary}-{str(boundary + 1)[-2:]} to {latest}-{str(latest + 1)[-2:]}",
            "tn_pre_cagr": tn_pre,
            "tn_post_cagr": tn_post,
            "peer_pre_median_cagr": median(peer_pre) if peer_pre else None,
            "peer_post_median_cagr": median(peer_post) if peer_post else None,
            "peer_states": len(peer_pre),
        }

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
                "trajectory": trajectory_for(sector_id, document["year"]) if sector_id else None,
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

    input_paths = [
        ROOT / "data" / "policies" / "policy_corpus.json",
        ROOT / "data" / "policy_assessments.json",
        ROOT / "outputs" / "asi_policy_outcomes.json",
        ROOT / "data" / "companion" / "tn_solar_capacity_2023.json",
        ROOT / "data" / "companion" / "tn_manufacturing_gsva.csv",
        ROOT / "data" / "companion" / "tn_gsdp_2004_05_base.json",
        ROOT / "outputs" / "asi_benchmark_validation.json",
    ]
    payload = {
        "metadata": {
            "title": "Tamil Nadu Industrial Policy Outcomes Observatory",
            "updated": date.fromtimestamp(max(path.stat().st_mtime for path in input_paths)).isoformat(),
            "policy_count": len(policies),
            "target_count": len(all_targets),
            "evidence_counts": dict(evidence_counts),
            "verdict_counts": dict(verdict_counts),
            "asi_coverage": asi["metadata"]["coverage"],
            "asi_source_url": asi["metadata"]["source_url"],
            "asi_benchmark_passed": validation["passed"],
            "asi_benchmark_max_error": max(record["relative_error"] for record in validation["records"]),
            "causal_note": "The observatory describes outcomes before and after policies. It does not claim the policy caused the observed change.",
            "peer_note": "Peer states are the six largest registered-manufacturing states by weighted ASI gross value added in the latest survey year. Andhra Pradesh and Telangana are shown as one combined series so the territory stays consistent across the 2014 bifurcation; ASI coded them separately from 2012-13 and part of the 2012-13 step in that series reflects the frame change rather than real decline.",
            "trajectory_note": "Pre/post growth compares registered-factory employment CAGR in the five survey years before the policy with the years after it, for Tamil Nadu and the median peer state. It shows whether the trend changed; it does not show that the policy caused the change.",
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
        "gsdp_archived": gsdp_archived,
        "benchmark_validation": validation,
    }
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
