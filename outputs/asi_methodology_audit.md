# ASI Identifier and Electricity Audit

This report contains disclosure-safe aggregate diagnostics only.

## Identifier finding

Permanent serial numbers are completely masked in 18 vintages and omitted in 6 vintages. A usable corporate identifier is absent or completely masked in 24 vintages.

| year | a_rows | dsl_unique | psl_column | psl_unique | psl_masked_share | cin_column | cin_unique | cin_masked_share |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2000 | 41096 | 41096 | A_Itm_2 | 1 | 1 | None |  |  |
| 2001 | 42242 | 42242 | A_Itm2 | 1 | 1 | None |  |  |
| 2002 | 41846 | 41846 | None |  |  | None |  |  |
| 2003 | 56889 | 56889 | A_Itm2 | 1 | 1 | None |  |  |
| 2004 | 49340 | 49340 | None |  |  | None |  |  |
| 2005 | 57304 | 57304 | None |  |  | None |  |  |
| 2006 | 66875 | 66875 | None |  |  | None |  |  |
| 2007 | 56888 | 56888 | None |  |  | None |  |  |
| 2008 | 54348 | 54348 | None |  |  | None |  |  |
| 2009 | 57113 | 57113 | A_Itm2 | 1 | 1 | None |  |  |
| 2010 | 52243 | 52243 | PSL | 1 | 1 | None |  |  |
| 2011 | 52775 | 52775 | PSL | 1 | 1 | None |  |  |
| 2012 | 59162 | 59162 | PSL | 1 | 1 | None |  |  |
| 2013 | 57968 | 57968 | PSL | 1 | 1 | None |  |  |
| 2014 | 63296 | 63296 | PSL | 1 | 1 | None |  |  |
| 2015 | 65110 | 65110 | PSL | 1 | 1 | CIN | 1 | 1 |
| 2016 | 68105 | 68105 | psl | 1 | 1 | cin | 1 | 1 |
| 2017 | 66688 | 66688 | a2 | 1 | 1 | b03 | 1 | 1 |
| 2018 | 67356 | 67356 | A2 | 1 | 1 | B03 | 1 | 1 |
| 2019 | 66853 | 66853 | a2 | 1 | 1 | b03 | 1 | 1 |
| 2020 | 68009 | 68009 | a2 | 1 | 1 | b03 | 1 | 1 |
| 2021 | 68548 | 68548 | a2 | 1 | 1 | b03 | 1 | 1 |
| 2022 | 68462 | 68462 | a2 | 1 | 1 | b03 | 1 | 1 |
| 2023 | 68641 | 68641 | a2 | 1 | 1 | b03 | 1 | 1 |

## Electricity finding

The unmet-demand item is evaluated by its official description/code, not by serial number alone. Historical schedules changed, and additional-sheet raw materials can reuse serial numbers above the printed form.

The unmet-demand row is absent in start-years 2000, 2008, 2009, 2018, 2019, 2020, 2021, 2022. It is near-universally present only in 2016, 2017; surrounding years mostly contain sparse positive-only or unexplained zero records. In 2023-24, only seven national rows appear and all report zero quantity. This is not a credible longitudinal reliability series.

| year | purchased_rows | unmet_rows | unmet_positive_rows | tn_unmet_positive_rows | unmet_row_share_of_h_factories | realized_cost_median | realized_cost_p01 | realized_cost_p99 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2000 | 30873 | 0 | 0 | 0 | 0 | 4.2 | 2 | 6.851 |
| 2001 | 32873 | 4385 | 0 | 0 | 0.1278 | 4.35 | 2 | 7 |
| 2002 | 33184 | 2641 | 0 | 0 | 0.07631 | 4.52 | 2 | 6.816 |
| 2003 | 44695 | 2328 | 0 | 0 | 0.04989 | 4.641 | 2.37 | 6.857 |
| 2004 | 39206 | 1654 | 1649 | 141 | 0.04062 | 4.692 | 2.58 | 6.948 |
| 2005 | 43008 | 2084 | 2084 | 116 | 0.04659 | 4.719 | 2.45 | 7 |
| 2006 | 42726 | 2117 | 41 | 2 | 0.04758 | 4.779 | 2.34 | 7 |
| 2007 | 37475 | 1785 | 0 | 0 | 0.04594 | 4.85 | 2.357 | 7.914 |
| 2008 | 37606 | 0 | 0 | 0 | 0 | 4.97 | 2.41 | 8 |
| 2009 | 41190 | 0 | 0 | 0 | 0 | 5 | 2.8 | 8.357 |
| 2010 | 42673 | 2233 | 2233 | 411 | 0.05083 | 5.25 | 2.96 | 8.049 |
| 2011 | 43564 | 2753 | 2745 | 806 | 0.0616 | 5.864 | 3 | 8.94 |
| 2012 | 47139 | 1853 | 1853 | 585 | 0.03837 | 6.3 | 4 | 9.199 |
| 2013 | 49369 | 1802 | 1802 | 775 | 0.03568 | 6.9 | 4 | 11 |
| 2014 | 51742 | 963 | 960 | 357 | 0.01815 | 7.002 | 4 | 11.52 |
| 2015 | 52061 | 1154 | 1146 | 496 | 0.02161 | 7.25 | 4 | 11.53 |
| 2016 | 54856 | 56755 | 1251 | 433 | 0.9922 | 7.45 | 4 | 11.7 |
| 2017 | 53825 | 54993 | 1178 | 286 | 0.9819 | 7.501 | 4.05 | 12.1 |
| 2018 | 53461 | 0 | 0 | 0 | 0 | 7.8 | 4.15 | 12.38 |
| 2019 | 53907 | 0 | 0 | 0 | 0 | 7.98 | 4.2 | 13 |
| 2020 | 54902 | 0 | 0 | 0 | 0 | 8 | 4.28 | 12.86 |
| 2021 | 55832 | 0 | 0 | 0 | 0 | 8.1 | 4.613 | 13.5 |
| 2022 | 56876 | 0 | 0 | 0 | 0 | 8.39 | 4.7 | 13.5 |
| 2023 | 57918 | 7 | 0 | 0 | 0.0001196 | 8.5 | 4.71 | 13.86 |

## Interpretation rules

- A masked PSL/CIN cannot support a longitudinal factory panel.
- Missing unmet-demand rows are not treated as zero without documentation.
- Realized electricity cost is purchase expenditure divided by recorded kWh; it is not a tariff and is not composition-adjusted.
- Self-generation is descriptive and does not by itself identify grid unreliability.
- Verdict: reject a historical unmet-power dashboard. Purchased-electricity cost can be studied separately only after sector/composition adjustment and outlier controls.
