#!/usr/bin/env python3
"""Download, text-extract and index the public Tamil Nadu policy corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "policies" / "policy_corpus.json"
RAW_DIR = ROOT / "data" / "policies" / "raw"
TEXT_DIR = ROOT / "data" / "policies" / "text"
OUTPUT = ROOT / "outputs" / "policy_corpus_index.json"


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TN-Industrial-Policy-Observatory/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        destination.write_bytes(response.read())


def extract_text(pdf: Path, destination: Path) -> None:
    result = subprocess.run(
        ["pdftotext", "-layout", str(pdf), str(destination)],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"pdftotext failed for {pdf.name}")
    if destination.stat().st_size < 500:
        ocr_text(pdf, destination)


def ocr_text(pdf: Path, destination: Path) -> None:
    """OCR image-only policies while preserving form-feed page boundaries."""
    with tempfile.TemporaryDirectory(prefix="tn-policy-ocr-") as temp_dir:
        prefix = Path(temp_dir) / "page"
        render = subprocess.run(
            ["pdftoppm", "-jpeg", "-r", "200", str(pdf), str(prefix)],
            check=False,
            capture_output=True,
            text=True,
        )
        if render.returncode != 0:
            raise RuntimeError(render.stderr.strip() or f"pdftoppm failed for {pdf.name}")
        pages = []
        for image in sorted(Path(temp_dir).glob("page-*.jpg")):
            result = subprocess.run(
                ["tesseract", str(image), "stdout", "-l", "eng"],
                check=False,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or f"tesseract failed for {image.name}")
            pages.append(result.stdout)
        destination.write_text("\f".join(pages))


def normalized_excerpt(text: str, limit: int = 600) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--no-download", action="store_true")
    args = parser.parse_args()

    corpus = json.loads(MANIFEST.read_text())
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    TEXT_DIR.mkdir(parents=True, exist_ok=True)
    index = []

    for document in corpus["documents"]:
        url = document.get("source_url", "")
        pdf = RAW_DIR / f"{document['id']}.pdf"
        text_file = TEXT_DIR / f"{document['id']}.txt"
        record = dict(document)

        if not url:
            record.update(
                download_status="missing-stable-source",
                text_status="unavailable",
                page_count=None,
                sha256=None,
                excerpt="",
            )
            index.append(record)
            continue

        try:
            if not args.no_download and (args.refresh or not pdf.exists()):
                download(url, pdf)
            if not pdf.exists():
                raise FileNotFoundError(pdf)
            if args.refresh or not text_file.exists():
                extract_text(pdf, text_file)
            text = text_file.read_text(errors="replace")
            record.update(
                download_status="downloaded",
                text_status="extracted",
                page_count=text.count("\f") + 1,
                sha256=hashlib.sha256(pdf.read_bytes()).hexdigest(),
                excerpt=normalized_excerpt(text),
            )
        except Exception as exc:  # preserve a complete audit trail
            record.update(
                download_status="failed",
                text_status="unavailable",
                page_count=None,
                sha256=None,
                excerpt="",
                error=str(exc),
            )
        index.append(record)
        print(f"{document['id']}: {record['download_status']}", file=sys.stderr)

    output = {
        "scope_note": corpus["scope_note"],
        "official_inventory_url": corpus["official_inventory_url"],
        "last_verified": corpus["last_verified"],
        "document_count": len(index),
        "documents": index,
    }
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
