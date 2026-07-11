# Promises, Performance, and Measurement

## Proposed paper

**Working title:** *Promises, Performance, and Measurement: Two Decades of
Industrial Policy in Tamil Nadu*

**Primary question:** Across Tamil Nadu's general and sector-specific industrial
policies since 2007, which stated outcomes can be independently measured, which
targets were reached, and did targeted industries subsequently depart from their
own pre-policy trajectories and from the same industries elsewhere in India?

This is preferable to a paper claiming to measure an unobserved manufacturing
"capability." The public data can measure economic outcomes and selected upgrading
inputs. They cannot prove latent technological capability or identify the causal
effect of subsidies without treatment or recipient records.

## The current observatory

The higher-value manufacturing observatory is worth building only as the empirical
measurement layer of this paper. It can establish whether registered manufacturing
growth came with:

- more real GVA, employment, and fixed capital;
- higher GVA per worker and GVA per rupee of output;
- higher real wages, emoluments, and labour share;
- greater direct-export orientation;
- changes in product mix and regional concentration; and
- observable R&D, training, and workforce-composition inputs where the schedule
  actually contains them.

On its own, that observatory would be a descriptive monitoring product. It would
not explain why outcomes changed, prove that firms moved up the value chain, or
establish that a Tamil Nadu policy caused the change.

## Three separate estimands

### 1. Target attainment

For every numerical policy promise, estimate the gap between the promised and
observed outcome at the stated deadline. This does **not** require a counterfactual.
It asks whether a target was met, not whether policy caused the outcome.

### 2. Benchmark-adjusted trajectory

Estimate whether the Tamil Nadu sector changed relative to:

1. its own pre-policy trend;
2. the same narrowly defined sector in other manufacturing states; and
3. non-targeted manufacturing activities within Tamil Nadu.

This is an associational result unless the identification tests below pass.

### 3. Causal policy effect

A causal claim requires observed treatment assignment or a credible source of
quasi-random exposure. Public ASI files do not contain incentive receipt, approved
investment, subsidy value, land allotment, MoU terms, or the counterfactual offer.
Consequently, the baseline paper will not claim that Tamil Nadu's policies caused
the measured changes.

## Policy scope

Build a complete policy ledger first, then restrict outcome evaluation according to
available pre- and post-policy years.

### General policies

- Tamil Nadu Industrial Policy 2007
- Tamil Nadu Industrial Policy 2014
- Tamil Nadu Industrial Policy 2021

### Initial sector cases

- Automobile and Auto Components Policy 2014
- Food Processing Policy 2018
- New Integrated Textile Policy 2019
- Electronics Hardware Manufacturing Policy 2020

Policies from 2022 onward should enter the policy ledger but not a medium-term
impact analysis yet. They have too little post-policy ASI data.

The automobile policy is the strongest first case. It has roughly fourteen pre-policy
and ten post-policy ASI years, a relatively clean NIC core, explicit employment,
export, production, and regional objectives, and a stated aim of consolidating an
existing comparative advantage. The empirical question becomes whether the policy
was followed by acceleration, deepening, or geographic spread beyond trends already
visible before 2014.

## Policy ledger

Code every promise before inspecting outcomes. Each row should contain:

- policy and effective date;
- exact quoted target, baseline, deadline, and unit;
- stock or flow;
- nominal or real value;
- direct, indirect, or total employment;
- eligible products mapped to NIC and NPCMS;
- eligible geography and project thresholds;
- instrument: tax, capital, land, power, training, infrastructure, facilitation;
- intended mechanism;
- proposed outcome source;
- whether the target is independently measurable; and
- whether implementation or only policy announcement is observed.

Examples of measurement problems that are themselves research findings:

