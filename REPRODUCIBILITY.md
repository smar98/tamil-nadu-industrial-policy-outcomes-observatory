# Reproducibility and Data Access

## Scope

This repository reproduces the calculation pipeline behind the Tamil Nadu
Industrial Policy Outcomes Observatory. It publishes code, source manifests,
policy text, disclosure-safe aggregates and tests. It does **not** publish
MoSPI ASI unit records or other bulky raw downloads.

## Environment

- Python 3.11 or newer
- Node.js 22.13 or newer for the website
- `pdftotext` on `PATH` if rebuilding policy text from PDFs
- A MoSPI NADA account approved for the ASI unit-record access agreement

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Rebuild Order

### 1. Rebuild the policy corpus

`data/policies/policy_corpus.json` contains the policy inventory and stable
source URLs. It is already sufficient to audit the policy scope. To re-download
source PDFs and re-extract text:

```bash
python3 scripts/build_policy_corpus.py --refresh
python3 scripts/extract_policy_target_candidates.py
```

The candidate extractor is intentionally not an automated target classifier.
Every proposed target must be reviewed against its original PDF page before it
enters `data/policy_assessments.json`.

### 2. Obtain ASI microdata lawfully

Create a header file containing only the authorised NADA API header. Do not
commit that file. Then download the archives to the ignored local path:

```bash
python3 scripts/download_asi.py \
  --header-file /secure/path/nada-header.txt \
  --output-dir data/asi_raw \
  --from-year 2008 \
  --to-year 2023
```

The script records unavailable years as `access_required` rather than trying to
bypass the agreement. The complete owner-only desktop copy contains the
downloaded archives under `data/asi_raw/`.

### 3. Build disclosure-safe ASI aggregates

```bash
python3 scripts/build_asi_outcomes.py --start-year 2008 --end-year 2023
```

This produces `outputs/asi_policy_outcomes.csv` and JSON. The public JSON
withholds a cell when it has fewer than 10 sampled factories or when one factory
contributes more than 70% of absolute weighted GVA.

### 4. Verify the ASI formula implementation

```bash
python3 scripts/validate_asi_outcomes.py
python3 scripts/audit_asi_identifiers_power.py
```

The validation script compares harmonised Tamil Nadu aggregates against the
official figures in `data/official_asi_benchmarks.csv`. Its predeclared pass
condition is a relative difference of 5% or less. The identifier and power
audit documents why the project does not claim to follow individual factories
over time or build a historical outage series from inconsistent fields.

### 5. Build the website data payload

```bash
python3 scripts/build_observatory_data.py
```

This combines the policy ledger, public ASI aggregates, Tamil Nadu DES GSVA,
MNRE solar capacity and benchmark audit into
`site/public/data/observatory.json`.

### 6. Build and test the website

```bash
cd site
npm install
npm test
```

## Calculation Rules

- ASI estimates use public-use survey multipliers; ratios are ratios of weighted
  aggregates, not unweighted averages of factories.
- The code harmonises year-specific field names, employment definitions and
  accounting identities from 2008-09 through 2023-24.
- ASI monetary values are current rupees. The site does not call their change
  “real growth.” Real manufacturing growth is taken only from the TN DES
  constant-price GSVA series.
- ASI is a repeated cross-section. Public identifiers are insufficient for a
  defensible firm panel.
- A target receives a verdict only where target, outcome, geography, unit,
  deadline and denominator align. An official proxy is labelled as a proxy;
  it is never converted into a pass/fail result.
- MoUs, announced investment and expected jobs are not treated as realised
  outcomes. They require commissioned-project, audited-investment and payroll
  records.

## Data Sources

- MoSPI ASI: https://microdata.gov.in/NADA/index.php/catalog/ASI
- Tamil Nadu DES state income: https://des.tn.gov.in/node/346
- MNRE state renewable capacity: recorded in `data/companion/tn_solar_capacity_2023.json`
- Guidance Tamil Nadu policy inventory: https://investingintamilnadu.com/business-in-tamil-nadu/policy-notifications

## Local Complete Copy

The owner-only Desktop copy includes the files excluded by `.gitignore`:

- `data/asi_raw/` (access-controlled ASI archives)
- `data/policies/raw/` (downloaded policy PDFs)
- `data/companion_raw/` (downloaded source PDFs)

Those paths are not safe to push to GitHub even when the repository is private.
