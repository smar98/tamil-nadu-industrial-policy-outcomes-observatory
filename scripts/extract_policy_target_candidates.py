#!/usr/bin/env python3
"""Extract reviewable target candidates from policy text with page provenance."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "outputs" / "policy_corpus_index.json"
TEXT_DIR = ROOT / "data" / "policies" / "text"
JSON_OUTPUT = ROOT / "outputs" / "policy_target_candidates.json"
MD_OUTPUT = ROOT / "outputs" / "policy_target_candidates.md"

TARGET_TERMS = re.compile(
    r"\b(target|goal|aim|objective|mission|vision|attract|create|generate|"
    r"employment|jobs?|investment|exports?|capacity|market share|growth rate|"
    r"increase|double|triple|reduce|achieve|train|establish|facilitate|promote)\b",
    re.IGNORECASE,
)
QUANTIFIED = re.compile(
    r"(?:\b\d+(?:\.\d+)?\s*(?:%|percent|crore|cr\.?|lakh|million|billion|"
    r"mw|gw|mmtpa|mtpa|hectares?|acres?|units?|persons?|people|jobs?)\b|"
    r"₹\s*\d|\b(?:20\d{2}|201\d|200\d)\b|\bdouble\b|\btriple\b)",
    re.IGNORECASE,
)
HEADER_NOISE = re.compile(
    r"^(?:contents|page\s+no\.?|government of tamil nadu|industries department|"
    r"tamil nadu|policy\s+20\d{2})$",
    re.IGNORECASE,
)


def clean_page(page: str) -> str:
    lines = []
    for raw in page.splitlines():
        line = re.sub(r"\s+", " ", raw).strip(" \t•\uf0b7")
        if not line or HEADER_NOISE.match(line):
            continue
        lines.append(line)
    text = " ".join(lines)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def candidate_windows(page: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?;:])\s+(?=[A-Z0-9(])", page)
    output = []
    for index, sentence in enumerate(sentences):
        if not (TARGET_TERMS.search(sentence) and QUANTIFIED.search(sentence)):
            continue
        start = max(0, index - 1)
        end = min(len(sentences), index + 2)
        excerpt = " ".join(sentences[start:end])
        excerpt = re.sub(r"\s+", " ", excerpt).strip()
        if 40 <= len(excerpt) <= 1400:
            output.append(excerpt)
    return list(dict.fromkeys(output))


def main() -> int:
    corpus = json.loads(CORPUS.read_text())
    records = []
    for document in corpus["documents"]:
        text_file = TEXT_DIR / f"{document['id']}.txt"
        if not text_file.exists():
            continue
        pages = text_file.read_text(errors="replace").split("\f")
        for page_number, raw_page in enumerate(pages, start=1):
            page = clean_page(raw_page)
            for excerpt in candidate_windows(page):
                records.append(
                    {
                        "policy_id": document["id"],
                        "policy_title": document["title"],
                        "policy_year": document["year"],
                        "page": page_number,
                        "excerpt": excerpt,
                        "source_url": document.get("source_url", ""),
                        "review_status": "unreviewed",
                    }
                )

    JSON_OUTPUT.write_text(
        json.dumps(
            {
                "method": "Keyword and quantity candidate extraction; every candidate requires human review before entering the target ledger.",
                "candidate_count": len(records),
                "candidates": records,
            },
            indent=2,
            ensure_ascii=True,
        )
        + "\n"
    )

    lines = [
        "# Policy target candidates",
        "",
        "Automatically extracted for human review. Inclusion here is not evidence that a passage is a target.",
        "",
    ]
    current = None
    for record in records:
        if record["policy_id"] != current:
            current = record["policy_id"]
            lines.extend([f"## {record['policy_title']}", ""])
        lines.extend(
            [
                f"- Page {record['page']}: {record['excerpt']}",
                "",
            ]
        )
    MD_OUTPUT.write_text("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
