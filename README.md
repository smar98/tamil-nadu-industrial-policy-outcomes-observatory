# Tamil Nadu Industrial Policy Outcomes Observatory

An evidence-led audit of Tamil Nadu industrial-policy promises and outcomes.
The project covers 33 policies issued between 2007 and 2026 and codes 41
headline quantitative commitments. It separates four questions that are often
conflated:

1. What exactly did the policy promise?
2. Is there a public series that measures the same outcome?
3. Does that series match the target's geography, denominator, deadline and
   price basis closely enough to test it?
4. If not, what specific administrative record would be required before a
   verdict is defensible?

The accompanying site is an interactive public evidence ledger, not a causal
evaluation. It reports observed outcomes before and after policies and does not
claim that a policy caused an observed change.

## Repository contents

| Path | Purpose |
| --- | --- |
| `data/policies/policy_corpus.json` | 33-policy source inventory, official URLs and document metadata. |
| `data/policy_assessments.json` | Hand-audited commitments, evidence classes and verdict rules. |
| `data/asi_sector_definitions.json` | Published NIC 2008 sector definitions and limitations. |
| `data/official_asi_benchmarks.csv` | Official MoSPI benchmarks used to test the ASI harmonisation. |
| `data/companion/` | Clean, public companion inputs for TN manufacturing GSVA and solar capacity. |
| `data/policies/text/` | Extracted policy text used for reproducible target-candidate extraction. |
| `scripts/` | Download, harmonisation, validation, audit and website-data build scripts. |
| `outputs/` | Disclosure-safe ASI aggregates, validation records, research design and candidate-audit outputs. |
| `site/` | Interactive observatory source, tests and deployment configuration. |
| `REPRODUCIBILITY.md` | Exact regeneration order, data-access rules and known limitations. |

## What is deliberately excluded from GitHub

MoSPI ASI unit-record archives are access-controlled and must not be
redistributed, including in a private repository. Policy PDFs and raw companion
source PDFs are also excluded to keep the repository lightweight; their source
URLs, checksums where available and extracted text are retained. The complete
local research copy on the project owner's Desktop contains those files.

## Quick verification

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 scripts/validate_asi_outcomes.py
python3 scripts/build_observatory_data.py

cd site
npm install
npm test
```

The benchmark validation should report 40 passing checks within the pre-set 5%
tolerance, covering six survey years across every ASI schema era (2008-09,
2011-12, 2014-15, 2015-16, 2019-20, 2023-24). See
`outputs/asi_benchmark_validation.md` for the comparison table.

## Core findings currently scored

- 2007 Industrial Policy: manufacturing's GSDP share fell from 20.8% to 18.4%
  against a 27%-by-2011 target, on the archived 2004-05-base series
  contemporaneous with the target.
- 2014 Industrial Policy: manufacturing growth was below its 14% annual target
  under both nominal and real interpretations, with or without the COVID year.
- 2021 Industrial Policy: manufacturing growth was below its 15% annual target
  through the latest comparable year, from either the COVID-depressed base or
  the following year.
- 2019 Solar Policy: 6,736.43 MW was installed against a 9,000 MW 2023 target.
- 2020 Electronics Policy: no semiconductor fab was approved for or commissioned
  in Tamil Nadu by the 2023 deadline; public India Semiconductor Mission
  approvals all went to other states.

All other commitments remain visible in the ledger with a clear distinction
between direct evidence, partial measures, official proxies and records that
are not publicly available.