| Promise | Public-data verdict |
|---|---|
| 2014: additional 2 million jobs before 2016 | A flow target. It cannot be validated by citing the total stock of factory workers. ASI measures registered-factory employment, not all "gainful employment." |
| 2014: 14% annual manufacturing growth | Potentially measurable, but the policy must specify real versus nominal growth. Report both and treat ambiguity as a design defect. |
| 2014: double exports by 2016 | The policy does not clearly state a base year or export boundary. ASI's direct-export share is not identical to total state exports. |
| 2021: INR 10 lakh crore investment during 2020-25 | Not independently verifiable from ASI. Book fixed assets and annual additions are not MoU commitments, eligible fixed assets, approvals, or realised project investment. |
| 2021: manufacturing reaches 30% of GSVA by 2030 | Directly measurable from official state accounts; the deadline has not arrived. |
| 2020 electronics: train 100,000 people by 2024 | ASI only records a binary factory-training indicator from 2020-21 onward; it cannot count trainees or assess training quality. |

The [2014 policy](https://sipcot.tn.gov.in/portal/vacantlist/GO.pdf) explicitly set
14% manufacturing growth, more than 10% annual incremental manufacturing
investment, 2 million additional jobs before 2016, doubled exports by 2016, and
faster industrialisation of southern districts. The
[2021 policy](https://storage.investingintamilnadu.com/Guidance/Uploads/Others/industrial_policy.pdf)
set 15% annual manufacturing growth, INR 10 lakh crore in investment during
2020-25, 2 million jobs by 2025, and a 30% manufacturing share of GSVA by 2030.

## Data spine

| Dataset | Years | Role | Important limitation |
|---|---:|---|---|
| [MoSPI Annual Survey of Industries unit files](https://microdata.gov.in/NADA/index.php/catalog/ASI) | 2000-01 to 2023-24 | Survey-weighted state-industry and district-industry outcomes for registered factories | Repeated cross-sections; public permanent identifiers are masked; NIC and schedule revisions require harmonisation |
| MoSPI/Tamil Nadu state domestic product series | 2004-05 onward, with linked bases | Manufacturing GSVA level, growth, and share of state GSVA | Base revisions and back-series consistency must be documented |
| DGCI&S/Department of Commerce state export series | Available years vary | State and commodity export outcomes | State of origin, port of export, and direct factory exports are different concepts |
| PLFS and earlier NSS employment surveys | 2004-05 onward at selected intervals; annual from 2017-18 | Manufacturing employment, informality, wages, gender, and occupational composition outside ASI | State-sector cells can be small; questionnaire and sampling changes |
| Tamil Nadu policy documents, G.O.s, and annual policy notes | 2007 onward | Ex-ante targets, instruments, deadlines, and later government progress claims | Policy announcement is not treatment receipt or implementation intensity |

ASI dimensions will remain separate rather than being combined into a capability
index:

- **Scale:** factories, employment, gross output, fixed capital.
- **Domestic value creation:** real GVA, GVA/output, GVA/worker.
- **Job quality:** real emoluments/worker, labour share, contract-worker share.
- **Capital deepening:** fixed capital/worker.
- **Export orientation:** direct-export share and estimated direct-export output.
- **Product structure:** NPCMS output shares where product coverage is adequate.
- **Observable upgrading inputs:** R&D-unit incidence, R&D expenditure, training
  incidence, supervisory share. These are inputs or proxies, not proof of capability.
- **Regional spread:** stable-region shares using harmonised district boundaries and
  three-year averages.

## Price and classification treatment

1. Use NIC-1998, NIC-2004, and NIC-2008 concordances. Publish the crosswalk.
2. Estimate at the narrowest level that remains stable across revisions; use broader
   robustness definitions for cross-cutting sectors such as auto components and
   electronics.
3. For levels of real output and GVA, use industry-specific linked deflators and
   double deflation where an adequate output and input price mapping exists.
4. For cross-state sector comparisons, include sector-year effects so common national
   product-price shocks are absorbed. This does not remove state-specific prices.
5. Use survey multipliers and MoSPI's official variance/RSE procedure. Report
   uncertainty, disclosure suppression, and cell-size rules.
6. Use three-year averages for noisy district and narrow-industry estimates, while
   retaining annual series for event-study diagnostics.

## Counterfactual strategy

### Descriptive benchmark

For each policy-sector pair, construct a synthetic benchmark from states that match
Tamil Nadu on at least eight pre-policy years of the outcome, manufacturing scale,
and sector mix. Show pre-fit, post-policy gaps, leave-one-out estimates, in-space
placebos, and alternative donor pools.

### Triple-difference robustness

Estimate a state-sector-year model with state-sector, state-year, and sector-year
fixed effects. The coefficient of interest is Tamil Nadu x targeted sector x post.
Plot leads and lags; do not report a single post coefficient without the event study.

### Why this is not automatically causal

- Tamil Nadu selects sectors partly because they are already strong or expected to grow.
- Comparator states have their own industrial policies, so many donors are treated.
- National programmes, GST, COVID-19, product cycles, trade shocks, and central PLI
  schemes overlap state policy dates.
- Several Tamil Nadu policies and large individual investments overlap one another.
- A policy document records an offer, not actual take-up or implementation intensity.

Accordingly, describe these estimates as benchmark-adjusted trajectories. Upgrade a
result to causal only if treatment exposure can be observed, pre-trends are credible,
control contamination is addressed, and placebo/randomisation inference supports the
design.

## Pre-registered decision rules

- No firm-level longitudinal claims unless a stable, non-masked identifier passes
  uniqueness, continuity, and attribute-consistency tests.
- No policy-effect claim if event-study leads reject parallel trends or synthetic
  pre-fit is poor.
- No target-achievement claim when the policy omits its baseline, denominator, price
  basis, or employment boundary; report it as not independently verifiable.
- No aggregate "capability score."
- No cherry-picking: publish every coded quantitative target and every pre-specified
  primary outcome, including null and adverse results.
- Treat 2020-21 separately in robustness checks rather than smoothing the pandemic
  mechanically into a trend.

## What the paper can tell government

1. Which industrial-policy promises were well specified and independently auditable.
2. Which numerical targets were reached on their own terms.
3. Whether targeted industries expanded in scale, generated more domestic value, paid
   better, exported more, or spread geographically.
4. Whether policy selection followed an existing boom or preceded a subsequent
   acceleration.
5. Which claims cannot be evaluated because administrative implementation data are
   not public or were never structured for evaluation.

It cannot, from public ASI alone, tell government the incremental return on a subsidy,
whether a specific deal was additional, whether a named plant upgraded technology, or
whether observed GVA growth was caused by R&D rather than prices, mark-ups, demand,
capital deepening, or input costs.

## Go/no-go decision

**Go** on the policy-target ledger, the 2000-2024 aggregate ASI spine, and an
automotive 2014 deep case. **Do not** frame the paper as a causal evaluation of all
Tamil Nadu industrial policy. **Do not** build the public dashboard until the target
definitions, ASI identifier audit, classification concordance, and power-variable audit
are complete.

## Completed ASI access audit

The full public-use CSV series for ASI 2000-01 through 2023-24 has now been audited.

- **No public factory panel:** PSL is present but the same sentinel value is used for
  every record in 18 vintages; it is omitted in the other 6. CIN is absent before
  2015-16 and fully masked thereafter. MoSPI's own manual states that DSL is unique
  only within a survey year and the same factory may receive a different DSL in
  another year. All factory-level longitudinal claims are therefore rejected.
- **No defensible unmet-power trend:** the Block H unmet-demand row changes from
  sparse and inconsistently zero-filled records, to almost universal row coverage in
  only 2016-17 and 2017-18, to complete omission in 2018-19 through 2022-23. The
  2023-24 public file contains only seven national rows, all with zero quantity. These
  are reporting/dissemination breaks, not plausible changes in grid reliability.
- **Purchased-electricity expenditure is extractable:** quantity and purchase value
  exist throughout the series. Their ratio is a realised expenditure per recorded kWh,
  not a regulated tariff. It requires sector and voltage/composition adjustment,
  real-price treatment, and outlier controls before year-on-year comparison.

The reproducible, disclosure-safe outputs are in `asi_methodology_audit.md/csv/json`.
The factory-power constraint project is rejected in its proposed form.
