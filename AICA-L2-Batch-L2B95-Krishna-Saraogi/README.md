# OneHR Payroll Manager

Indian payroll and statutory compliance manager: employee master, attendance, monthly payroll with PF, ESIC, professional tax and TDS, salary slips, registers and bank advice, with maker-checker controls and an AI-assisted review.

Built as a capstone project for the ICAI AICA Level 2 course by CA Krishna Saraogi.

## Try it

| | |
|---|---|
| Live demo | https://onehr-payroll-manager.onrender.com |
| Sign-ins | `maker / Maker@2026`, `checker / Checker@2026`, `admin / Admin@2026` (also shown on the login page) |
| Source repository | https://github.com/cakrishnasaraogi/onehr-payroll-manager |

The demo runs on a free hosting plan, so the first load can take up to a minute. All data is fictional and resets when the service restarts. April to August 2026 are processed and locked; September 2026 is open, and the two files in `demo-files` (new joiners first, then attendance) can be uploaded to run it.

## What it does

| Area | Detail |
|---|---|
| Masters | Employees (simple or detailed salary structure), company profile, statutory settings, PT and tax slabs |
| Attendance | Daily grid for every employee in service each month, or Excel import with validation |
| Payroll | Pro-rata pay, joiners and leavers, 50% wage rule, PF (EPS/EPF split, EDLI, admin charges), ESIC, PT, TDS, gratuity accrual, company cost |
| TDS | New and old regime, year-to-date basis, rebate with marginal relief, surcharge, cess; step-by-step explanation per employee |
| Outputs | Payroll register (Excel), salary slips with income tax worksheet (PDF), bank transfer advice |
| Controls | Sign-in, three roles, lock/unlock with reason, audit trail |
| AI | Pre-lock exception review, management commentary, payslip question-and-answer |

## Where AI is used

1. **Building the tool.** The application was built with AI coding assistants (Google AI Studio and Claude) and reviewed by a Chartered Accountant.
2. **Inside the tool.** The *AI Review* screen:
   - lists month-on-month movements and pre-lock exceptions (computed by code, not by AI);
   - asks Google Gemini to write management commentary from those figures;
   - lets a user ask a question about one payslip, answered from that employee's stored computation.

All pay and tax figures are calculated by deterministic code with a test suite. The AI model never calculates pay, and employee names, PAN and bank details are never sent to it.

## Roles

| Role | Can do |
|---|---|
| Maker | Employee master, attendance, process payroll |
| Checker | Review, lock and unlock payroll (unlock needs a reason), view audit trail |
| Admin | Statutory settings, slabs, company profile, backup and restore, plus everything above |

Demo sign-ins (shown on the login page only in demo mode): `maker / Maker@2026`, `checker / Checker@2026`, `admin / Admin@2026`.
For real use, set `ADMIN_PASSWORD`, `MAKER_PASSWORD` and `CHECKER_PASSWORD` before the first start.

## Run locally

Needs Node.js 20 or later.

```
npm install
npm run dev
```

Open http://localhost:3000. On Windows, double-click `start-payroll.bat`: it builds the app, starts the server and opens the browser.

For a demonstration with fictional data, double-click `start-demo.bat`. It uses a separate `demo-data` folder: April to August 2026 are complete (attendance marked, payroll processed and locked) and September 2026 is open. The two files in `demo-files` (new joiners, then attendance) are uploaded to run September. The same data loads on any host started with `SEED_DEMO=true`.
To enable the AI functions, set `GEMINI_API_KEY` (see `.env.example`).

Run the calculation tests:

```
npm test
```

## Deploy

The app is a single Node.js service (Express + SQLite) that also serves the built front end.

```
npm install --include=dev && npm run build
npm start
```

`render.yaml` is included for one-click deployment on Render. On a host without a persistent disk the database is recreated at each restart, which suits a demo; for real use, set `DATA_DIR` to a persistent disk.

## Statutory basis (Tax Year 2026-27)

| Item | Rule applied |
|---|---|
| PF | 12% employee and employer on wages up to the ceiling in Settings (default ₹15,000); EPS 8.33% capped at ₹1,250; EDLI 0.5%; admin charges 0.5% |
| ESIC | 0.75% / 3.25% where gross is within ₹21,000; coverage continues to the end of the contribution period; rounded up to the next rupee |
| Professional tax | Monthly state slabs (Maharashtra, Karnataka, Telangana, West Bengal, Gujarat; Delhi nil), editable in Settings; February ₹300 in Maharashtra and Karnataka |
| TDS, new regime | Standard deduction ₹75,000; nil up to taxable income ₹12,00,000 with marginal relief; slabs 5% to 30% |
| TDS, old regime | Standard deduction ₹50,000; PT deduction; nil up to ₹5,00,000; slabs 5% / 20% / 30% |
| Both regimes | Surcharge above ₹50 lakh with marginal relief; 4% cess; tax spread over remaining months after TDS already deducted |
| Gratuity | Accrual at 15/26 of monthly wages, divided by 12 |

All rates and ceilings are in Settings so they can be updated when the law changes.

## Known limitations

- Old regime: only the employee PF deduction (up to ₹1,50,000) is built in. Other Chapter VI-A deductions, HRA and LTA exemptions are not captured, so old-regime TDS is on the high side.
- Previous-employer salary and TDS (for mid-year joiners) and other income declared by the employee are not captured.
- Earlier months of the tax year that were not processed in this system are assumed at the fixed monthly salary.
- Tamil Nadu professional tax (half-yearly, local-body rates) and the Maharashtra exemption for women up to ₹25,000 are not built in.
- The ₹500 monthly minimum for PF admin charges applies per establishment and is not applied.
- Statutory return files (PF ECR, ESIC return, Form 24Q) are not generated.
- Sessions are kept in memory, so users sign in again after a server restart.

This is a learning project. Verify statutory positions against current notifications before using it for a live payroll.
