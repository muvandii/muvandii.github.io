---
title: Retail Sales Consolidation
summary: Automated consolidation of monthly sales reports from 12 regional spreadsheets into one refreshable Power BI dashboard — cutting report preparation time by 72%.
category: Data Analytics
cover: images/cover.png
technologies:
  - Power Query
  - Excel
  - Power BI
  - DAX
order: 1
---

## Project Overview

Retail Sales Consolidation is an end-to-end reporting automation project. It replaces a manual, error-prone monthly reporting process — where 12 regional offices each submitted a differently-formatted Excel spreadsheet and the finance team spent up to three days stitching them together — with a single repeatable pipeline.

The pipeline extracts every regional workbook with Power Query, applies a standard cleaning and transformation layer, loads the result into a unified data model, and publishes a Power BI dashboard that refreshes with one click.

This document is the project's master documentation. It follows the portfolio standard: every project repository contains `documentation/project.md` (this file) and `documentation/modules.md` (module-by-module breakdown). All screenshots referenced below live in the repository's `images/` folder.

## Business Problem

The finance team at a mid-sized retail chain produced a monthly sales report using a fully manual process:

- 12 regional offices emailed spreadsheets with **inconsistent layouts** (different column names, merged cells, different currencies and date formats).
- Data entry errors — duplicated rows, missing store codes, text-formatted numbers — had to be found by eye.
- Producing the consolidated report took **2–3 working days** and the result was often already outdated by the time it was shared.
- There was no single source of truth: "sales last month" had three different answers depending on who you asked.

## Objectives

1. Reduce monthly report preparation time from ~3 days to under one hour.
2. Eliminate manual data entry and copy-paste errors in the consolidation step.
3. Create one repeatable, documented pipeline that works even when regional formats change.
4. Give management a self-service dashboard with consistent KPIs (revenue, units, returns, regional performance).
5. Make the whole process auditable — every transformation visible and re-runnable.

## Requirements

| Requirement | Detail |
|---|---|
| Input | 12 regional Excel workbooks (`.xlsx`), one folder per month |
| Output | One consolidated dataset + one Power BI dashboard |
| Refresh | Manual refresh with one click (no scheduled gateway required) |
| Tools | Excel 365, Power Query (M), Power BI Desktop, DAX |
| Quality bar | Zero duplicate rows; 100% of stores matched to the store master list; all monetary values in KES |
| Documentation | `project.md` + `modules.md` per the portfolio standard |

## Dataset & Data Sources

- **Source files:** 12 regional sales workbooks per month (`NAIROBI.xlsx`, `MOMBASA.xlsx`, `KISUMU.xlsx`, …), each with a `Sales` sheet containing ~2,000–5,000 rows.
- **Master data:** `store-master.xlsx` — store codes, regions, and store types used to validate and enrich the sales data.
- **Sample size:** ~36,000 rows/month consolidated; 12 months used for the demo dataset (~430,000 rows).
- **Note:** all data used here is **synthetic/sample data** — no confidential company data is included in this repository.

## Technologies Used

| Technology | Role |
|---|---|
| Excel 365 | Source data and initial exploration |
| Power Query (M Language) | Extraction, cleaning, transformation, and load (ETL) |
| Power BI Desktop | Data model, DAX measures, dashboard |
| DAX | KPIs and time intelligence measures |
| GitHub | Version control, documentation, and issue tracking |

## Project Architecture

```text
Regional spreadsheets (12 x .xlsx)
        │
        ▼
┌─────────────────────┐
│  Power Query ETL    │   Module 01 — Data Ingestion
│  (data-flow file)   │   Module 02 — Data Cleaning
└─────────────────────┘   Module 03 — Transformation
        │
        ▼
┌─────────────────────┐
│  Consolidated table │   One row per store per day
│  + dimension tables │   (store master, calendar)
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Power BI data model│   Star schema, DAX measures
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Executive Dashboard│   KPIs, trends, regional drill-down
└─────────────────────┘
```

## Overall Workflow

1. **Prepare:** place the 12 regional workbooks for the month into the `data/input/` folder.
2. **Refresh:** open the Power Query data-flow file (or the Power BI file) and click **Refresh**.
3. **Validate:** run the built-in validation checks (duplicates, unmatched stores, nulls).
4. **Publish:** open the dashboard, verify KPIs, and share the published report link.
5. **Archive:** move the month's source files to `data/archive/` (optional).

## Project Results

| Metric | Before | After | Improvement |
|---|---|---|---|
| Report preparation time | 2–3 days | ~40 minutes | **-72%** |
| Data entry errors | ~15–25 per report | 0 (validated at load) | **100% eliminated** |
| Single source of truth | No | Yes | — |
| Regional breakdown | Manual pivot | Drill-down in dashboard | — |
| Refresh effort | Rebuild everything | One click | — |

## Challenges & Solutions

| Challenge | Solution |
|---|---|
| Regional files had different column orders and names | A mapping table in Power Query translates each regional layout to the standard schema; documented in Module 01 |
| Text-formatted numbers caused wrong totals | Locale-aware `Number.FromText` conversion with error handling in Module 02 |
| Merged cells and title rows above the table | `Table.PromoteHeaders` with explicit column count and row-offset detection |
| Some stores appeared in sales but not in the master list | Validation step flags unmatched stores; a fallback mapping table keeps the load running while data is fixed |
| Duplicate rows after appending months | `Table.Distinct` on the natural key (store, date, SKU) plus a row-count check |

## Lessons Learned

- **Fix data at the source, not in the report.** Cleaning inside Power Query means the dashboard is always built on clean data.
- **A mapping layer is worth the investment.** The single most fragile part was regional format variance; one parameterized mapping table removed almost all of it.
- **Validation is a feature, not a chore.** Automated checks (row counts, unmatched keys, null rates) turned a "trust me" pipeline into an auditable one.
- **Document as you build.** Writing `modules.md` at the end is painful; capturing each module's decisions as you go pays off immediately.
- **Synthetic data keeps the repo shareable.** Publishing anonymized sample data made this repository public-safe.

## Screenshots / Evidence

![Power Query data cleaning steps](../images/screenshot-01.png)

![Power BI executive dashboard](../images/screenshot-02.png)

## Links & Resources

- [Repository README](../README.md)
- [Module-by-module documentation](modules.md)
- [Microsoft Learn — Power Query M reference](https://learn.microsoft.com/en-us/powerquery-m/)
- [DAX guide — Microsoft Learn](https://learn.microsoft.com/en-us/dax/)
