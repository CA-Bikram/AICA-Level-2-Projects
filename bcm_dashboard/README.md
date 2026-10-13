# BCM Open Items Dashboard (Sub Zone review)

The BCM PowerPoint review as a live dashboard. There is one slide per open-item type, laid out like the
presentation pivots. Pick a Sub Zone to filter every slide. Click any figure to list the items behind it.

## Run
Double-click `run_dashboard.bat`, or run `pip install -r requirements.txt` and then `streamlit run app.py`.
Upload the Excel file in the sidebar. Use **Load demo data** to try the dashboard with the sample files.

## Slides (agenda order)
| # | Slide | Sheet name | Pivot |
|---|---|---|---|
| 01 | Open GRN / SRNs (RNV) | `Open_GRN` | SubZone › SBU › MSME? › Profit center × Period (Nos, Rs. In Lakhs) |
| 02 | Open PRF / VIT | `VIT_PRF` | SubZone › SBU › Plant Name × Ageing (count), FY filter |
| 03 | FA Verification – Discrepancies | `FA_Discrepancy` | SubZone › SBU › ERP_LOCNNAME × Status (count) + action table |
| 04 | FA Verification status | `FA_Verification` | Location: Total, Verified, % (traffic light), Pending |
| 05 | MSTC Commission clearing | `MSTC` | SubZone › SBU › PC Name × Age bracket (days), amount |
| 06 | Open Road Claim | `Road_Claim` | Sub Zone › Profit Center × Ageing (<1, 1-2, 2-3, 3-5 Yr), amount |
| 07 | CWIP – Expired projects | `CWIP_Expired` | Project listing, AR value / Cum Exp / Capex / Open CWIP (Cr) |
| 08 | CWIP – expiring in 60 days | `CWIP_60` | Same as 07 |
| 09 | RFD – Assets held for sale > 12 M | `RFD` | Sub Zone › SBU › Plant × FY (count) |
| 10 | Open AMTA | `AMTA` | Sub Zone › SBU × Status with the action text on top (count) |
| 11 | Open Delivery Confirmations | `Delivery_Confirmation` | Sub Zone › SBU › Sales Org × Month (count) |
| 12 | Open Other Receivables | `Other_Receivables` | SubZone › SBU › PC › User › Customer › Entry date × Year, amount |
| 13 | Pending Cash Receipts | `Pending_CR` | Quarter (Q1 FY 2025-26 …): Count, Amt (Lakhs) |

* The headings are matched loosely. `Sub Zone`, `SubZone` and `ZONE_C` all work, for example. The **Data mapping &
  template** page shows which column was used for each slide. It also lets you download a blank template.
* Age, period, FY, month and quarter buckets are worked out from dates when the sheet has no bucket column.
  These use the "Status as on" date.
* To add a heading spelling or change a pivot, edit `bcm_config.py`. Each slide is a single block.
* **Previous status** (optional): upload last meeting's file in the sidebar. Each slide then shows a
  "Previous Status as on …" table under the current one.

Files: `app.py` (UI) · `bcm_config.py` (slide definitions) · `bcm_engine.py` (loading, pivots) ·
`bcm_render.py` (slide and table HTML, illustrations) · `bcm_core.py` (formatting helpers) ·
`make_sample.py` (demo data).
