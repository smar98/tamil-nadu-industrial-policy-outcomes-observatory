#!/usr/bin/env python3
"""Download ASI CSV archives from MoSPI's NADA API.

The API key is read from a temporary header file and is never written into the
workspace. Raw ASI files are access-controlled and must not be committed or
redistributed.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


BASE_URL = "https://microdata.gov.in/NADA/index.php"
YEAR_RE = re.compile(r"(19|20)\d{2}-(\d{2}|\d{4})")
RETRYABLE_STATUS = {401, 429, 500, 502, 503, 504}


def urlopen_with_retry(request: urllib.request.Request, attempts: int = 10):
    for attempt in range(attempts):
        try:
            return urllib.request.urlopen(request, timeout=180)
        except urllib.error.HTTPError as error:
            if error.code not in RETRYABLE_STATUS or attempt == attempts - 1:
                raise
            delay = min(2**attempt, 15)
            print(
                f"    MoSPI API returned {error.code}; retrying in {delay}s",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(delay)


def request_json(url: str, api_key: str | None = None) -> dict:
    headers = {"User-Agent": "ASI-methodology-audit/1.0"}
    if api_key:
        headers["X-API-KEY"] = api_key
    with urlopen_with_retry(urllib.request.Request(url, headers=headers)) as response:
        return json.load(response)


def download(url: str, destination: Path, api_key: str) -> None:
    headers = {
        "User-Agent": "ASI-methodology-audit/1.0",
        "X-API-KEY": api_key,
    }
    request = urllib.request.Request(url, headers=headers)
    temporary = destination.with_suffix(destination.suffix + ".part")
    with urlopen_with_retry(request) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    temporary.replace(destination)


def read_api_key(header_file: Path) -> str:
    line = header_file.read_text(encoding="utf-8").strip()
    prefix = "X-API-KEY:"
    if not line.upper().startswith(prefix):
        raise ValueError(f"Expected {prefix} in {header_file}")
    return line.split(":", 1)[1].strip()


def list_asi_datasets() -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        payload = request_json(f"{BASE_URL}/api/listdatasets?page={page}")
        page_rows = payload.get("result", {}).get("rows", [])
        if not page_rows:
            break
        rows.extend(row for row in page_rows if row.get("repositoryid") == "ASI")
        page += 1
    return rows


def start_year(title: str) -> int | None:
    match = YEAR_RE.search(title)
    return int(match.group(0)[:4]) if match else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--header-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data/asi_raw"))
    parser.add_argument("--from-year", type=int, default=2000)
    parser.add_argument("--to-year", type=int, default=2023)
    parser.add_argument("--delay", type=float, default=15.0)
    args = parser.parse_args()

    api_key = read_api_key(args.header_file)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    datasets = []
    for row in list_asi_datasets():
        year = start_year(row.get("title", ""))
        if year is not None and args.from_year <= year <= args.to_year:
            datasets.append((year, row))
    datasets.sort()

    if not datasets:
        print("No ASI datasets found", file=sys.stderr)
        return 1

    catalog_manifest = [
        {**row, "year": year}
        for year, row in datasets
    ]
    (args.output_dir / "catalog_manifest.json").write_text(
        json.dumps(catalog_manifest, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )

    manifest = []
    for index, (year, row) in enumerate(datasets, start=1):
        idno = row["idno"]
        quoted_idno = urllib.parse.quote(idno, safe="")
        archive_name = f"ASI_DATA_{year}_{(year + 1) % 100:02d}_CSV.zip"
        destination = args.output_dir / archive_name
        if destination.exists() and destination.stat().st_size > 1024:
            print(f"[{index}/{len(datasets)}] already present: {destination.name}")
            status = "existing"
        else:
            file_token = urllib.parse.quote(
                base64.b64encode(archive_name.encode("ascii")).decode("ascii"),
                safe="",
            )
            url = f"{BASE_URL}/api/fileslist/download/{quoted_idno}/{file_token}"
            print(f"[{index}/{len(datasets)}] downloading {row['title']}", flush=True)
            try:
                download(url, destination, api_key)
                status = "downloaded"
                time.sleep(args.delay)
            except urllib.error.HTTPError as error:
                if error.code != 401:
                    raise
                temporary = destination.with_suffix(destination.suffix + ".part")
                temporary.unlink(missing_ok=True)
                print(f"    access agreement required for {row['title']}")
                status = "access_required"

        manifest.append(
            {
                **row,
                "year": year,
                "status": status,
                "archive": destination.name,
                "source_name": archive_name,
            }
        )

    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
