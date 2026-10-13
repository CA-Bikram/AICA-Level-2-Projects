# -*- coding: utf-8 -*-
"""
Detailed Project Report
=======================
Project-finance tool for a Term Loan (hotel case study model).

* Enter numbers on the "Assumptions" tab.
* Press "Generate Report" to build:
      - Project Income Statement (with loan schedule, DSCR, IRR, payback, break-even)
      - Projected Balance Sheet
      - Projected Cash Flow Statement
* Save / load assumptions (JSON) and export all reports to Excel and PDF.

Libraries used
--------------
Standard library : tkinter, json, os, sys, copy      (ships with Python - nothing to install)
Third-party      : openpyxl  (for "Export to Excel"), reportlab (for "Export to PDF")

Install command (one line, run in CMD):
    python -m pip install openpyxl reportlab

Runs directly from IDLE: open this file and press F5.
All amounts are in Rs. Crores unless stated otherwise.
"""

import copy
import json
import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

APP_TITLE = "Detailed Project Report"

# --------------------------------------------------------------------------
# Colour palette (vibrant)
# --------------------------------------------------------------------------
PRIMARY = "#4527A0"    # deep purple
PRIMARY_D = "#311B92"
TEAL = "#00897B"
ORANGE = "#FB8C00"
PINK = "#D81B60"
BLUE = "#1E88E5"
GREEN = "#43A047"
RED = "#E53935"
YELLOW = "#FDD835"
BG = "#F3EFFB"
CARD = "#FFFFFF"

FONT = ("Segoe UI", 10)
FONT_B = ("Segoe UI", 10, "bold")
FONT_S = ("Segoe UI", 9)
FONT_H = ("Segoe UI", 12, "bold")
FONT_T = ("Segoe UI", 22, "bold")

# --------------------------------------------------------------------------
# Default assumptions (taken from "Hotel Case Study Financial Model Aug 2026")
# Percentages are stored as fractions (0.65 = 65 %).
# --------------------------------------------------------------------------
# How each cost item is capitalised for depreciation
CATS = [
    ("land", "Land (not depreciated)"),
    ("building", "Hotel Building"),
    ("equipment", "Kitchen Equipment & Machinery"),
    ("shared", "Shared: Building + Equipment"),
]
CAT_LABEL = dict(CATS)
CAT_KEY = {label: key for key, label in CATS}
MAX_ITEMS = 30
MAX_QUARTERS = 20        # construction period: 1 to 20 quarters (up to 5 years)
MAX_YEARS = 25           # repayment / projection period: 1 to 25 years


def new_item(name="New cost item", cost=0.0, margin=1.0, cat="building", bshare=0.5, phasing=None, nq=8):
    """One project-cost line. margin/bshare/phasing are fractions (0.25 = 25 %).
    phasing holds quarters 1..nq-1; the last quarter is always the balance (100 % - the rest)."""
    return {"name": name, "cost": cost, "margin": margin, "cat": cat, "bshare": bshare,
            "phasing": list(phasing) if phasing is not None else [0.0] * (nq - 1)}


DEFAULTS = {
    "project_name": "Hotel Case Study",
    "start_fy": 2024,
    "quarters": 8,          # construction period in quarters (dynamic: 1 - 20)
    # Cost items are dynamic: rename, add or remove them on the Assumptions tab.
    # Quarters 1-7 are inputs; quarter 8 is the balance (100 % - sum of the rest)
    "items": [
        new_item("Cost of Land [already acquired by the Company]", 20.0, 1.0, "land", 0.5,
                 [1.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00]),
        new_item("Cost of Approvals / Premiums & Regulatory Costs", 10.0, 0.5, "building", 0.5,
                 [0.25, 0.50, 0.10, 0.00, 0.00, 0.00, 0.10]),
        new_item("Cost of Construction of the Hotel Building", 40.0, 0.3, "building", 0.5,
                 [0.10, 0.20, 0.30, 0.35, 0.05, 0.00, 0.00]),
        new_item("Cost of Interiors & Kitchen Equipments", 50.0, 0.25, "equipment", 0.5,
                 [0.00, 0.00, 0.10, 0.10, 0.20, 0.20, 0.30]),
        new_item("Contingency Margin", 7.5, 1.0, "shared", 0.5,
                 [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.50]),
    ],
    "rate": 0.10,
    "tax": 0.33,
    "life_bldg": 40.0,
    "life_equip": 15.0,
    "room_share": 0.55,
    "fb_share": 0.30,
    "rooms": 125,
    "days": 365,
    "occ": 0.65,
    "occ_inc": 0.025,
    "occ_cap": 0.80,
    "tariff": 10000.0,
    "tariff_inc": 0.015,
    "exp_fb": 0.075,
    "exp_emp": 0.20,
    "exp_power": 0.06,
    "exp_oth": 0.04,
    "exp_service": 0.05,
    "admin": 0.20,
    "admin_inc": 0.10,
    "tenure": 10,           # term-loan repayment tenure in years (= projection period)
    "installments": 120,    # number of equal installments over the tenure (120 = monthly for 10 years)
    "repay_type": "stepped", # "stepped" (Hotel Case Study) or "equal" (Equal Installments)

    # ----------------------------------------------------------------------
    # Front Page Defaults: Title Block, Entity Details, Promoter Details
    # ----------------------------------------------------------------------
    "project_purpose": "Setting up a 125-Room Premium Business Hotel with Multi-Cuisine Restaurant & Banquet Facilities",
    "bank_name": "State Bank of India",
    "bank_branch": "Commercial & Industrial Finance Branch",
    "bank_address": "BKC Financial District, Bandra (East), Mumbai - 400051",
    "facility_term_loan": "Term Loan of Rs. 70.00 Crore",
    "facility_wc": "Working Capital / CC Limit of Rs. 5.00 Crore (Proposed)",
    "facility_total": "Rs. 75.00 Crore",
    "entity_name": "Grand Horizon Hospitality LLP",
    "constitution": "Limited Liability Partnership (LLP)",
    "reg_office": "Plot No. 42, Sector 18, Cyber City, Gurugram, Haryana - 122002",
    "unit_location": "Survey No. 118, Outer Ring Road, Near IT Corridor, Bengaluru, Karnataka - 560103",
    "contact_phone": "+91 98765 43210 / 080-23456789",
    "contact_email": "contact@grandhorizon.in",
    "contact_website": "www.grandhorizon.in",
    "date_incorporation": "15-Aug-2021",
    "pan": "AAAFG1234H",
    "gstin": "06AAAFG1234H1Z5",
    "udyam_number": "UDYAM-HR-03-0012345",
    "udyam_category": "Medium Enterprise",
    "cin_llpin": "AAY-9876",
    "other_licences": "FSSAI Lic. No. 10020011000123; State Pollution Control Board CTE No. PCB/2023/889; Fire Safety NOC No. FS/2023/452",
    "promoter_details": "1. Mr. Rajesh Kumar Sharma - Designated Partner (40% Share, 22 yrs exp. in Hospitality)\n2. Mrs. Priya R. Sharma - Designated Partner (35% Share, MBA Finance, 18 yrs exp.)\n3. Mr. Amit Verma - Technical Partner (25% Share, B.Tech Civil, 15 yrs exp.)",
    "auth_signatory_name": "Mr. Rajesh Kumar Sharma",
    "auth_signatory_desig": "Designated Partner",
    "auth_signatory_mobile": "+91 98765 43210",
    "auth_signatory_email": "rajesh.sharma@grandhorizon.in",
    "credit_relationship": "Current Account with State Bank of India (A/c No. 39876543210, Branch: BKC Mumbai). Conduct of account is fully satisfactory. Promoters have clean credit history with CIBIL scores above 780. No overdue borrowings or defaults.",
}

CONSTITUTION_OPTIONS = [
    "Proprietorship",
    "Partnership",
    "Limited Liability Partnership (LLP)",
    "Private Limited Company",
    "Public Limited Company",
    "Trust",
    "Society",
    "Cooperative Society",
]

UDYAM_CATEGORIES = [
    "Micro Enterprise",
    "Small Enterprise",
    "Medium Enterprise",
    "Not Applicable",
]

FRONT_PAGE_KEYS = [
    "project_purpose", "bank_name", "bank_branch", "bank_address",
    "facility_term_loan", "facility_wc", "facility_total",
    "entity_name", "constitution", "reg_office", "unit_location",
    "contact_phone", "contact_email", "contact_website", "date_incorporation",
    "pan", "gstin", "udyam_number", "udyam_category", "cin_llpin", "other_licences",
    "promoter_details", "auth_signatory_name", "auth_signatory_desig",
    "auth_signatory_mobile", "auth_signatory_email", "credit_relationship"
]

REPAY_PROFILES = [
    ("stepped", "Stepped / Balloon (Hotel Case Study: 2.5%, 5%, 7.5%, 10%, 12.5% x 6)"),
    ("equal", "Equal Installments (Spread evenly based on installment count)"),
]
REPAY_LABELS = {k: v for k, v in REPAY_PROFILES}
REPAY_KEYS = {v: k for k, v in REPAY_PROFILES}

# key, label, kind, unit text, min, max      (pct inputs are typed as 65 for 65 %)
S_FINANCE = [
    ("rate", "Rate of interest on term loan", "pct", "% p.a.", 0, 100),
    ("tax", "Corporate income tax rate", "pct", "%", 0, 100),
]
S_DEPREC = [
    ("life_bldg", "Useful life - hotel building", "num", "years", 1, 100),
    ("life_equip", "Useful life - kitchen equipment & machinery", "num", "years", 1, 100),
]
S_MIX = [
    ("room_share", "Room revenue", "pct", "% of total", 0.0001, 100),
    ("fb_share", "Food & beverage", "pct", "% of total", 0, 100),
]
S_OPER = [
    ("rooms", "Total number of rooms", "int", "rooms", 1, 100000),
    ("days", "Days in a year rooms are offered", "int", "days", 1, 366),
    ("occ", "Occupancy - first operating year", "pct", "%", 0, 100),
    ("occ_inc", "Yearly increase in occupancy", "pct", "% points", 0, 100),
    ("occ_cap", "Maximum occupancy (cap)", "pct", "%", 0, 100),
    ("tariff", "Tariff per room per day", "num", "Rs.", 0, None),
    ("tariff_inc", "Annual increase in room tariff", "pct", "%", -100, 1000),
]
S_EXP = [
    ("exp_fb", "Food & beverages consumables", "pct", "% of revenue", 0, 100),
    ("exp_emp", "Employee costs", "pct", "% of revenue", 0, 100),
    ("exp_power", "Power & fuel", "pct", "% of revenue", 0, 100),
    ("exp_oth", "Other variable expenses", "pct", "% of revenue", 0, 100),
    ("exp_service", "Service fees to Marriott", "pct", "% of room revenue", 0, 100),
    ("admin", "Administrative & selling expenses (year 1)", "pct", "% of revenue", 0, 100),
    ("admin_inc", "Annual increase in administrative expenses", "pct", "%", -100, 1000),
]
S_GENERAL = [
    ("start_fy", "First construction year starts in", "int", "(e.g. 2024 = FY 2024-25)", 1990, 2100),
]
S_REPAY = [
    ("tenure", "Term loan repayment tenure", "int", "years", 1, MAX_YEARS),
    ("installments", "Number of installments", "int", "equal installments over the tenure", 1, None),
]
ALL_SCALARS = S_GENERAL + S_FINANCE + S_DEPREC + S_MIX + S_OPER + S_EXP + S_REPAY


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def fy_label(y):
    return "%d-%02d" % (y, (y + 1) % 100)


def disp(v, pct=False):
    """Number -> clean text for an input box."""
    if pct:
        v = v * 100.0
    v = round(float(v), 6)
    s = ("%.6f" % v).rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


def repayment_schedule(tenure, installments):
    """Number of installments falling in each year of the tenure.

    Installments are equal and spread evenly over the tenure: installment k falls due
    k * tenure / installments years after repayment starts and is booked in that year
    (12 installments over 3 years -> 4 a year;  5 over 10 years -> one every second year)."""
    counts = [0] * tenure
    for k in range(1, installments + 1):
        year = -((-k * tenure) // installments)      # ceil(k * tenure / installments), integer maths
        counts[year - 1] += 1
    return counts


def cell_fmt(v):
    """Rs. Crore figure for a calculated table cell ('-' for zero, like the Excel sheet)."""
    if v is None:
        return ""
    return "-" if abs(v) < 0.005 else "{:,.2f}".format(v)


def fmt_val(v, f):
    """Format a report value for display."""
    if v is None or v == "":
        return ""
    if isinstance(v, str):
        return v
    if f == "pct":
        return "%.2f%%" % (v * 100.0)
    if f == "x":
        return "%.2fx" % v
    if f == "num0":
        return "{:,.0f}".format(v)
    if f == "yrs":
        return "%.2f years" % v
    if f == "int":
        return str(int(v))
    if abs(v) < 0.005:
        v = 0.0
    return "{:,.2f}".format(v)


def irr(flows):
    """Internal rate of return by bisection (no external libraries)."""
    def npv(r):
        return sum(cf / ((1.0 + r) ** t) for t, cf in enumerate(flows))
    lo, hi = -0.99, 10.0
    flo, fhi = npv(lo), npv(hi)
    if flo * fhi > 0:
        return None
    for _ in range(300):
        mid = (lo + hi) / 2.0
        fm = npv(mid)
        if flo * fm <= 0:
            hi, fhi = mid, fm
        else:
            lo, flo = mid, fm
    return (lo + hi) / 2.0


# --------------------------------------------------------------------------
# Calculation engine
# --------------------------------------------------------------------------
def compute(a):
    """All project-finance calculations. Returns a dictionary of results."""
    N = int(a["tenure"])                     # operating years = repayment tenure
    rate = a["rate"]
    items = a["items"]
    n = len(items)
    cost = [it["cost"] for it in items]
    margin = [it["margin"] for it in items]

    # ---- Construction period: nq quarters, grouped into financial years ---
    nq = int(a["quarters"])
    ny = (nq + 3) // 4                       # number of construction years

    def ysum(lst):                           # quarter list -> year totals
        return [sum(lst[4 * k:4 * k + 4]) for k in range(ny)]

    # ---- Cost phasing: quarters 1..nq-1 are inputs, the last is the balance ---
    phasing = []
    for it in items:
        ph = list(it["phasing"])[:nq - 1]
        ph += [0.0] * (nq - 1 - len(ph))
        phasing.append(ph + [1.0 - sum(ph)])
    cost_q = [[cost[i] * phasing[i][q] for q in range(nq)] for i in range(n)]
    prom_q = [[cost_q[i][q] * margin[i] for q in range(nq)] for i in range(n)]
    bank_q = [[cost_q[i][q] - prom_q[i][q] for q in range(nq)] for i in range(n)]
    tot_q = [sum(cost_q[i][q] for i in range(n)) for q in range(nq)]
    prom_tot_q = [sum(prom_q[i][q] for i in range(n)) for q in range(nq)]
    bank_tot_q = [sum(bank_q[i][q] for i in range(n)) for q in range(nq)]

    # ---- Term-loan draw-down and interest during construction ------------
    idc_q, opening = [], 0.0
    dd_open, dd_close, dd_avg = [], [], []
    for q in range(nq):
        closing = opening + bank_tot_q[q]
        dd_open.append(opening)
        dd_close.append(closing)
        dd_avg.append((opening + closing) / 2.0)
        idc_q.append(dd_avg[-1] * rate * 3.0 / 12.0)
        opening = closing
    idc = sum(idc_q)
    idc_y = ysum(idc_q)

    prom_item = [cost[i] * margin[i] for i in range(n)]
    bank_item = [cost[i] - prom_item[i] for i in range(n)]
    core = sum(cost)
    core_prom, core_bank = sum(prom_item), sum(bank_item)
    total_cost = core + idc
    total_prom = core_prom + idc            # IDC is funded 100 % by promoters
    total_bank = core_bank
    loan = total_bank

    cost_y = ysum(tot_q)
    out_y = [cost_y[k] + idc_y[k] for k in range(ny)]
    equity_y = [ysum(prom_tot_q)[k] + idc_y[k] for k in range(ny)]
    debt_y = ysum(bank_tot_q)

    # ---- Depreciation -----------------------------------------------------
    # Each item is capitalised to Building / Equipment / Land / a split of the two.
    # Interest during construction is shared 50:50 between building and equipment.
    # ---- Depreciation -----------------------------------------------------
    # Matches exactly the format and structure of 'Hotel Case Study Financial Model Aug 2026.xlsx'
    # Base Cost: Hotel Building (40.0), Kitchen Equipment (50.0)
    # Cost of Approvals (10.0) -> allocated to Hotel Building
    # Contingency Margin (7.5) -> split 50:50 (3.75 each)
    # Interest During Construction (IDC) -> split 50:50
    bldg_base = 0.0
    equip_base = 0.0
    approvals_cost = 0.0
    contingency_cost = 0.0
    for it in items:
        nl = it["name"].lower()
        if "approval" in nl or "regulatory" in nl:
            approvals_cost += it["cost"]
        elif "contingency" in nl or it["cat"] == "shared":
            contingency_cost += it["cost"]
        elif it["cat"] == "building" or "construction" in nl or "building" in nl:
            bldg_base += it["cost"]
        elif it["cat"] == "equipment" or "interior" in nl or "kitchen" in nl:
            equip_base += it["cost"]

    if bldg_base == 0.0 and equip_base == 0.0:
        for it in items:
            if it["cat"] == "building": bldg_base += it["cost"]
            elif it["cat"] == "equipment": equip_base += it["cost"]
            elif it["cat"] == "shared": contingency_cost += it["cost"]

    bldg_cost = bldg_base + approvals_cost + contingency_cost / 2.0 + idc / 2.0
    equip_cost = equip_base + contingency_cost / 2.0 + idc / 2.0
    main_tbl = [
        [bldg_base, approvals_cost, contingency_cost / 2.0, idc / 2.0, bldg_cost],
        [equip_base, 0.0, contingency_cost / 2.0, idc / 2.0, equip_cost],
    ]
    dep_b = bldg_cost / a["life_bldg"]
    dep_e = equip_cost / a["life_equip"]
    dep = dep_b + dep_e

    # ---- Operating years --------------------------------------------------
    occ, tariff = [], []
    for i in range(N):
        if i == 0:
            occ.append(a["occ"])
            tariff.append(a["tariff"])
        else:
            occ.append(min(a["occ_cap"], occ[-1] + a["occ_inc"]))
            tariff.append(tariff[-1] * (1.0 + a["tariff_inc"]))

    room = [a["rooms"] * a["days"] * occ[i] * tariff[i] / 1e7 for i in range(N)]
    fb = [r * a["fb_share"] / a["room_share"] for r in room]
    others_share = a.get("others_share", max(0.0, 1.0 - a.get("room_share", 0.0) - a.get("fb_share", 0.0)))
    oth = [r * others_share / a["room_share"] for r in room]
    rev = [room[i] + fb[i] + oth[i] for i in range(N)]

    v_fb = [r * a["exp_fb"] for r in rev]
    v_emp = [r * a["exp_emp"] for r in rev]
    v_pow = [r * a["exp_power"] for r in rev]
    v_oth = [r * a["exp_oth"] for r in rev]
    v_srv = [r * a["exp_service"] for r in room]
    var_tot = [v_fb[i] + v_emp[i] + v_pow[i] + v_oth[i] + v_srv[i] for i in range(N)]

    admin = []
    for i in range(N):
        admin.append(rev[0] * a["admin"] if i == 0 else admin[-1] * (1.0 + a["admin_inc"]))

    # ---- Term-loan repayment schedule ------------------------------------
    repay_type = a.get("repay_type", "stepped")
    inst_n = int(a.get("installments", 120))
    if repay_type == "stepped" and N == 10:
        rep_pct = [0.025, 0.05, 0.075, 0.10, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]
        inst_y = [round(p * inst_n) for p in rep_pct]
        inst_y[-1] = inst_n - sum(inst_y[:-1])
    else:
        inst_y = repayment_schedule(N, inst_n)
        rep_pct = [c / float(inst_n) for c in inst_y]
        rep_pct[-1] = 1.0 - sum(rep_pct[:-1])
    l_open, l_rep, l_close, l_avg, l_int = [], [], [], [], []
    bal = loan
    for i in range(N):
        l_open.append(bal)
        rp = loan * rep_pct[i]
        l_rep.append(rp)
        bal = bal - rp
        l_close.append(bal)
        l_avg.append((l_open[i] + bal) / 2.0)
        l_int.append(l_avg[i] * rate)

    # straight-line depreciation; each asset stops depreciating when its useful life ends
    def life_frac(i, life):
        return max(0.0, min(1.0, life - i))
    depr = [dep_b * life_frac(i, a["life_bldg"]) + dep_e * life_frac(i, a["life_equip"]) for i in range(N)]
    fixed = [admin[i] + depr[i] + l_int[i] for i in range(N)]
    total_exp = [var_tot[i] + fixed[i] for i in range(N)]
    pbt = [rev[i] - total_exp[i] for i in range(N)]
    tax = [max(0.0, pbt[i] * a["tax"]) for i in range(N)]   # no negative tax on losses
    pat = [pbt[i] - tax[i] for i in range(N)]

    # ---- DSCR -------------------------------------------------------------
    cfads = [pat[i] + l_int[i] + depr[i] for i in range(N)]
    debt_service = [l_int[i] + l_rep[i] for i in range(N)]
    dscr = [cfads[i] / debt_service[i] if debt_service[i] > 1e-12 else None for i in range(N)]
    ds_sum = sum(debt_service)
    avg_dscr = sum(cfads) / ds_sum if ds_sum > 1e-12 else None
    valid = [d for d in dscr if d is not None]
    min_dscr = min(valid) if valid else None

    # ---- IRR / Payback ----------------------------------------------------
    terminal = total_cost - sum(depr)
    T = ny + N                               # total columns: construction + operating years
    irr_cf = [0.0] * T
    irr_tv = [0.0] * T
    irr_out = [0.0] * T
    for i in range(N):
        irr_cf[ny + i] = cfads[i]
    irr_tv[T - 1] = terminal
    for k in range(ny):
        irr_out[k] = -out_y[k]
    irr_tot = [irr_cf[i] + irr_tv[i] + irr_out[i] for i in range(T)]
    project_irr = irr(irr_tot)
    avg_cf = sum(cfads) / N
    payback = total_cost / avg_cf if avg_cf > 1e-12 else None

    # ---- Break-even -------------------------------------------------------
    contrib = [rev[i] - var_tot[i] for i in range(N)]
    pv = [contrib[i] / rev[i] if rev[i] > 1e-12 else 0.0 for i in range(N)]
    bep = [fixed[i] / pv[i] if pv[i] > 1e-12 else None for i in range(N)]
    bep_pct = [bep[i] / rev[i] if bep[i] is not None else None for i in range(N)]
    fixed_cash = [fixed[i] - depr[i] for i in range(N)]
    cbep = [fixed_cash[i] / pv[i] if pv[i] > 1e-12 else None for i in range(N)]
    cbep_pct = [cbep[i] / rev[i] if cbep[i] is not None else None for i in range(N)]

    # ---- Cash flow statement (construction years + 10 operating years) -----
    zc, z10 = [0.0] * ny, [0.0] * N
    cf_npat = zc + pat
    cf_dep = zc + depr
    cf_cap = list(equity_y) + z10
    cf_debt = list(debt_y) + z10
    cf_funds = [cf_npat[i] + cf_dep[i] + cf_cap[i] + cf_debt[i] for i in range(T)]
    cf_fa = list(out_y) + z10
    cf_rep = zc + l_rep
    cf_out = [cf_fa[i] + cf_rep[i] for i in range(T)]
    cf_surplus = [cf_funds[i] - cf_out[i] for i in range(T)]
    cf_open, cf_close, bal = [], [], 0.0
    for i in range(T):
        cf_open.append(bal)
        bal += cf_surplus[i]
        cf_close.append(bal)

    # ---- Balance sheet ----------------------------------------------------
    def running(lst):
        out, tot = [], 0.0
        for v in lst:
            tot += v
            out.append(tot)
        return out

    gross = zc + [total_cost] * N
    accdep = zc + running(depr)
    net = [gross[i] - accdep[i] for i in range(T)]
    cwip = running(out_y) + z10
    cash = cf_close
    assets = [net[i] + cwip[i] + cash[i] for i in range(T)]
    equity = running(equity_y)
    equity = equity + [equity[-1]] * N
    reserves = zc + running(pat)
    networth = [equity[i] + reserves[i] for i in range(T)]
    bank_loan = running(debt_y) + l_close
    liab = [networth[i] + bank_loan[i] for i in range(T)]
    diff = [liab[i] - assets[i] for i in range(T)]

    fy0 = a["start_fy"]
    con_years = [fy_label(fy0 + i) for i in range(ny)]
    ops_years = [fy_label(fy0 + ny + i) for i in range(N)]

    return dict(
        N=N, nq=nq, ny=ny, con_years=con_years, ops_years=ops_years, all_years=con_years + ops_years,
        cost_item=cost, prom_item=prom_item, bank_item=bank_item,
        core=core, core_prom=core_prom, core_bank=core_bank,
        idc=idc, total_cost=total_cost, total_prom=total_prom, total_bank=total_bank,
        loan=loan, out_y=out_y, dep=dep, dep_b=dep_b, dep_e=dep_e,
        cost_q=cost_q, prom_q=prom_q, bank_q=bank_q, tot_q=tot_q,
        prom_tot_q=prom_tot_q, bank_tot_q=bank_tot_q,
        dd_open=dd_open, dd_close=dd_close, dd_avg=dd_avg, idc_q=idc_q,
        cost_y=cost_y, idc_y=idc_y, main_tbl=main_tbl,
        occ=occ, tariff=tariff, room=room, fb=fb, oth=oth, rev=rev,
        v_fb=v_fb, v_emp=v_emp, v_pow=v_pow, v_oth=v_oth, v_srv=v_srv, var_tot=var_tot,
        admin=admin, depr=depr, l_int=l_int, fixed=fixed, total_exp=total_exp,
        pbt=pbt, tax=tax, pat=pat,
        rep_pct=rep_pct, inst_y=inst_y, inst_n=inst_n, l_open=l_open, l_rep=l_rep, l_close=l_close, l_avg=l_avg,
        cfads=cfads, debt_service=debt_service, dscr=dscr, avg_dscr=avg_dscr, min_dscr=min_dscr,
        irr_cf=irr_cf, irr_tv=irr_tv, irr_out=irr_out, irr_tot=irr_tot, irr=project_irr,
        avg_cf=avg_cf, payback=payback,
        contrib=contrib, pv=pv, bep=bep, bep_pct=bep_pct,
        fixed_cash=fixed_cash, cbep=cbep, cbep_pct=cbep_pct,
        cf_npat=cf_npat, cf_dep=cf_dep, cf_cap=cf_cap, cf_debt=cf_debt, cf_funds=cf_funds,
        cf_fa=cf_fa, cf_rep=cf_rep, cf_out=cf_out, cf_surplus=cf_surplus,
        cf_open=cf_open, cf_close=cf_close,
        gross=gross, accdep=accdep, net=net, cwip=cwip, cash=cash, assets=assets,
        equity=equity, reserves=reserves, networth=networth, bank_loan=bank_loan,
        liab=liab, diff=diff, repay_type=repay_type,
    )


def build_reports(a, R):
    """
    Turn results into report tables.
    Row = (kind, label, values, fmt); kind: head, section, row, total, grand, check, blank, note
    """
    N = R["N"]
    ops, allf = R["ops_years"], R["all_years"]
    NOTE = ("note", "All amounts in Rs. in Crores", [], "num")
    BL = ("blank", "", [], "num")

    def nn(lst):                       # None -> "n/a"
        return [("n/a" if v is None else v) for v in lst]

    # ------------------------- Project Income Statement -------------------
    IS = [
        ("head", "Particulars", ops, "num"),
        NOTE,
        ("row", "Occupancy Assumed", R["occ"], "pct"),
        ("row", "Room Tariff per day (Rs.)", R["tariff"], "num0"),
        ("section", "Total Revenues during the Year:", [], "num"),
        ("row", "Room revenues", R["room"], "num"),
        ("row", "Food & Beverages", R["fb"], "num"),
        ("row", "Other Sources", R["oth"], "num"),
        ("total", "Total Revenues during the Year [A]", R["rev"], "num"),
        ("section", "Total Expenditure for the Year:", [], "num"),
        ("section", "Variable Expenses:", [], "num"),
        ("row", "Food & Beverages Consumables", R["v_fb"], "num"),
        ("row", "Employee Costs", R["v_emp"], "num"),
        ("row", "Power & Fuel", R["v_pow"], "num"),
        ("row", "Other Variable Expenses", R["v_oth"], "num"),
        ("row", "Service Fees to Marriott [Room revenue]", R["v_srv"], "num"),
        ("total", "Total Variable Expenses [B]", R["var_tot"], "num"),
        ("section", "Fixed Expenses:", [], "num"),
        ("row", "Administrative & Selling Expenses", R["admin"], "num"),
        ("row", "Depreciation", R["depr"], "num"),
        ("row", "Interest on Term Loan", R["l_int"], "num"),
        ("total", "Total Fixed Expenses [C]", R["fixed"], "num"),
        ("total", "Total Expenditure for the Year [D=B+C]", R["total_exp"], "num"),
        ("total", "Net Profit Before Tax [E=A-D]", R["pbt"], "num"),
        ("row", "[-] Tax", R["tax"], "num"),
        ("grand", "Net Profit After Tax", R["pat"], "num"),
        BL,
        ("head", "Term Loan Repayment Schedule", ops, "num"),
        ("row", "Number of Installments in the Year", R["inst_y"], "int"),
        ("row", "Repayment for the Year in %age", R["rep_pct"], "pct"),
        ("row", "Opening Balance", R["l_open"], "num"),
        ("row", "[-] Repayment", R["l_rep"], "num"),
        ("row", "Closing Balance", R["l_close"], "num"),
        ("row", "Average Balance", R["l_avg"], "num"),
        ("total", "Interest on Term Loan", R["l_int"], "num"),
        BL,
        ("head", "Debt Service Coverage Ratio", ops, "num"),
        ("row", "Net Profit After tax", R["pat"], "num"),
        ("row", "[+] Interest Payment During the Year", R["l_int"], "num"),
        ("row", "[+] Depreciation for the year", R["depr"], "num"),
        ("total", "Total Cash-flow available for servicing the debt", R["cfads"], "num"),
        ("row", "Interest Payment During the Year", R["l_int"], "num"),
        ("row", "[+] Principal Repayment during the year", R["l_rep"], "num"),
        ("total", "Total Debt repayment during the Year", R["debt_service"], "num"),
        ("grand", "Debt Service Coverage Ratio [in times]", nn(R["dscr"]), "x"),
        ("grand", "Average DSCR [in times]",
         ["n/a" if R["avg_dscr"] is None else R["avg_dscr"]], "x"),
        BL,
        ("head", "Internal Rate of Return", allf, "num"),
        ("row", "Cash-Flow After Tax", R["irr_cf"], "num"),
        ("row", "[+] Terminal Value of Fixed Assets", R["irr_tv"], "num"),
        ("row", "Project Cash Outflow", R["irr_out"], "num"),
        ("total", "Total Cash-Flows", R["irr_tot"], "num"),
        ("grand", "Internal Rate of Return", ["n/a" if R["irr"] is None else R["irr"]], "pct"),
        BL,
        ("head", "Pay-Back Period", ops, "num"),
        ("row", "Total Cash-flow available for servicing the debt", R["cfads"], "num"),
        ("row", "Average Cash-Flows", [R["avg_cf"]], "num"),
        ("row", "Cost of Project", [R["total_cost"]], "num"),
        ("grand", "Simple Pay-Back Period",
         ["n/a" if R["payback"] is None else R["payback"]], "yrs"),
        BL,
        ("head", "Break-Even Point", ops, "num"),
        ("row", "Total Sales [A]", R["rev"], "num"),
        ("row", "[-] Variable Cost [B]", R["var_tot"], "num"),
        ("total", "Contribution [C=A-B]", R["contrib"], "num"),
        ("row", "Profit Volume Ratio [D=C/A]", R["pv"], "pct"),
        ("row", "Fixed Costs [E]", R["fixed"], "num"),
        ("row", "Net Profit Before Tax [F=C-E]", R["pbt"], "num"),
        ("total", "Break-Even Point [E/D]", nn(R["bep"]), "num"),
        ("row", "BEP as a %age of Sales", nn(R["bep_pct"]), "pct"),
        ("row", "Fixed Costs excluding Depreciation", R["fixed_cash"], "num"),
        ("total", "Cash-Break Even Point", nn(R["cbep"]), "num"),
        ("row", "Cash Break Even Point as %age of sales", nn(R["cbep_pct"]), "pct"),
    ]

    # ------------------------- Projected Balance Sheet --------------------
    BS = [
        ("head", "Particulars", allf, "num"),
        NOTE,
        ("section", "Assets:", [], "num"),
        ("row", "Gross Block", R["gross"], "num"),
        ("row", "[-] Accumulated Depreciation", R["accdep"], "num"),
        ("total", "Net Block", R["net"], "num"),
        ("row", "Capital Work in Progress", R["cwip"], "num"),
        ("row", "Cash & Bank Balance", R["cash"], "num"),
        ("grand", "Total Assets", R["assets"], "num"),
        ("section", "Liabilities:", [], "num"),
        ("row", "Core Equity Capital", R["equity"], "num"),
        ("row", "[+] Reserves & Surplus", R["reserves"], "num"),
        ("total", "Net Worth", R["networth"], "num"),
        ("row", "Bank Loan", R["bank_loan"], "num"),
        ("grand", "Total Liabilities", R["liab"], "num"),
    ]

    # ------------------------- Projected Cash Flow Statement --------------
    CF = [
        ("head", "Particulars", allf, "num"),
        NOTE,
        ("section", "Sources of Finance:", [], "num"),
        ("row", "Net Profit After Tax", R["cf_npat"], "num"),
        ("row", "[+] Depreciation", R["cf_dep"], "num"),
        ("row", "[+] Capital Infusion", R["cf_cap"], "num"),
        ("row", "[+] Debt Capital Raised", R["cf_debt"], "num"),
        ("total", "Total Funds Infused [A]", R["cf_funds"], "num"),
        ("section", "Use of Funds:", [], "num"),
        ("row", "Fixed Assets Purchased", R["cf_fa"], "num"),
        ("row", "Term Loan Repaid", R["cf_rep"], "num"),
        ("total", "Total Out-Flow [B]", R["cf_out"], "num"),
        ("total", "Surplus [A-B]", R["cf_surplus"], "num"),
        ("row", "Opening Balance", R["cf_open"], "num"),
        ("grand", "Closing Balance", R["cf_close"], "num"),
    ]
    return IS, BS, CF


def front_page_rows(a, R):
    """Front page summary rows for Excel export."""
    rows = [
        ("head", "DETAILED PROJECT REPORT (DPR)", ["PARTICULARS / DETAILS"], "text"),
        ("section", "1. Title Block & Financing Facilities Sought", [], "text"),
        ("row", "Document Title", ["Detailed Project Report (DPR)"], "text"),
        ("row", "Project Name", [a.get("project_name", "")], "text"),
        ("row", "Project Purpose / Activity", [a.get("project_purpose", "")], "text"),
        ("row", "Submitted To (Bank Name)", [a.get("bank_name", "")], "text"),
        ("row", "Bank Branch", [a.get("bank_branch", "")], "text"),
        ("row", "Bank Branch Address", [a.get("bank_address", "")], "text"),
        ("row", "Facility Sought - Term Loan", [a.get("facility_term_loan", "")], "text"),
        ("row", "Facility Sought - Working Capital", [a.get("facility_wc", "")], "text"),
        ("row", "Total Facilities Proposed", [a.get("facility_total", "")], "text"),
        ("row", "Calculated Model Term Loan (Rs. Cr)", [R["total_bank"]], "num"),
        ("section", "2. Entity Details", [], "text"),
        ("row", "Name of the Entity (as per registration)", [a.get("entity_name", "")], "text"),
        ("row", "Constitution", [a.get("constitution", "")], "text"),
        ("row", "Date of Incorporation / Commencement", [a.get("date_incorporation", "")], "text"),
        ("row", "Registered Office Address", [a.get("reg_office", "")], "text"),
        ("row", "Project / Unit Location (if different)", [a.get("unit_location", "")], "text"),
        ("row", "Contact Phone", [a.get("contact_phone", "")], "text"),
        ("row", "Contact Email", [a.get("contact_email", "")], "text"),
        ("row", "Website", [a.get("contact_website", "")], "text"),
        ("section", "Statutory & Regulatory Registrations", [], "text"),
        ("row", "Permanent Account Number (PAN)", [a.get("pan", "")], "text"),
        ("row", "GST Identification Number (GSTIN)", [a.get("gstin", "")], "text"),
        ("row", "Udyam (MSME) Registration Number", [a.get("udyam_number", "")], "text"),
        ("row", "Udyam Enterprise Category", [a.get("udyam_category", "")], "text"),
        ("row", "CIN / LLPIN (for Companies and LLPs)", [a.get("cin_llpin", "")], "text"),
        ("row", "Other Licences & Statutory Consents", [a.get("other_licences", "")], "text"),
        ("section", "3. Promoter / Management Details", [], "text"),
        ("row", "Names & Designations of Proprietor, Partners or Directors", [a.get("promoter_details", "")], "text"),
        ("row", "Authorised Signatory - Name", [a.get("auth_signatory_name", "")], "text"),
        ("row", "Authorised Signatory - Designation", [a.get("auth_signatory_desig", "")], "text"),
        ("row", "Authorised Signatory - Mobile", [a.get("auth_signatory_mobile", "")], "text"),
        ("row", "Authorised Signatory - Email", [a.get("auth_signatory_email", "")], "text"),
        ("row", "CIBIL / Credit Relationship & Existing Bankers", [a.get("credit_relationship", "")], "text"),
    ]
    return rows


def assumption_rows(a, R):
    """Assumption summary used for the Excel export."""
    rows = [("head", "Assumption", ["Value"], "num")]
    rows += [
        ("section", "General", [], "num"),
        ("row", "Project name", [a["project_name"]], "text"),
        ("row", "First construction year", [fy_label(a["start_fy"])], "text"),
        ("section", "Total Project Cost (Rs. in Crores)", [], "num"),
        ("head", "Particulars", ["Total Cost", "Margin Requirement", "Promoter's Contribution",
                                   "Bank Finance"], "num"),
    ]
    for i, it in enumerate(a["items"]):
        rows.append(("row", it["name"], [it["cost"], it["margin"], R["prom_item"][i],
                                          R["bank_item"][i]],
                     ["num", "pct", "num", "num"]))
    rows.append(("total", "Core Project Cost [A]", [R["core"], "", R["core_prom"], R["core_bank"]], "num"))
    rows.append(("row", "Interest During Construction [B]", [R["idc"], 1.0, R["idc"], 0.0],
                 ["num", "pct", "num", "num"]))
    rows.append(("grand", "Total Project Cost [A+B]", [R["total_cost"], "", R["total_prom"], R["total_bank"]], "num"))
    rows.append(("blank", "", [], "num"))
    rows.append(("head", "Cost Phasing in %age", ["Q%d" % (q + 1) for q in range(R["nq"])], "num"))
    for it in a["items"]:
        ph = list(it["phasing"])
        rows.append(("row", it["name"], ph[:R["nq"] - 1] + [1.0 - sum(ph[:R["nq"] - 1])], "pct"))
    rows.append(("section", "Finance, Tax & Depreciation", [], "num"))
    single = [
        ("Rate of interest on term loan", a["rate"], "pct"),
        ("Corporate income tax", a["tax"], "pct"),
        ("Useful life - hotel building (years)", a["life_bldg"], "num"),
        ("Useful life - kitchen equipment (years)", a["life_equip"], "num"),
        ("Proportion in revenue - Room", a["room_share"], "pct"),
        ("Proportion in revenue - Food & Beverage", a["fb_share"], "pct"),
        ("Proportion in revenue - Others", a.get("others_share", max(0.0, 1.0 - a.get("room_share", 0.0) - a.get("fb_share", 0.0))), "pct"),
        ("Total number of rooms", a["rooms"], "int"),
        ("Days rooms offered per year", a["days"], "int"),
        ("Occupancy - first year", a["occ"], "pct"),
        ("Yearly increase in occupancy", a["occ_inc"], "pct"),
        ("Maximum occupancy (cap)", a["occ_cap"], "pct"),
        ("Tariff per room per day (Rs.)", a["tariff"], "num0"),
        ("Annual increase in room tariff", a["tariff_inc"], "pct"),
        ("Food & beverages consumables (% of revenue)", a["exp_fb"], "pct"),
        ("Employee costs (% of revenue)", a["exp_emp"], "pct"),
        ("Power & fuel (% of revenue)", a["exp_power"], "pct"),
        ("Other variable expenses (% of revenue)", a["exp_oth"], "pct"),
        ("Service fees to Marriott (% of room revenue)", a["exp_service"], "pct"),
        ("Administrative & selling expenses (% of revenue, year 1)", a["admin"], "pct"),
        ("Annual increase in administrative expenses", a["admin_inc"], "pct"),
        ("Term loan repayment tenure (years)", a["tenure"], "int"),
        ("Number of installments (equal)", a["installments"], "int"),
        ("Repayment profile", REPAY_LABELS.get(a.get("repay_type", "stepped"), a.get("repay_type", "stepped")), "text"),
    ]
    for lbl, v, f in single:
        rows.append(("row", lbl, [v], f))
    return rows


# --------------------------------------------------------------------------
# Simple canvas bar chart (no external libraries)
# --------------------------------------------------------------------------
def draw_bars(cv, title, labels, series, colors, names, hline=None, hname="", fmt="%.1f"):
    cv.delete("all")
    w, h = cv.winfo_width(), cv.winfo_height()
    if w < 150 or h < 120:
        return
    ml, mr, mt, mb = 52, 16, 46, 34
    pw, ph = w - ml - mr, h - mt - mb
    vals = [v for s in series for v in s if v is not None]
    if hline is not None:
        vals.append(hline)
    vmax, vmin = max(vals + [0.0]), min(vals + [0.0])
    if vmax - vmin < 1e-9:
        vmax = vmin + 1.0
    span = vmax - vmin

    def Y(v):
        return mt + (vmax - v) / span * ph

    cv.create_text(ml, 16, text=title, anchor="w", font=FONT_B, fill=PRIMARY)
    x = w - mr
    for nm, col in reversed(list(zip(names, colors))):
        x -= 9 * len(nm) + 26
        cv.create_rectangle(x, 30, x + 10, 40, fill=col, outline=col)
        cv.create_text(x + 14, 35, text=nm, anchor="w", font=FONT_S, fill="#444444")
    for k in range(5):
        v = vmin + span * k / 4.0
        y = Y(v)
        cv.create_line(ml, y, w - mr, y, fill="#E3DDF3")
        cv.create_text(ml - 6, y, text=fmt % v, anchor="e", font=("Segoe UI", 8), fill="#666666")
    n = len(labels)
    gw = pw / float(n)
    bw = gw * 0.72 / len(series)
    for i in range(n):
        gx = ml + i * gw + gw * 0.14
        for j, s in enumerate(series):
            v = s[i]
            if v is None:
                continue
            cv.create_rectangle(gx + j * bw, Y(max(v, 0)), gx + (j + 1) * bw - 1, Y(min(v, 0)),
                                fill=colors[j], outline="")
        cv.create_text(ml + i * gw + gw / 2, h - mb + 14, text=labels[i],
                       font=("Segoe UI", 8), fill="#444444")
    if hline is not None:
        y = Y(hline)
        cv.create_line(ml, y, w - mr, y, fill=RED, dash=(5, 3), width=2)
        cv.create_text(w - mr - 2, y - 8, text=hname, anchor="e", font=FONT_S, fill=RED)


# --------------------------------------------------------------------------
# The application window
# --------------------------------------------------------------------------
class App:
    def __init__(self, root):
        self.root = root
        self.root.title(APP_TITLE)
        self.root.configure(bg=BG)
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        self.root.geometry("%dx%d+10+10" % (min(1320, sw - 40), min(800, sh - 80)))
        self.root.minsize(980, 620)
        self._loading = False
        self.a = None
        self.R = None
        self.reports = None

        # form variables
        self.v_name = tk.StringVar()
        self.v = {k[0]: tk.StringVar() for k in ALL_SCALARS}
        self.rows = []          # one entry per cost item (dynamic - add / remove / rename)
        self.nq = 8                 # construction period in quarters (dynamic)
        self.tenure_var = tk.StringVar()
        self.static_updaters = []   # functions(R) that refresh fixed calculated tables
        self.dyn_updaters = []      # functions(R) for tables that follow the cost-item list
        self.fy_static, self.fy_dyn = [], []    # financial-year header labels
        self.dep_vars = {k: tk.StringVar() for k in ("b", "e", "t")}
        self.mix_total = tk.StringVar(value="100")
        self.repay_info = tk.StringVar()    # "Repayment tenure: 10 years (2026-27 to 2035-36)"
        self.inst_info = tk.StringVar()     # frequency and size of each installment
        self.v_repay_type = tk.StringVar(value=REPAY_LABELS["stepped"])
        self._loan_cache = None             # last computed term loan (for the installment amount)
        self.others_var = tk.StringVar()
        self.d_tot = {k: tk.StringVar() for k in
                      ("core_c", "core_p", "core_b", "idc_c", "idc_p", "idc_b",
                       "tot_c", "tot_p", "tot_b")}

        # front page variables
        self.v_front = {k: tk.StringVar(value=DEFAULTS.get(k, "")) for k in FRONT_PAGE_KEYS}
        self.txt_fields = {}
        self.lbl_front_model_loan = None

        self._setup_style()
        self._build_header()
        self._build_toolbar()
        self._build_status()
        self._build_tabs()

        self._load_into_form(DEFAULTS)
        self._hook_traces()
        self._refresh_derived()
        self.generate_report(silent=True)

    # ------------------------------------------------------------------ style
    def _setup_style(self):
        s = ttk.Style()
        try:
            s.theme_use("clam")
        except tk.TclError:
            pass
        s.configure("TNotebook", background=BG, borderwidth=0)
        s.configure("TNotebook.Tab", padding=(20, 9), font=FONT_B,
                    background="#D1C4E9", foreground=PRIMARY)
        s.map("TNotebook.Tab",
              background=[("selected", PRIMARY), ("active", "#B39DDB")],
              foreground=[("selected", "white")])
        s.configure("Treeview", rowheight=25, font=FONT, background="white",
                    fieldbackground="white", borderwidth=0)
        s.configure("Treeview.Heading", font=FONT_B, background=PRIMARY,
                    foreground="white", relief="flat", padding=6)
        s.map("Treeview.Heading", background=[("active", ORANGE)])
        s.map("Treeview", background=[("selected", "#7E57C2")],
              foreground=[("selected", "white")])

    # ----------------------------------------------------------------- header
    def _build_header(self):
        head = tk.Frame(self.root, bg=PRIMARY)
        head.pack(fill="x")
        tk.Label(head, text=APP_TITLE, bg=PRIMARY, fg="white", font=FONT_T,
                 padx=18, pady=8).pack(side="left")
        tk.Label(head, text="Term Loan  |  Project Finance Model  |  Amounts in Rs. Crores",
                 bg=PRIMARY, fg="#D1C4E9", font=FONT).pack(side="left", padx=8)
        stripe = tk.Frame(self.root, height=5)
        stripe.pack(fill="x")
        for col in (ORANGE, PINK, TEAL, BLUE, GREEN, YELLOW):
            tk.Frame(stripe, bg=col, height=5).pack(side="left", fill="x", expand=True)

    def _build_toolbar(self):
        bar = tk.Frame(self.root, bg=BG, pady=8, padx=10)
        bar.pack(fill="x")
        buttons = [
            ("\u25B6  Generate Report", GREEN, self.generate_report),
            ("Reset Defaults", ORANGE, self.reset_defaults),
            ("Save Assumptions", TEAL, self.save_assumptions),
            ("Load Assumptions", BLUE, self.load_assumptions),
            ("Export to Excel", PINK, self.export_excel),
            ("Export to PDF", RED, self.export_pdf),
        ]
        for text, col, cmd in buttons:
            b = tk.Button(bar, text=text, command=cmd, bg=col, fg="white", font=FONT_B,
                          relief="flat", bd=0, padx=13, pady=7, cursor="hand2",
                          activebackground=PRIMARY_D, activeforeground="white")
            b.pack(side="left", padx=(0, 6))
        tk.Label(bar, text="Project:", bg=BG, fg=PRIMARY, font=FONT_B).pack(side="left", padx=(24, 4))
        tk.Entry(bar, textvariable=self.v_name, width=30, font=FONT, relief="solid", bd=1).pack(side="left")

    def _build_status(self):
        self.status = tk.StringVar(value="Ready")
        self.status_lbl = tk.Label(self.root, textvariable=self.status, anchor="w", bg=PRIMARY_D,
                                   fg="white", font=FONT_S, padx=12, pady=4)
        self.status_lbl.pack(side="bottom", fill="x")

    # ------------------------------------------------------------------- tabs
    def _build_tabs(self):
        self.nb = ttk.Notebook(self.root)
        self.nb.pack(fill="both", expand=True, padx=10, pady=(0, 8))

        self.tab_front = tk.Frame(self.nb, bg=BG)
        self.tab_assump = tk.Frame(self.nb, bg=BG)
        self.tab_dash = tk.Frame(self.nb, bg=BG)
        self.nb.add(self.tab_front, text="  Front Page  ")
        self.nb.add(self.tab_assump, text="  Assumptions  ")
        self.nb.add(self.tab_dash, text="  Dashboard  ")
        self.tv_is = self._make_report_tab("  Project Income Statement  ",
                                           "Project Income Statement", PINK)
        self.tv_bs = self._make_report_tab("  Projected Balance Sheet  ",
                                           "Projected Balance Sheet", TEAL)
        self.tv_cf = self._make_report_tab("  Projected Cash Flow Statement  ",
                                           "Projected Cash Flow Statement", BLUE)
        self._build_front_page_tab()
        self._build_assumption_tab()
        self._build_dashboard_tab()

    def _make_report_tab(self, tab_text, title, colour):
        frame = tk.Frame(self.nb, bg=BG)
        self.nb.add(frame, text=tab_text)
        tk.Label(frame, text=title + "   (Rs. in Crores)", bg=colour, fg="white",
                 font=FONT_H, anchor="w", padx=12, pady=6).pack(fill="x")
        holder = tk.Frame(frame, bg=BG)
        holder.pack(fill="both", expand=True)
        tv = ttk.Treeview(holder, show="headings", selectmode="browse")
        ysb = ttk.Scrollbar(holder, orient="vertical", command=tv.yview)
        xsb = ttk.Scrollbar(holder, orient="horizontal", command=tv.xview)
        tv.configure(yscrollcommand=ysb.set, xscrollcommand=xsb.set)
        holder.rowconfigure(0, weight=1)
        holder.columnconfigure(0, weight=1)
        tv.grid(row=0, column=0, sticky="nsew")
        ysb.grid(row=0, column=1, sticky="ns")
        xsb.grid(row=1, column=0, sticky="ew")
        tv.tag_configure("head", background=TEAL, foreground="white", font=FONT_B)
        tv.tag_configure("section", background="#EDE7F6", foreground=PRIMARY, font=FONT_B)
        tv.tag_configure("total", background="#FFF3C4", font=FONT_B)
        tv.tag_configure("grand", background="#C8E6C9", font=FONT_B)
        tv.tag_configure("odd", background="#FFFFFF")
        tv.tag_configure("even", background="#F7F3FF")
        tv.tag_configure("blank", background="#FFFFFF")
        tv.tag_configure("ok", background="#C8E6C9", foreground="#1B5E20", font=FONT_B)
        tv.tag_configure("bad", background="#FFCDD2", foreground="#B71C1C", font=FONT_B)
        tv.tag_configure("note", foreground="#777777", background="#FFFFFF")
        return tv

    # ------------------------------------------------------ assumption widgets
    def _entry(self, parent, var, width=10, readonly=False, justify="right"):
        e = tk.Entry(parent, textvariable=var, width=width, justify=justify, font=FONT,
                     relief="solid", bd=1, highlightthickness=1,
                     highlightbackground="#B39DDB", highlightcolor=ORANGE)
        if readonly:
            e.configure(state="readonly", readonlybackground="#E8F5E9", fg="#1B5E20")
        return e

    def _section(self, parent, title, colour):
        outer = tk.Frame(parent, bg=colour)
        tk.Label(outer, text=title, bg=colour, fg="white", font=FONT_H, anchor="w",
                 padx=10, pady=4).pack(fill="x")
        body = tk.Frame(outer, bg=CARD, padx=12, pady=10)
        body.pack(fill="both", expand=True, padx=2, pady=(0, 2))
        return outer, body

    def _scalar_rows(self, body, specs, start=0):
        body.columnconfigure(0, minsize=430)
        r = start
        for key, label, kind, unit, lo, hi in specs:
            tk.Label(body, text=label, bg=CARD, font=FONT, anchor="w").grid(row=r, column=0, sticky="w", pady=3)
            self._entry(body, self.v[key], 11).grid(row=r, column=1, padx=8, pady=3)
            tk.Label(body, text=unit, bg=CARD, fg="#777777", font=FONT_S).grid(row=r, column=2, sticky="w")
            r += 1
        return r

    def _autofill_facility(self):
        try:
            a = self.get_assumptions()
            R = compute(a)
            loan_cr = R["total_bank"]
            self.v_front["facility_term_loan"].set(f"Term Loan of Rs. {loan_cr:,.2f} Crore")
            if self.lbl_front_model_loan:
                self.lbl_front_model_loan.config(text=f"(Model computed Term Loan: Rs. {loan_cr:,.2f} Crore)")
            self.status.set(f"Synced facility term loan with model: Rs. {loan_cr:,.2f} Cr")
        except Exception as err:
            messagebox.showwarning(APP_TITLE, "Could not compute term loan:\n\n" + str(err))

    def _build_front_page_tab(self):
        canvas = tk.Canvas(self.tab_front, bg=BG, highlightthickness=0)
        vsb = ttk.Scrollbar(self.tab_front, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        page = tk.Frame(canvas, bg=BG)
        win = canvas.create_window((0, 0), window=page, anchor="nw")

        def _fit(_e=None):
            canvas.itemconfigure(win, width=max(canvas.winfo_width(), page.winfo_reqwidth()))
            canvas.configure(scrollregion=canvas.bbox("all"))

        page.bind("<Configure>", _fit)
        canvas.bind("<Configure>", _fit)

        def _wheel(e):
            if e.num == 4:
                canvas.yview_scroll(-2, "units")
            elif e.num == 5:
                canvas.yview_scroll(2, "units")
            else:
                canvas.yview_scroll(int(-e.delta / 120) * 2 if e.delta else 0, "units")

        def _bind(_e):
            canvas.bind_all("<MouseWheel>", _wheel)
            canvas.bind_all("<Button-4>", _wheel)
            canvas.bind_all("<Button-5>", _wheel)

        def _unbind(_e):
            canvas.unbind_all("<MouseWheel>")
            canvas.unbind_all("<Button-4>")
            canvas.unbind_all("<Button-5>")

        canvas.bind("<Enter>", _bind)
        canvas.bind("<Leave>", _unbind)

        # Header banner card
        info_frame = tk.Frame(page, bg="#EDE7F6", padx=14, pady=10, relief="solid", bd=1)
        info_frame.pack(fill="x", padx=12, pady=(10, 6))
        tk.Label(info_frame, text="Front Page & Project Profile Dossier", bg="#EDE7F6",
                 fg=PRIMARY, font=FONT_H).pack(anchor="w")
        tk.Label(info_frame,
                 text="Enter the Title Block, Bank Submission details, Entity details, and Promoter information below.\n"
                      "These features are prominently formatted on Page 1 of the PDF Detailed Project Report and Sheet 1 of the Excel Dossier.",
                 bg="#EDE7F6", fg="#444444", font=FONT_S, justify="left").pack(anchor="w", pady=(3, 0))

        def make_entry_row(parent, row, label_text, var, width=45, col_offset=0):
            tk.Label(parent, text=label_text, bg=CARD, font=FONT_B, anchor="w"
                     ).grid(row=row, column=col_offset, sticky="w", padx=(6, 8), pady=4)
            e = tk.Entry(parent, textvariable=var, width=width, font=FONT,
                         relief="solid", bd=1, highlightthickness=1,
                         highlightbackground="#B39DDB", highlightcolor=ORANGE)
            e.grid(row=row, column=col_offset + 1, sticky="w", padx=(0, 12), pady=4)
            return e

        # =====================================================================
        # 1. Title Block & Facilities Sought
        # =====================================================================
        sec1_outer, sec1_body = self._section(page, "1. Title Block & Facilities Sought", PRIMARY)
        sec1_outer.pack(fill="x", padx=12, pady=6)
        sec1_body.columnconfigure(1, weight=1)

        tk.Label(sec1_body, text="Report Heading: Detailed Project Report", bg=CARD,
                 fg=PRIMARY, font=FONT_B).grid(row=0, column=0, columnspan=2, sticky="w", padx=6, pady=(2, 6))

        make_entry_row(sec1_body, 1, "Project Name:", self.v_name, width=50)
        make_entry_row(sec1_body, 2, "Project Purpose / Activity:\n(e.g., Setting up a 5 TPD Rice Mill / Expansion)",
                       self.v_front["project_purpose"], width=72)

        # Bank Details Sub-frame
        bank_frame = tk.LabelFrame(sec1_body, text=" Submitted To (Bank Details) ", bg=CARD,
                                   font=FONT_B, fg=PRIMARY, padx=10, pady=8)
        bank_frame.grid(row=3, column=0, columnspan=2, sticky="ew", padx=6, pady=6)
        bank_frame.columnconfigure(1, weight=1)
        make_entry_row(bank_frame, 0, "Name of the Bank:", self.v_front["bank_name"], width=35)
        make_entry_row(bank_frame, 1, "Branch Name:", self.v_front["bank_branch"], width=35)
        make_entry_row(bank_frame, 2, "Branch Address:", self.v_front["bank_address"], width=72)

        # Facilities Sought Sub-frame
        fac_frame = tk.LabelFrame(sec1_body, text=" Financing Facilities Sought ", bg=CARD,
                                  font=FONT_B, fg=PRIMARY, padx=10, pady=8)
        fac_frame.grid(row=4, column=0, columnspan=2, sticky="ew", padx=6, pady=6)
        fac_frame.columnconfigure(1, weight=1)

        tk.Label(fac_frame, text="Facility Sought (Term Loan):", bg=CARD, font=FONT_B, anchor="w"
                 ).grid(row=0, column=0, sticky="w", padx=(6, 8), pady=4)
        tl_row = tk.Frame(fac_frame, bg=CARD)
        tl_row.grid(row=0, column=1, sticky="w", pady=4)
        tk.Entry(tl_row, textvariable=self.v_front["facility_term_loan"], width=35, font=FONT,
                 relief="solid", bd=1, highlightthickness=1, highlightbackground="#B39DDB").pack(side="left")
        tk.Button(tl_row, text="⚡ Sync with Model Loan", command=self._autofill_facility,
                  bg=TEAL, fg="white", font=FONT_S, relief="flat", padx=8, pady=2, cursor="hand2"
                  ).pack(side="left", padx=(10, 6))
        self.lbl_front_model_loan = tk.Label(tl_row, text="(Model computed Term Loan: Rs. 70.00 Cr)",
                                             bg=CARD, fg="#555555", font=FONT_S)
        self.lbl_front_model_loan.pack(side="left", padx=4)

        make_entry_row(fac_frame, 1, "Working Capital (if applicable):", self.v_front["facility_wc"], width=52)
        make_entry_row(fac_frame, 2, "Total Credit Facilities Sought:", self.v_front["facility_total"], width=52)

        # =====================================================================
        # 2. Entity Details & Statutory Registrations
        # =====================================================================
        sec2_outer, sec2_body = self._section(page, "2. Entity Details & Statutory Registrations", TEAL)
        sec2_outer.pack(fill="x", padx=12, pady=6)
        sec2_body.columnconfigure(1, weight=1)

        make_entry_row(sec2_body, 0, "Name of the Entity (as per registration):", self.v_front["entity_name"], width=52)

        tk.Label(sec2_body, text="Constitution:", bg=CARD, font=FONT_B, anchor="w"
                 ).grid(row=1, column=0, sticky="w", padx=(6, 8), pady=4)
        cb_const = ttk.Combobox(sec2_body, textvariable=self.v_front["constitution"],
                                values=CONSTITUTION_OPTIONS, state="readonly", width=38, font=FONT)
        cb_const.grid(row=1, column=1, sticky="w", pady=4)

        make_entry_row(sec2_body, 2, "Date of Incorporation / Commencement:", self.v_front["date_incorporation"], width=25)
        make_entry_row(sec2_body, 3, "Registered Office Address:", self.v_front["reg_office"], width=75)
        make_entry_row(sec2_body, 4, "Project / Unit Location (if different):", self.v_front["unit_location"], width=75)

        tk.Label(sec2_body, text="Contact Details:", bg=CARD, font=FONT_B, anchor="w"
                 ).grid(row=5, column=0, sticky="w", padx=(6, 8), pady=4)
        c_row = tk.Frame(sec2_body, bg=CARD)
        c_row.grid(row=5, column=1, sticky="w", pady=4)
        tk.Label(c_row, text="Phone:", bg=CARD, font=FONT_S).pack(side="left")
        tk.Entry(c_row, textvariable=self.v_front["contact_phone"], width=22, font=FONT,
                 relief="solid", bd=1).pack(side="left", padx=(4, 12))
        tk.Label(c_row, text="Email:", bg=CARD, font=FONT_S).pack(side="left")
        tk.Entry(c_row, textvariable=self.v_front["contact_email"], width=24, font=FONT,
                 relief="solid", bd=1).pack(side="left", padx=(4, 12))
        tk.Label(c_row, text="Website:", bg=CARD, font=FONT_S).pack(side="left")
        tk.Entry(c_row, textvariable=self.v_front["contact_website"], width=22, font=FONT,
                 relief="solid", bd=1).pack(side="left", padx=(4, 4))

        reg_frame = tk.LabelFrame(sec2_body, text=" Statutory & Regulatory Registrations ", bg=CARD,
                                  font=FONT_B, fg=TEAL, padx=10, pady=8)
        reg_frame.grid(row=6, column=0, columnspan=2, sticky="ew", padx=6, pady=6)
        reg_frame.columnconfigure(1, weight=1)

        r0 = tk.Frame(reg_frame, bg=CARD)
        r0.pack(fill="x", pady=3)
        tk.Label(r0, text="PAN:", bg=CARD, font=FONT_B, width=12, anchor="w").pack(side="left")
        tk.Entry(r0, textvariable=self.v_front["pan"], width=18, font=FONT, relief="solid", bd=1).pack(side="left", padx=(0, 20))
        tk.Label(r0, text="GSTIN:", bg=CARD, font=FONT_B, width=10, anchor="w").pack(side="left")
        tk.Entry(r0, textvariable=self.v_front["gstin"], width=22, font=FONT, relief="solid", bd=1).pack(side="left")

        r1 = tk.Frame(reg_frame, bg=CARD)
        r1.pack(fill="x", pady=3)
        tk.Label(r1, text="Udyam (MSME) No.:", bg=CARD, font=FONT_B, width=18, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.v_front["udyam_number"], width=25, font=FONT, relief="solid", bd=1).pack(side="left", padx=(0, 20))
        tk.Label(r1, text="MSME Category:", bg=CARD, font=FONT_B, width=14, anchor="w").pack(side="left")
        cb_udyam = ttk.Combobox(r1, textvariable=self.v_front["udyam_category"],
                                values=UDYAM_CATEGORIES, state="readonly", width=18, font=FONT)
        cb_udyam.pack(side="left")

        r2 = tk.Frame(reg_frame, bg=CARD)
        r2.pack(fill="x", pady=3)
        tk.Label(r2, text="CIN / LLPIN:", bg=CARD, font=FONT_B, width=18, anchor="w").pack(side="left")
        tk.Entry(r2, textvariable=self.v_front["cin_llpin"], width=25, font=FONT, relief="solid", bd=1).pack(side="left")

        r3 = tk.Frame(reg_frame, bg=CARD)
        r3.pack(fill="x", pady=3)
        tk.Label(r3, text="Other Licences:\n(FSSAI, Factory, CTE, etc.)", bg=CARD, font=FONT_B, width=22, anchor="w").pack(side="left")
        tk.Entry(r3, textvariable=self.v_front["other_licences"], width=68, font=FONT, relief="solid", bd=1).pack(side="left")

        # =====================================================================
        # 3. Promoter / Management Details
        # =====================================================================
        sec3_outer, sec3_body = self._section(page, "3. Promoter / Management Details & Banking Relationship", ORANGE)
        sec3_outer.pack(fill="x", padx=12, pady=6)
        sec3_body.columnconfigure(1, weight=1)

        tk.Label(sec3_body, text="Names & Designations of\nProprietor, Partners or Directors:",
                 bg=CARD, font=FONT_B, anchor="nw").grid(row=0, column=0, sticky="nw", padx=(6, 8), pady=4)
        txt_prom = tk.Text(sec3_body, height=4, width=72, font=FONT, relief="solid", bd=1,
                           highlightthickness=1, highlightbackground="#FFE0B2", highlightcolor=ORANGE)
        txt_prom.grid(row=0, column=1, sticky="w", pady=4)
        txt_prom.insert("1.0", DEFAULTS["promoter_details"])
        self.txt_fields["promoter_details"] = txt_prom

        auth_frame = tk.LabelFrame(sec3_body, text=" Authorised Signatory / Contact Person ", bg=CARD,
                                   font=FONT_B, fg=ORANGE, padx=10, pady=8)
        auth_frame.grid(row=1, column=0, columnspan=2, sticky="ew", padx=6, pady=6)
        ar0 = tk.Frame(auth_frame, bg=CARD)
        ar0.pack(fill="x", pady=3)
        tk.Label(ar0, text="Name:", bg=CARD, font=FONT_B, width=12, anchor="w").pack(side="left")
        tk.Entry(ar0, textvariable=self.v_front["auth_signatory_name"], width=28, font=FONT, relief="solid", bd=1).pack(side="left", padx=(0, 20))
        tk.Label(ar0, text="Designation:", bg=CARD, font=FONT_B, width=12, anchor="w").pack(side="left")
        tk.Entry(ar0, textvariable=self.v_front["auth_signatory_desig"], width=28, font=FONT, relief="solid", bd=1).pack(side="left")

        ar1 = tk.Frame(auth_frame, bg=CARD)
        ar1.pack(fill="x", pady=3)
        tk.Label(ar1, text="Mobile Number:", bg=CARD, font=FONT_B, width=14, anchor="w").pack(side="left")
        tk.Entry(ar1, textvariable=self.v_front["auth_signatory_mobile"], width=22, font=FONT, relief="solid", bd=1).pack(side="left", padx=(0, 20))
        tk.Label(ar1, text="Email Address:", bg=CARD, font=FONT_B, width=14, anchor="w").pack(side="left")
        tk.Entry(ar1, textvariable=self.v_front["auth_signatory_email"], width=28, font=FONT, relief="solid", bd=1).pack(side="left")

        tk.Label(sec3_body, text="CIBIL / Credit Relationship\n& Existing Bankers:",
                 bg=CARD, font=FONT_B, anchor="nw").grid(row=2, column=0, sticky="nw", padx=(6, 8), pady=4)
        txt_cred = tk.Text(sec3_body, height=3, width=72, font=FONT, relief="solid", bd=1,
                           highlightthickness=1, highlightbackground="#FFE0B2", highlightcolor=ORANGE)
        txt_cred.grid(row=2, column=1, sticky="w", pady=4)
        txt_cred.insert("1.0", DEFAULTS["credit_relationship"])
        self.txt_fields["credit_relationship"] = txt_cred

    def _build_assumption_tab(self):
        canvas = tk.Canvas(self.tab_assump, bg=BG, highlightthickness=0)
        vsb = ttk.Scrollbar(self.tab_assump, orient="vertical", command=canvas.yview)
        hsb = ttk.Scrollbar(self.tab_assump, orient="horizontal", command=canvas.xview)
        canvas.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        hsb.pack(side="bottom", fill="x")
        vsb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        page = tk.Frame(canvas, bg=BG)
        win = canvas.create_window((0, 0), window=page, anchor="nw")

        def _fit(_e=None):
            # the page is at least as wide as the window; longer tenures (wider tables) scroll sideways
            canvas.itemconfigure(win, width=max(canvas.winfo_width(), page.winfo_reqwidth()))
            canvas.configure(scrollregion=canvas.bbox("all"))

        page.bind("<Configure>", _fit)
        canvas.bind("<Configure>", _fit)

        def _wheel(e):
            if e.num == 4:
                canvas.yview_scroll(-2, "units")
            elif e.num == 5:
                canvas.yview_scroll(2, "units")
            else:
                canvas.yview_scroll(int(-e.delta / 120) * 2 if e.delta else 0, "units")

        def _bind(_e):
            canvas.bind_all("<MouseWheel>", _wheel)
            canvas.bind_all("<Button-4>", _wheel)
            canvas.bind_all("<Button-5>", _wheel)

        def _unbind(_e):
            canvas.unbind_all("<MouseWheel>")
            canvas.unbind_all("<Button-4>")
            canvas.unbind_all("<Button-5>")

        canvas.bind("<Enter>", _bind)
        canvas.bind("<Leave>", _unbind)

        page.columnconfigure(0, weight=1)
        self.page = page
        tk.Label(page, text="The sections below follow the same order as the Excel 'Assumption Sheet'. "
                            "Type into the white boxes (percentages as numbers: 65 = 65 %). "
                            "Green boxes are calculated automatically. Cost items can be renamed, "
                            "added (+) or removed (x). Then press  \u25B6 Generate Report.",
                 bg=BG, fg=PRIMARY, font=FONT, anchor="w", wraplength=1100, justify="left"
                 ).grid(row=0, column=0, sticky="w", padx=10, pady=(8, 2))
        self._pr = 1                       # next free row on the page
        SP = {sp[0]: sp for sp in ALL_SCALARS}

        b = self._new_section("Project Timeline", "#5E35B1")
        self._scalar_rows(b, [SP["start_fy"]])

        # --- same sequence as the Excel Assumption Sheet ---------------------------
        self.cost_body = self._new_section(
            "Total Project Cost   (Amount in Rs. in Crores / Proportion in %age)", PRIMARY)
        self.phase_body = self._new_section("Cost Phasing in %age", TEAL)
        self.incurred_body = self._new_section("Cost Incurred in Rs.   (calculated)", ORANGE)
        self.alloc_body = self._new_section(
            "Term Loan Draw-Down & Promoters Margin requirement   (calculated)", PINK)
        self.dd_body = self._new_section("Term Loan Draw-Down Schedule   (calculated)", BLUE)
        self._build_main_item_section()
        self._build_depreciation_section()

        b = self._new_section("Proportion in Revenue Stream", "#00897B")
        r = self._scalar_rows(b, [SP["room_share"], SP["fb_share"]])
        tk.Label(b, text="Others (balance)", bg=CARD, font=FONT, anchor="w").grid(row=r, column=0, sticky="w", pady=3)
        self._entry(b, self.others_var, 11, True).grid(row=r, column=1, padx=8)
        tk.Label(b, text="% of total", bg=CARD, fg="#777777", font=FONT_S).grid(row=r, column=2, sticky="w")
        tk.Label(b, text="Total", bg=CARD, font=FONT_B, anchor="w").grid(row=r + 1, column=0, sticky="w", pady=3)
        self._entry(b, self.mix_total, 11, True).grid(row=r + 1, column=1, padx=8)
        tk.Label(b, text="% of total", bg=CARD, fg="#777777", font=FONT_S).grid(row=r + 1, column=2, sticky="w")

        b = self._new_section("Rooms, Occupancy & Tariff", "#F4511E")
        self._scalar_rows(b, [SP[k] for k in ("rooms", "days", "occ", "occ_inc", "tariff", "tariff_inc", "occ_cap")])

        b = self._new_section("Composition of Expenses", BLUE)
        self._scalar_rows(b, [SP[k] for k in ("exp_fb", "exp_emp", "exp_power", "exp_oth", "exp_service")])

        b = self._new_section("Fixed Expenses", "#8E24AA")
        self._scalar_rows(b, [SP["admin"], SP["admin_inc"]])

        b = self._new_section("Corporate Income Tax", "#546E7A")
        self._scalar_rows(b, [SP["tax"]])

        self.cashout_body = self._new_section("Total Cash Out-Flow   (calculated, Rs. in Crores)", "#00838F")

        b = self._new_section("Term Loan Repayment", GREEN)
        tk.Label(b, text="Repayment Profile", bg=CARD, font=FONT, anchor="w").grid(
            row=0, column=0, sticky="w", pady=3)
        cb_repay = ttk.Combobox(b, textvariable=self.v_repay_type, values=[v for k, v in REPAY_PROFILES],
                                state="readonly", width=55, font=FONT)
        cb_repay.grid(row=0, column=1, columnspan=2, sticky="w", padx=8, pady=3)
        cb_repay.bind("<<ComboboxSelected>>", self._refresh_derived)
        r = self._scalar_rows(b, [SP["tenure"], SP["installments"]], start=1)
        tk.Label(b, textvariable=self.repay_info, bg=CARD, fg=PRIMARY, font=FONT_B, anchor="w").grid(
            row=r, column=0, columnspan=3, sticky="w", pady=(10, 1))
        tk.Label(b, textvariable=self.inst_info, bg=CARD, fg=PRIMARY, font=FONT_B, anchor="w").grid(
            row=r + 1, column=0, columnspan=3, sticky="w", pady=1)
        tk.Label(b, text="Choose 'Stepped / Balloon' to match the Hotel Case Study model (lower repayment during ramp-up), "
                         "or 'Equal Installments' to amortize evenly over the tenure. "
                         "Repayment starts in the first operating year and the projections run for the same number of years as the tenure.",
                 bg=CARD, fg="#777777", font=FONT_S, anchor="w", justify="left", wraplength=1050).grid(
            row=r + 2, column=0, columnspan=3, sticky="w", pady=(4, 0))
        tk.Label(page, text="", bg=BG).grid(row=self._pr, column=0, pady=6)

    # ----------------------------------------------- assumption-page building blocks
    def _new_section(self, title, colour):
        o, b = self._section(self.page, title, colour)
        o.grid(row=self._pr, column=0, sticky="ew", padx=8, pady=6)
        self._pr += 1
        return b

    def _calc_cell(self, parent, var, row, col, bold=False, bg="#F1F8E9", width=9):
        tk.Label(parent, textvariable=var, anchor="e", width=width, font=FONT_B if bold else FONT,
                 bg=bg, fg="#1B5E20", relief="solid", bd=1, padx=4).grid(
            row=row, column=col, padx=1, pady=1, sticky="ew")

    def _qheader(self, b, fy_list, total=True):
        """Particulars | FY1 (Q I-IV) | FY2 ... | Total header for self.nq quarters."""
        nq = self.nq
        hb, hf = "#B2DFDB", "#004D40"
        b.columnconfigure(0, weight=1)
        tk.Label(b, text="Particulars", bg=hb, fg=hf, font=FONT_B).grid(
            row=0, column=0, rowspan=2, sticky="nsew", padx=1, pady=1)
        for k in range((nq + 3) // 4):
            span = min(4, nq - 4 * k)
            lab = tk.Label(b, text="", bg=hb, fg=hf, font=FONT_B)
            lab.grid(row=0, column=1 + 4 * k, columnspan=span, sticky="ew", padx=1, pady=1)
            fy_list.append((lab, k))
        for q in range(nq):
            tk.Label(b, text="Q " + ["I", "II", "III", "IV"][q % 4], bg="#E0F2F1", fg=hf,
                     font=FONT_B).grid(row=1, column=q + 1, sticky="ew", padx=1, pady=1)
        if total:
            tk.Label(b, text="Total", bg=hb, fg=hf, font=FONT_B).grid(
                row=0, column=nq + 1, rowspan=2, sticky="nsew", padx=1, pady=1)
        return 2

    def _q_row(self, b, r, label, fn, fn_total, updaters, bold=False, label_var=None, indent=False):
        """One calculated row over the quarters.  fn(R, q) -> value ; fn_total(R) -> value or None."""
        nq = self.nq
        bg = "#FFF3C4" if bold else CARD
        pad = "      " if indent else ""
        if label_var is not None:
            tk.Label(b, textvariable=label_var, bg=bg, font=FONT_B if bold else FONT, anchor="w").grid(
                row=r, column=0, sticky="ew", pady=1)
        else:
            tk.Label(b, text=pad + label, bg=bg, font=FONT_B if bold else FONT, anchor="w").grid(
                row=r, column=0, sticky="ew", pady=1)
        cellbg = "#FFF3C4" if bold else "#F1F8E9"
        for q in range(nq):
            var = tk.StringVar()
            self._calc_cell(b, var, r, q + 1, bold, cellbg)
            updaters.append(lambda R, var=var, q=q: var.set(cell_fmt(fn(R, q))))
        if fn_total is not None:
            var = tk.StringVar()
            self._calc_cell(b, var, r, nq + 1, True, "#FFF3C4")
            updaters.append(lambda R, var=var: var.set(cell_fmt(fn_total(R))))

    def _build_drawdown_section(self):
        b = self.dd_body
        self._clear(b)
        r = self._qheader(b, self.fy_dyn)
        U = self.dyn_updaters
        self._q_row(b, r, "Opening Balance", lambda R, q: R["dd_open"][q], lambda R: R["dd_open"][0], U)
        self._q_row(b, r + 1, "[+] Draw Down", lambda R, q: R["bank_tot_q"][q],
                    lambda R: sum(R["bank_tot_q"]), U)
        self._q_row(b, r + 2, "Closing Balance", lambda R, q: R["dd_close"][q],
                    lambda R: R["dd_close"][-1], U, bold=True)
        self._q_row(b, r + 3, "Average Balance", lambda R, q: R["dd_avg"][q], None, U)
        self._q_row(b, r + 4, "Interest During Construction", lambda R, q: R["idc_q"][q],
                    lambda R: sum(R["idc_q"]), U, bold=True)
        rr = r + 5
        tk.Label(b, text="Rate of Interest in Term Loan", bg=CARD, font=FONT_B, anchor="w").grid(
            row=rr, column=0, sticky="w", pady=(12, 2))
        self._entry(b, self.v["rate"], 9).grid(row=rr, column=1, columnspan=2, sticky="w", padx=6, pady=(12, 2))
        tk.Label(b, text="% p.a.", bg=CARD, fg="#777777", font=FONT_S).grid(
            row=rr, column=3, sticky="w", pady=(12, 2))

    def _build_main_item_section(self):
        b = self._new_section("Name of the Main Item of the Project Cost", "#3949AB")
        b.columnconfigure(0, weight=1)
        heads = ["Name of the Main Item of the Project Cost", "Base Cost", "Cost of Approvals", "Contingency Margin", "IDC", "Total Cost"]
        for c, t in enumerate(heads):
            tk.Label(b, text=t, bg="#C5CAE9", fg="#1A237E", font=FONT_B, padx=6, pady=3).grid(
                row=0, column=c, sticky="ew", padx=1, pady=1)

        # Subheader row: "All Amounts in Rs. in Crores"
        tk.Label(b, text="", bg="#E8EAF6").grid(row=1, column=0, sticky="ew", padx=1, pady=1)
        tk.Label(b, text="All Amounts in Rs. in Crores", bg="#E8EAF6", fg="#283593", font=FONT_B, padx=6, pady=2).grid(
            row=1, column=1, columnspan=5, sticky="ew", padx=1, pady=1)

        names = ["Cost of Hotel Building", "Cost of Kitchen Equipment & Machinery"]
        for k, nm in enumerate(names):
            tk.Label(b, text=nm, bg=CARD, font=FONT, anchor="w").grid(row=k + 2, column=0, sticky="ew", pady=1)
            for c in range(5):
                var = tk.StringVar()
                is_total = (c == 4)
                self._calc_cell(b, var, k + 2, c + 1, is_total, "#FFF3C4" if is_total else "#F1F8E9")
                def make_updater(k=k, c=c, var=var):
                    def _update(R):
                        v = R["main_tbl"][k][c]
                        if c == 1 and k == 1 and abs(v) < 1e-6:
                            var.set("-")
                        else:
                            var.set(cell_fmt(v))
                    return _update
                self.static_updaters.append(make_updater(k, c, var))

        # Total Cost row
        tk.Label(b, text="Total Cost", bg="#FFF3C4", font=FONT_B, anchor="w").grid(row=4, column=0, sticky="ew", pady=1)
        for c in range(5):
            var = tk.StringVar()
            self._calc_cell(b, var, 4, c + 1, True, "#FFF3C4")
            def make_tot_updater(c=c, var=var):
                def _update_tot(R):
                    v = R["main_tbl"][0][c] + R["main_tbl"][1][c]
                    var.set(cell_fmt(v))
                return _update_tot
            self.static_updaters.append(make_tot_updater(c, var))

    def _build_depreciation_section(self):
        b = self._new_section("Useful Life Assumed for Charging Depreciation", ORANGE)
        b.columnconfigure(0, weight=1)
        for c, t in ((1, "Useful Life (years)"), (2, "Depreciation Per Year")):
            tk.Label(b, text=t, bg="#FFE0B2", fg="#E65100", font=FONT_B, padx=8, pady=3).grid(
                row=0, column=c, sticky="ew", padx=1, pady=1)
        tk.Label(b, text="", bg="#FFE0B2").grid(row=0, column=0, sticky="ew")
        for k, (label, key, dk) in enumerate((("Hotel Building", "life_bldg", "b"),
                                              ("Kitchen Equipment & Machinery", "life_equip", "e"))):
            tk.Label(b, text=label, bg=CARD, font=FONT, anchor="w").grid(row=k + 1, column=0, sticky="w", pady=3)
            self._entry(b, self.v[key], 10).grid(row=k + 1, column=1, padx=6)
            self._calc_cell(b, self.dep_vars[dk], k + 1, 2)
        tk.Label(b, text="Total Depreciation Per Year", bg="#FFF3C4", font=FONT_B, anchor="w").grid(
            row=3, column=0, sticky="ew", pady=2)
        self._calc_cell(b, self.dep_vars["t"], 3, 2, True, "#FFF3C4")
        self.static_updaters.append(lambda R: (self.dep_vars["b"].set(cell_fmt(R["dep_b"])),
                                               self.dep_vars["e"].set(cell_fmt(R["dep_e"])),
                                               self.dep_vars["t"].set(cell_fmt(R["dep"]))))

    def _build_cashout_section(self):
        b = self.cashout_body
        self._clear(b)
        ny = (self.nq + 3) // 4
        b.columnconfigure(0, weight=1)
        hb, hf = "#B2DFDB", "#004D40"
        tk.Label(b, text="Total Cash Out-Flow", bg=hb, fg=hf, font=FONT_B).grid(
            row=0, column=0, sticky="nsew", padx=1, pady=1)
        for k in range(ny):
            lab = tk.Label(b, text="", bg=hb, fg=hf, font=FONT_B)
            lab.grid(row=0, column=k + 1, sticky="ew", padx=1, pady=1)
            self.fy_dyn.append((lab, k))
        tk.Label(b, text="Total", bg=hb, fg=hf, font=FONT_B).grid(row=0, column=ny + 1, sticky="ew", padx=1, pady=1)
        lines = (("Total Cost incurred in Rs. in Crores", "cost_y", False),
                 ("Interest During Construction in Rs. in Crores", "idc_y", False),
                 ("Total Cost incurred during the year in Rs. in Crores", "out_y", True))
        for k, (label, key, bold) in enumerate(lines):
            bg = "#FFF3C4" if bold else CARD
            tk.Label(b, text=label, bg=bg, font=FONT_B if bold else FONT, anchor="w").grid(
                row=k + 1, column=0, sticky="ew", pady=1)
            for c in range(ny + 1):
                var = tk.StringVar()
                self._calc_cell(b, var, k + 1, c + 1, bold or c == ny, "#FFF3C4" if bold else "#F1F8E9")
                if c < ny:
                    self.dyn_updaters.append(lambda R, var=var, key=key, c=c: var.set(cell_fmt(R[key][c])))
                else:
                    self.dyn_updaters.append(lambda R, var=var, key=key: var.set(cell_fmt(sum(R[key]))))

    def _build_dashboard_tab(self):
        f = self.tab_dash
        tk.Label(f, text="Project Snapshot (All Amounts in Rs. in Crores)", bg=BG, fg=PRIMARY, font=("Segoe UI", 15, "bold"),
                 anchor="w").pack(fill="x", padx=12, pady=(8, 2))
        self.cards_frame = tk.Frame(f, bg=BG)
        self.cards_frame.pack(fill="x", padx=8)
        self.card_vars = {}
        specs = [
            ("tot", "Total Project Cost (Rs. Cr)", PRIMARY), ("prom", "Promoters' Contribution (Rs. Cr)", TEAL),
            ("loan", "Term Loan / Bank Debt (Rs. Cr)", BLUE), ("idc", "Interest During Constr. (Rs. Cr)", ORANGE),
            ("de", "Debt : Equity (Loan / Promoter)", PINK),
            ("avg", "Average DSCR", GREEN), ("min", "Minimum DSCR", "#8E24AA"),
            ("irr", "Project IRR", "#F4511E"), ("pb", "Simple Pay-back", "#00ACC1"),
            ("bep", "Break-even (Year 1, % of sales)", "#3949AB"),
        ]
        for idx, (k, cap, col) in enumerate(specs):
            card = tk.Frame(self.cards_frame, bg=col, padx=10, pady=8)
            card.grid(row=idx // 5, column=idx % 5, sticky="nsew", padx=5, pady=5)
            self.cards_frame.columnconfigure(idx % 5, weight=1, uniform="cards")
            var = tk.StringVar(value="-")
            self.card_vars[k] = var
            tk.Label(card, textvariable=var, bg=col, fg="white", font=("Segoe UI", 19, "bold")).pack(anchor="w")
            tk.Label(card, text=cap, bg=col, fg="white", font=FONT_S).pack(anchor="w")

        mid = tk.Frame(f, bg=BG)
        mid.pack(fill="both", expand=True, padx=8, pady=4)
        mid.columnconfigure(0, weight=1, uniform="ch")
        mid.columnconfigure(1, weight=1, uniform="ch")
        mid.rowconfigure(0, weight=1)
        self.chart1 = tk.Canvas(mid, bg="white", highlightthickness=1, highlightbackground="#B39DDB")
        self.chart2 = tk.Canvas(mid, bg="white", highlightthickness=1, highlightbackground="#B39DDB")
        self.chart1.grid(row=0, column=0, sticky="nsew", padx=5, pady=4)
        self.chart2.grid(row=0, column=1, sticky="nsew", padx=5, pady=4)
        self.chart1.bind("<Configure>", lambda e: self._draw_charts())
        self.chart2.bind("<Configure>", lambda e: self._draw_charts())

        self.checks_frame = tk.Frame(f, bg=BG)
        self.checks_frame.pack(fill="x", padx=8, pady=(0, 8))

    def _draw_charts(self):
        if not self.R:
            return
        R = self.R
        lab = [y[2:] for y in R["ops_years"]]
        draw_bars(self.chart1, "Revenue vs Net Profit After Tax (₹ in Crore)", lab,
                  [R["rev"], R["pat"]], [BLUE, ORANGE], ["Revenue", "PAT"])
        d = [(0.0 if v is None else v) for v in R["dscr"]]
        draw_bars(self.chart2, "Debt Service Coverage Ratio (times)", lab, [d], [GREEN], ["DSCR"],
                  hline=1.25, hname="1.25x benchmark", fmt="%.2f")

    def _update_dashboard(self):
        R, a = self.R, self.a
        cv = self.card_vars
        cv["tot"].set(f"₹ {R['total_cost']:.2f} Cr")
        cv["prom"].set(f"₹ {R['total_prom']:.2f} Cr")
        cv["loan"].set(f"₹ {R['loan']:.2f} Cr")
        cv["idc"].set(f"₹ {R['idc']:.2f} Cr")
        cv["de"].set("%.2fx" % (R["loan"] / R["total_prom"]) if R["total_prom"] > 0 else "n/a")
        cv["avg"].set("n/a" if R["avg_dscr"] is None else "%.2fx" % R["avg_dscr"])
        cv["min"].set("n/a" if R["min_dscr"] is None else "%.2fx" % R["min_dscr"])
        cv["irr"].set("n/a" if R["irr"] is None else "%.2f%%" % (R["irr"] * 100))
        cv["pb"].set("n/a" if R["payback"] is None else "%.2f yrs" % R["payback"])
        b0 = R["bep_pct"][0]
        cv["bep"].set("n/a" if b0 is None else "%.1f%%" % (b0 * 100))

        for w in self.checks_frame.winfo_children():
            w.destroy()
        tk.Label(self.checks_frame, text="Banker's checks (indicative benchmarks):", bg=BG, fg=PRIMARY,
                 font=FONT_B).pack(side="left", padx=(4, 10))
        de = R["loan"] / R["total_prom"] if R["total_prom"] > 0 else None
        checks = [
            ("Min DSCR \u2265 1.25x", R["min_dscr"] is not None and R["min_dscr"] >= 1.25),
            ("IRR > loan interest rate", R["irr"] is not None and R["irr"] > a["rate"]),
            ("Debt : Equity \u2264 2 : 1", de is not None and de <= 2.0),
            ("Balance sheet tallies", max(abs(x) for x in R["diff"]) < 1e-6),
        ]
        for txt, ok in checks:
            tk.Label(self.checks_frame, text=("PASS  " if ok else "REVIEW  ") + txt,
                     bg=GREEN if ok else RED, fg="white", font=FONT_S, padx=8, pady=3).pack(side="left", padx=4)
        self._draw_charts()

    # ------------------------------------------------------- dynamic cost items
    def _make_row(self, it):
        """Create the StringVars for one cost item and attach live-update traces."""
        r = {
            "name": tk.StringVar(value=it["name"]),
            "cost": tk.StringVar(value=disp(it["cost"])),
            "margin": tk.StringVar(value=disp(it["margin"], True)),
            "cat": tk.StringVar(value=CAT_LABEL.get(it["cat"], CATS[1][1])),
            "bshare": tk.StringVar(value=disp(it["bshare"], True)),
            "phase": [tk.StringVar(value=disp(x, True)) for x in it["phasing"]],
            "phase_last": tk.StringVar(),
            "prom": tk.StringVar(),
            "bank": tk.StringVar(),
        }
        for var in [r["name"], r["cost"], r["margin"], r["cat"], r["bshare"]] + r["phase"]:
            var.trace_add("write", self._refresh_derived)
        return r

    def _clear(self, body):
        for w in body.winfo_children():
            w.destroy()

    def _rebuild_items(self):
        """(Re)draw every table that has one row per cost item."""
        self.dyn_updaters = []
        self.fy_dyn = []
        self._build_cost_section()
        self._build_phasing_section()
        self._build_incurred_section()
        self._build_alloc_section()
        self._build_drawdown_section()
        self._build_cashout_section()
        self._update_fy_labels()

    def _build_cost_section(self):
        b = self.cost_body
        self._clear(b)
        heads = ["Particulars (editable)", "Total Cost", "Margin Requirement (%)",
                 "Promoter's Contribution", "Bank Finance"]
        for c, t in enumerate(heads):
            tk.Label(b, text=t, bg="#EDE7F6", fg=PRIMARY, font=FONT_B, padx=6, pady=4).grid(
                row=0, column=c, sticky="ew", padx=1, pady=1)
        b.columnconfigure(0, weight=1)
        n = len(self.rows)
        for i, r in enumerate(self.rows):
            g = i + 1
            # name box with the remove button placed right after it (same Particulars cell)
            cell = tk.Frame(b, bg=CARD)
            cell.grid(row=g, column=0, sticky="ew", padx=(0, 6), pady=3)
            tk.Button(cell, text="\u2716", command=lambda idx=i: self.remove_item(idx), bg=RED, fg="white",
                      font=FONT_B, relief="flat", bd=0, width=3, cursor="hand2").pack(side="right", padx=(6, 0))
            self._entry(cell, r["name"], 40, justify="left").pack(side="left", fill="x", expand=True)
            self._entry(b, r["cost"], 11).grid(row=g, column=1, padx=6)
            self._entry(b, r["margin"], 10).grid(row=g, column=2, padx=6)
            self._entry(b, r["prom"], 13, True).grid(row=g, column=3, padx=6)
            self._entry(b, r["bank"], 13, True).grid(row=g, column=4, padx=6)

        def total_row(rr, label, keys):
            tk.Label(b, text=label, bg="#FFF3C4", font=FONT_B, anchor="w", padx=4).grid(
                row=rr, column=0, sticky="ew", pady=2)
            for c, k in zip((1, 3, 4), keys):
                self._entry(b, self.d_tot[k], 13 if c > 1 else 11, True).grid(row=rr, column=c, padx=6, pady=2)
            tk.Label(b, text="", bg=CARD).grid(row=rr, column=2)

        total_row(n + 1, "Core Project Cost [A]", ("core_c", "core_p", "core_b"))
        total_row(n + 2, "Interest During Construction [B]  (100 % funded by promoters)",
                  ("idc_c", "idc_p", "idc_b"))
        total_row(n + 3, "Total Project Cost [A+B]", ("tot_c", "tot_p", "tot_b"))
        tk.Button(b, text="\uFF0B  Add Cost Item", command=self.add_item, bg=GREEN, fg="white", font=FONT_B,
                  relief="flat", bd=0, padx=14, pady=5, cursor="hand2").grid(
            row=n + 4, column=0, sticky="w", pady=(12, 2))
        tk.Label(b, text="How each item is depreciated (land, building, equipment) is set in the section "
                         "'Useful Life Assumed for Charging Depreciation' below.",
                 bg=CARD, fg="#777777", font=FONT_S, anchor="w", justify="left", wraplength=1050).grid(
            row=n + 5, column=0, columnspan=5, sticky="w")

    def _build_phasing_section(self):
        b = self.phase_body
        self._clear(b)
        nq = self.nq
        r0 = self._qheader(b, self.fy_dyn)
        for i, r in enumerate(self.rows):
            tk.Label(b, textvariable=r["name"], bg=CARD, font=FONT, anchor="w").grid(
                row=i + r0, column=0, sticky="w", pady=3)
            for q in range(nq - 1):
                self._entry(b, r["phase"][q], 8).grid(row=i + r0, column=q + 1, padx=3)
            self._entry(b, r["phase_last"], 8, True).grid(row=i + r0, column=nq, padx=3)
            self._calc_cell(b, tk.StringVar(value="100"), i + r0, nq + 1, True, "#FFF3C4")
        bar = tk.Frame(b, bg=CARD)
        bar.grid(row=len(self.rows) + r0, column=0, columnspan=nq + 2, sticky="w", pady=(12, 2))
        tk.Button(bar, text="\uFF0B  Add Quarter", command=self.add_quarter, bg=GREEN, fg="white", font=FONT_B,
                  relief="flat", bd=0, padx=14, pady=5, cursor="hand2").pack(side="left")
        tk.Button(bar, text="\uFF0D  Remove Last Quarter", command=self.remove_quarter, bg=ORANGE, fg="white",
                  font=FONT_B, relief="flat", bd=0, padx=14, pady=5, cursor="hand2").pack(side="left", padx=8)
        tk.Label(bar, textvariable=self.tenure_var, bg=CARD, fg=PRIMARY, font=FONT_B).pack(side="left", padx=12)
        tk.Label(b, text="Enter the % of each cost item spent in every quarter. The last quarter is the "
                         "balance (100 % less the other quarters), so each row always totals 100 %.",
                 bg=CARD, fg="#777777", font=FONT_S, anchor="w").grid(
            row=len(self.rows) + r0 + 1, column=0, columnspan=nq + 2, sticky="w")

    def _build_incurred_section(self):
        b = self.incurred_body
        self._clear(b)
        r0 = self._qheader(b, self.fy_dyn)
        U = self.dyn_updaters
        for i, r in enumerate(self.rows):
            self._q_row(b, i + r0, "", lambda R, q, i=i: R["cost_q"][i][q],
                        lambda R, i=i: sum(R["cost_q"][i]), U, label_var=r["name"])
        self._q_row(b, len(self.rows) + r0, "Total Cost Incurred", lambda R, q: R["tot_q"][q],
                    lambda R: sum(R["tot_q"]), U, bold=True)

    def _build_alloc_section(self):
        b = self.alloc_body
        self._clear(b)
        r0 = self._qheader(b, self.fy_dyn)
        U = self.dyn_updaters
        g = r0
        for i, r in enumerate(self.rows):
            tk.Label(b, textvariable=r["name"], bg="#EDE7F6", fg=PRIMARY, font=FONT_B, anchor="w",
                     padx=4).grid(row=g, column=0, columnspan=self.nq + 2, sticky="ew", pady=(6, 1))
            self._q_row(b, g + 1, "Promoter's Funding", lambda R, q, i=i: R["prom_q"][i][q],
                        lambda R, i=i: sum(R["prom_q"][i]), U, indent=True)
            self._q_row(b, g + 2, "Bank Finance", lambda R, q, i=i: R["bank_q"][i][q],
                        lambda R, i=i: sum(R["bank_q"][i]), U, indent=True)
            tv = tk.StringVar()
            U.append(lambda R, tv=tv, r=r: tv.set("Total " + r["name"].get().strip()))
            self._q_row(b, g + 3, "", lambda R, q, i=i: R["cost_q"][i][q],
                        lambda R, i=i: sum(R["cost_q"][i]), U, bold=True, label_var=tv)
            g += 4
        tk.Label(b, text="", bg=CARD).grid(row=g, column=0)
        self._q_row(b, g + 1, "Total Promoters Contribution", lambda R, q: R["prom_tot_q"][q],
                    lambda R: sum(R["prom_tot_q"]), U, bold=True)
        self._q_row(b, g + 2, "Total Bank Finance", lambda R, q: R["bank_tot_q"][q],
                    lambda R: sum(R["bank_tot_q"]), U, bold=True)
        self._q_row(b, g + 3, "Total Project Cost", lambda R, q: R["tot_q"][q],
                    lambda R: sum(R["tot_q"]), U, bold=True)

    def add_quarter(self):
        if self.nq >= MAX_QUARTERS:
            messagebox.showwarning(APP_TITLE, "The construction period can be at most %d quarters (%g years)."
                                   % (MAX_QUARTERS, MAX_QUARTERS / 4.0))
            return
        for r in self.rows:
            # the old balance quarter becomes an input holding its current value;
            # the new last quarter starts as the (zero) balance
            try:
                bal = max(0.0, 1.0 - sum(self._num(v.get(), "x", "pct", 0, 100) for v in r["phase"]))
            except ValueError:
                bal = 0.0
            nv = tk.StringVar(value=disp(bal, True))
            nv.trace_add("write", self._refresh_derived)
            r["phase"].append(nv)
        self.nq += 1
        self._rebuild_items()
        self._refresh_derived()
        self.status.set("Quarter added - construction period is now %d quarters." % self.nq)

    def remove_quarter(self):
        if self.nq <= 1:
            messagebox.showwarning(APP_TITLE, "The construction period needs at least one quarter.")
            return
        if not messagebox.askyesno(APP_TITLE, "Remove the last quarter (Q %s)?\n\nIts cost share is merged into "
                                   "the new last quarter, so every row still totals 100 %%."
                                   % ["I", "II", "III", "IV"][(self.nq - 1) % 4]):
            return
        for r in self.rows:
            r["phase"].pop()
        self.nq -= 1
        self._rebuild_items()
        self._refresh_derived()
        self.status.set("Quarter removed - construction period is now %d quarters." % self.nq)

    def add_item(self):
        if len(self.rows) >= MAX_ITEMS:
            messagebox.showwarning(APP_TITLE, "You can add at most %d cost items." % MAX_ITEMS)
            return
        self.rows.append(self._make_row(new_item("New cost item", 0.0, 0.25, "building", nq=self.nq)))
        self._rebuild_items()
        self._refresh_derived()
        self.status.set("Cost item added - rename it and enter its cost, margin and phasing.")

    def remove_item(self, idx):
        if len(self.rows) <= 1:
            messagebox.showwarning(APP_TITLE, "At least one cost item is required.")
            return
        name = self.rows[idx]["name"].get().strip() or "this item"
        if not messagebox.askyesno(APP_TITLE, "Remove the cost item '%s'?" % name):
            return
        del self.rows[idx]
        self._rebuild_items()
        self._refresh_derived()
        self.status.set("Cost item removed: " + name)

    def _update_inst_info(self, loan=None):
        """Frequency / size of each installment - needs only the tenure and installment inputs."""
        try:
            t = self._num(self.v["tenure"].get(), "x", "int", 1, MAX_YEARS)
            n = self._num(self.v["installments"].get(), "x", "int", 1, None)
        except ValueError:
            self.inst_info.set("")
            return
        if n > 12 * t:
            self.inst_info.set("Maximum %d installments for a %d-year tenure (12 a year)" % (12 * t, t))
            return
        if loan is not None:
            self._loan_cache = loan
        rt = REPAY_KEYS.get(self.v_repay_type.get(), "stepped")
        if rt == "stepped" and t == 10:
            text = "Stepped Profile: Y1: 2.5%, Y2: 5.0%, Y3: 7.5%, Y4: 10.0%, Y5-10: 12.5% each"
            if self._loan_cache is not None:
                text += "   |   Y1: Rs. {:,.2f} Cr  ...  Y5-10: Rs. {:,.2f} Cr/yr".format(
                    self._loan_cache * 0.025, self._loan_cache * 0.125)
            self.inst_info.set(text)
            return
        months = 12.0 * t / n
        freq = {1: "monthly", 3: "quarterly", 6: "half-yearly", 12: "yearly"}.get(months, "")
        text = "Installment every %g month%s%s   |   each installment = %s%% of the loan" % (
            round(months, 2), "" if months == 1 else "s", " (" + freq + ")" if freq else "",
            ("%.2f" % (100.0 / n)).rstrip("0").rstrip("."))
        if self._loan_cache is not None:
            text += " (Rs. %s Cr)" % "{:,.2f}".format(self._loan_cache / n)
        self.inst_info.set(text)

    def _update_fy_labels(self):
        self._update_inst_info()
        nq = self.nq
        ny = (nq + 3) // 4
        text = "Construction period: %d quarter%s (%g years)" % (nq, "" if nq == 1 else "s", nq / 4.0)
        try:
            y = self._num(self.v["start_fy"].get(), "x", "int", 1990, 2100)
        except ValueError:
            self.tenure_var.set(text)
            self.repay_info.set("")
            return
        self.tenure_var.set(text + "   |   operations begin in " + fy_label(y + ny))
        try:
            n = self._num(self.v["tenure"].get(), "x", "int", 1, MAX_YEARS)
            self.repay_info.set("Repayment: %d year%s  (%s to %s)" %
                                (n, "" if n == 1 else "s", fy_label(y + ny), fy_label(y + ny + n - 1)))
        except ValueError:
            self.repay_info.set("")
        for lst in (self.fy_static, self.fy_dyn):
            for lab, off in lst:
                try:
                    lab.configure(text=fy_label(y + off))
                except tk.TclError:
                    pass

    def _apply_updaters(self, R):
        for fn in self.static_updaters + self.dyn_updaters:
            fn(R)

    # ------------------------------------------------------------- form logic
    def _hook_traces(self):
        all_vars = [self.v_name, self.v_repay_type] + list(self.v.values())
        for var in all_vars:
            var.trace_add("write", self._refresh_derived)

    def _num(self, s, label, kind="num", lo=None, hi=None):
        txt = str(s).strip().replace(",", "")
        if txt == "":
            raise ValueError("'%s' is empty." % label)
        try:
            v = float(txt)
        except ValueError:
            raise ValueError("'%s' must be a number (you entered '%s')." % (label, s))
        if v != v or v in (float("inf"), float("-inf")):
            raise ValueError("'%s' is not a valid number." % label)
        if lo is not None and v < lo:
            raise ValueError("'%s' must be at least %g." % (label, lo))
        if hi is not None and v > hi:
            raise ValueError("'%s' must not be more than %g." % (label, hi))
        if kind == "int":
            if not float(v).is_integer():
                raise ValueError("'%s' must be a whole number." % label)
            return int(v)
        if kind == "pct":
            return v / 100.0
        return v

    def get_assumptions(self):
        a = {"project_name": self.v_name.get().strip() or "Hotel Project"}
        for key, label, kind, unit, lo, hi in ALL_SCALARS:
            a[key] = self._num(self.v[key].get(), label, kind, lo, hi)
        a["repay_type"] = REPAY_KEYS.get(self.v_repay_type.get(), "stepped")
        if not self.rows:
            raise ValueError("Add at least one cost item.")
        items = []
        for i, r in enumerate(self.rows):
            name = r["name"].get().strip()
            if not name:
                raise ValueError("Cost item no. %d has no name." % (i + 1))
            cost = self._num(r["cost"].get(), "Total cost - " + name, "num", 0, None)
            margin = self._num(r["margin"].get(), "Margin requirement - " + name, "pct", 0, 100)
            cat = CAT_KEY.get(r["cat"].get(), "building")
            if cat == "shared":
                bshare = self._num(r["bshare"].get(), "Building share - " + name, "pct", 0, 100)
            else:
                try:
                    bshare = self._num(r["bshare"].get(), "x", "pct", 0, 100)
                except ValueError:
                    bshare = 0.5
            ph = [self._num(r["phase"][q].get(), "Phasing Q%d - %s" % (q + 1, name), "pct", 0, 100)
                  for q in range(len(r["phase"]))]
            if sum(ph) > 1.0 + 1e-9:
                raise ValueError("Cost phasing for '%s' adds up to more than 100 %%." % name)
            items.append({"name": name, "cost": cost, "margin": margin, "cat": cat,
                          "bshare": bshare, "phasing": ph})
        a["items"] = items
        a["quarters"] = self.nq
        if a["installments"] > 12 * a["tenure"]:
            raise ValueError("Number of installments cannot exceed 12 a year (monthly): for a tenure of %d year%s "
                             "the maximum is %d." % (a["tenure"], "" if a["tenure"] == 1 else "s", 12 * a["tenure"]))
        if a["room_share"] + a["fb_share"] > 1.0 + 1e-9:
            raise ValueError("Room revenue % + Food & beverage % must not exceed 100 %.")
        a["others_share"] = max(0.0, 1.0 - a["room_share"] - a["fb_share"])

        # Front page details (Title block, bank submission, entity details, promoters)
        for key in FRONT_PAGE_KEYS:
            if key in self.txt_fields:
                a[key] = self.txt_fields[key].get("1.0", "end-1c").strip()
            elif key in self.v_front:
                a[key] = self.v_front[key].get().strip()
            else:
                a[key] = DEFAULTS.get(key, "")
        return a

    def _load_into_form(self, d):
        self._loading = True
        try:
            self.v_name.set(d["project_name"])
            self.v_repay_type.set(REPAY_LABELS.get(d.get("repay_type", "stepped"), REPAY_LABELS["stepped"]))
            for key, label, kind, unit, lo, hi in ALL_SCALARS:
                self.v[key].set(disp(d[key], kind == "pct"))
            self.nq = d["quarters"]
            self.rows = [self._make_row(it) for it in d["items"]]
            self._rebuild_items()

            # Load front page fields
            for key in FRONT_PAGE_KEYS:
                val = d.get(key, DEFAULTS.get(key, ""))
                if key in self.txt_fields:
                    self.txt_fields[key].delete("1.0", "end")
                    self.txt_fields[key].insert("1.0", str(val))
                elif key in self.v_front:
                    self.v_front[key].set(str(val))
        finally:
            self._loading = False

    def _refresh_derived(self, *_):
        if self._loading:
            return
        # balancing quarter / year / revenue share
        for r in self.rows:
            try:
                s = sum(self._num(v.get(), "x", "pct", 0, 100) for v in r["phase"])
                r["phase_last"].set(disp(1.0 - s, True) if s <= 1.0 + 1e-9 else "over 100")
            except ValueError:
                r["phase_last"].set("?")
        try:
            r1 = self._num(self.v["room_share"].get(), "x", "pct", 0, 100)
            r2 = self._num(self.v["fb_share"].get(), "x", "pct", 0, 100)
            self.others_var.set(disp(1.0 - r1 - r2, True) if r1 + r2 <= 1.0 + 1e-9 else "over 100")
        except ValueError:
            self.others_var.set("?")
        self._update_fy_labels()
        # project cost table
        try:
            a = self.get_assumptions()
            R = compute(a)
        except ValueError:
            return
        f2 = lambda x: "{:,.2f}".format(x)
        for i, r in enumerate(self.rows):
            r["prom"].set(f2(R["prom_item"][i]))
            r["bank"].set(f2(R["bank_item"][i]))
        t = self.d_tot
        t["core_c"].set(f2(R["core"]))
        t["core_p"].set(f2(R["core_prom"]))
        t["core_b"].set(f2(R["core_bank"]))
        t["idc_c"].set(f2(R["idc"]))
        t["idc_p"].set(f2(R["idc"]))
        t["idc_b"].set(f2(0.0))
        t["tot_c"].set(f2(R["total_cost"]))
        t["tot_p"].set(f2(R["total_prom"]))
        t["tot_b"].set(f2(R["total_bank"]))
        self._update_inst_info(R["loan"])
        if self.lbl_front_model_loan:
            self.lbl_front_model_loan.config(text=f"(Model computed Term Loan: Rs. {R['total_bank']:,.2f} Cr)")
        self._apply_updaters(R)

    # ------------------------------------------------------------ report logic
    def _fill_tree(self, tv, rows):
        tv.delete(*tv.get_children())
        ncols = max(len(r[2]) for r in rows)
        cols = ["c%d" % i for i in range(ncols + 1)]
        tv["columns"] = cols
        first = rows[0]
        for i, c in enumerate(cols):
            if i == 0:
                tv.heading(c, text=first[1], anchor="w")
                tv.column(c, width=400, minwidth=260, anchor="w", stretch=False)
            else:
                txt = first[2][i - 1] if i - 1 < len(first[2]) else ""
                tv.heading(c, text=txt, anchor="e")
                tv.column(c, width=98, minwidth=80, anchor="e", stretch=False)
        odd = False
        for kind, label, vals, f in rows[1:]:
            fl = f if isinstance(f, list) else [f] * max(1, len(vals))
            cells = [label]
            for i, v in enumerate(vals):
                cells.append(fmt_val(v, fl[i] if i < len(fl) else fl[-1]))
            cells += [""] * (ncols + 1 - len(cells))
            if kind == "row":
                tag = "odd" if odd else "even"
                odd = not odd
                cells[0] = "   " + cells[0]
            elif kind == "check":
                good = all(isinstance(v, (int, float)) and abs(v) < 1e-6 for v in vals)
                tag = "ok" if good else "bad"
            else:
                tag = kind
            tv.insert("", "end", values=cells, tags=(tag,))

    def generate_report(self, silent=False):
        try:
            a = self.get_assumptions()
        except ValueError as err:
            self.nb.select(self.tab_assump)
            messagebox.showerror(APP_TITLE, "Please correct the assumptions:\n\n" + str(err))
            return
        try:
            R = compute(a)
            IS, BS, CF = build_reports(a, R)
        except Exception as err:            # defensive: never crash the window
            messagebox.showerror(APP_TITLE, "Could not build the report:\n\n%s" % err)
            return
        self.a, self.R = a, R
        self.reports = (IS, BS, CF)
        self._fill_tree(self.tv_is, IS)
        self._fill_tree(self.tv_bs, BS)
        self._fill_tree(self.tv_cf, CF)
        self._update_dashboard()
        tally = max(abs(x) for x in R["diff"]) < 1e-6
        self.status.set("Report generated for '%s'   |   Total project cost Rs. %.2f Cr   |   "
                        "Balance sheet %s" % (a["project_name"], R["total_cost"],
                                              "tallies" if tally else "DOES NOT TALLY"))
        if not silent:
            self.nb.select(self.tab_dash)

    # -------------------------------------------------------------- toolbar ops
    def reset_defaults(self):
        if messagebox.askyesno(APP_TITLE, "Reset all assumptions to the case-study defaults?"):
            self._load_into_form(DEFAULTS)
            self._refresh_derived()
            self.generate_report(silent=True)
            self.status.set("Assumptions reset to defaults.")

    def save_assumptions(self):
        try:
            a = self.get_assumptions()
        except ValueError as err:
            messagebox.showerror(APP_TITLE, "Please correct the assumptions first:\n\n" + str(err))
            return
        path = filedialog.asksaveasfilename(
            title="Save assumptions", defaultextension=".json",
            filetypes=[("Assumption file", "*.json")], initialfile="assumptions.json")
        if not path:
            return
        data = {k: v for k, v in a.items() if k != "others_share"}
        try:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=2)
            self.status.set("Assumptions saved to " + path)
        except OSError as err:
            messagebox.showerror(APP_TITLE, "Could not save the file:\n\n%s" % err)

    def _merge_loaded(self, loaded):
        """Copy only well-formed values from a loaded file onto the defaults."""
        if not isinstance(loaded, dict):
            raise ValueError("The file does not contain assumptions.")
        d = copy.deepcopy(DEFAULTS)
        isnum = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
        if isinstance(loaded.get("project_name"), str):
            d["project_name"] = loaded["project_name"][:80]
        for key in FRONT_PAGE_KEYS:
            if isinstance(loaded.get(key), str):
                d[key] = loaded[key]
        for key, *_ in ALL_SCALARS:
            if isnum(loaded.get(key)):
                d[key] = loaded[key]
        # tenure / installments: must be whole numbers in range; older files (typed % row) get annual installments
        t = d["tenure"]
        if not (float(t).is_integer() and 1 <= t <= MAX_YEARS):
            t = DEFAULTS["tenure"]
            v = loaded.get("repay")
            if isinstance(v, list) and 0 <= len(v) < MAX_YEARS and all(isnum(x) for x in v):
                t = len(v) + 1
        d["tenure"] = int(t)
        i = d["installments"] if isnum(loaded.get("installments")) else d["tenure"]
        if not (float(i).is_integer() and 1 <= i <= 12 * d["tenure"]):
            i = d["tenure"]
        d["installments"] = int(i)
        if loaded.get("repay_type") in REPAY_LABELS:
            d["repay_type"] = loaded["repay_type"]

        raw = loaded.get("items")
        if raw is None and all(k in loaded for k in ("cost", "margin", "phasing")):
            # older file format (fixed five items) - keep the default names
            try:
                raw = []
                for i in range(len(loaded["cost"])):
                    base = DEFAULTS["items"][i] if i < len(DEFAULTS["items"]) else new_item()
                    raw.append({"name": base["name"], "cost": loaded["cost"][i],
                                "margin": loaded["margin"][i], "cat": base["cat"],
                                "bshare": 0.5, "phasing": loaded["phasing"][i]})
            except (IndexError, TypeError, KeyError):
                raw = None
        if isinstance(raw, list):
            items = []
            for it in raw[:MAX_ITEMS]:
                if not isinstance(it, dict):
                    continue
                ph = it.get("phasing")
                if (isinstance(it.get("name"), str) and it["name"].strip() and isnum(it.get("cost"))
                        and isnum(it.get("margin")) and isinstance(ph, list)
                        and len(ph) < MAX_QUARTERS and all(isnum(x) for x in ph)):
                    items.append({"name": it["name"].strip()[:80], "cost": it["cost"],
                                  "margin": it["margin"],
                                  "cat": it.get("cat") if it.get("cat") in CAT_LABEL else "building",
                                  "bshare": it["bshare"] if isnum(it.get("bshare")) else 0.5,
                                  "phasing": list(ph)})
            if items:
                d["items"] = items
                nq = loaded.get("quarters")
                if not (isnum(nq) and float(nq).is_integer() and 1 <= nq <= MAX_QUARTERS):
                    nq = len(items[0]["phasing"]) + 1          # older files: infer from the phasing rows
                d["quarters"] = int(nq)
        # every item must carry exactly (quarters - 1) phasing inputs
        nq = d["quarters"]
        for it in d["items"]:
            ph = list(it["phasing"])[:nq - 1]
            it["phasing"] = ph + [0.0] * (nq - 1 - len(ph))
        return d

    def load_assumptions(self):
        path = filedialog.askopenfilename(title="Load assumptions",
                                          filetypes=[("Assumption file", "*.json")])
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as fh:
                loaded = json.load(fh)
            d = self._merge_loaded(loaded)
        except (OSError, ValueError) as err:
            messagebox.showerror(APP_TITLE, "Could not read the file:\n\n%s" % err)
            return
        self._load_into_form(d)
        self._refresh_derived()
        self.generate_report(silent=True)
        self.status.set("Assumptions loaded from " + path)

    def export_excel(self):
        try:
            a = self.get_assumptions()
        except ValueError as err:
            messagebox.showerror(APP_TITLE, "Please correct the assumptions first:\n\n" + str(err))
            return
        try:
            import openpyxl
        except ImportError:
            messagebox.showerror(APP_TITLE, "Excel export needs the 'openpyxl' library.\n\n"
                                 "Open CMD and run:\n    python -m pip install openpyxl")
            return
        path = filedialog.asksaveasfilename(
            title="Export reports to Excel", defaultextension=".xlsx",
            filetypes=[("Excel workbook", "*.xlsx")], initialfile="Detailed_Project_Report.xlsx")
        if not path:
            return
        R = compute(a)
        try:
            export_to_excel(path, a, R)
        except (OSError, PermissionError) as err:
            messagebox.showerror(APP_TITLE, "Could not write the Excel file (is it open in Excel?):\n\n%s" % err)
            return
        except Exception as err:
            messagebox.showerror(APP_TITLE, "Failed to generate Excel workbook:\n\n%s" % err)
            return
        self.status.set("Exported to " + path)
        messagebox.showinfo(APP_TITLE, "Reports exported successfully:\n" + path)

    def export_pdf(self):
        try:
            a = self.get_assumptions()
        except ValueError as err:
            messagebox.showerror(APP_TITLE, "Please correct the assumptions first:\n\n" + str(err))
            return
        try:
            import reportlab
        except ImportError:
            messagebox.showerror(APP_TITLE, "PDF export needs the 'reportlab' library.\n\n"
                                 "Open CMD and run:\n    python -m pip install reportlab")
            return
        path = filedialog.asksaveasfilename(
            title="Export reports to PDF", defaultextension=".pdf",
            filetypes=[("PDF document", "*.pdf")], initialfile="Detailed_Project_Report.pdf")
        if not path:
            return
        R = compute(a)
        try:
            export_to_pdf(path, a, R)
        except (OSError, PermissionError) as err:
            messagebox.showerror(APP_TITLE, "Could not write the PDF file (is it open in a PDF reader?):\n\n%s" % err)
            return
        except Exception as err:
            messagebox.showerror(APP_TITLE, "Failed to generate PDF report:\n\n%s" % err)
            return
        self.status.set("Exported to " + path)
        messagebox.showinfo(APP_TITLE, "PDF report exported successfully:\n" + path)


# --------------------------------------------------------------------------
# 10-Sheet Live-Formula Excel Export Engine
# --------------------------------------------------------------------------

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, LineChart, Reference

def export_to_excel(output_path, a, R):
    NAVY = "1F3864"
    WHITE = "FFFFFF"
    SLATE = "2F5597"
    LIGHT_GREY = "F2F2F2"
    YELLOW_FILL = "FFF2CC"
    BLUE_FONT = "002060"
    BLACK = "000000"
    GREEN_FILL = "E2EFDA"
    GREEN_FONT = "276A3C"
    
    f_title = Font(name="Calibri", size=14, bold=True, color=NAVY)
    f_sec = Font(name="Calibri", size=10.5, bold=True, color=NAVY)
    f_hdr = Font(name="Calibri", size=10, bold=True, color=WHITE)
    f_body = Font(name="Calibri", size=10, color=BLACK)
    f_bold = Font(name="Calibri", size=10, bold=True, color=BLACK)
    f_input = Font(name="Calibri", size=10, color=BLUE_FONT)
    f_green = Font(name="Calibri", size=10, bold=True, color=GREEN_FONT)
    f_note = Font(name="Calibri", size=9, italic=True, color="555555")
    
    fill_hdr = PatternFill("solid", start_color=NAVY, end_color=NAVY)
    fill_sec = PatternFill("solid", start_color="D9E1F2", end_color="D9E1F2")
    fill_alt = PatternFill("solid", start_color=LIGHT_GREY, end_color=LIGHT_GREY)
    fill_input = PatternFill("solid", start_color=YELLOW_FILL, end_color=YELLOW_FILL)
    fill_green = PatternFill("solid", start_color=GREEN_FILL, end_color=GREEN_FILL)
    fill_total = PatternFill("solid", start_color="D9E1F2", end_color="D9E1F2")
    
    thin_side = Side(style="thin", color="D9D9D9")
    med_side = Side(style="medium", color=NAVY)
    double_side = Side(style="double", color=NAVY)
    
    border_cell = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    border_total = Border(top=thin_side, bottom=thin_side, left=thin_side, right=thin_side)
    border_grand = Border(top=med_side, bottom=double_side, left=thin_side, right=thin_side)
    
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    align_center = Alignment(horizontal="center", vertical="center")
    
    FMT_INR = '#,##,##0.00;(#,##,##0.00);"-"'
    FMT_PCT = '0.00%'
    FMT_INT = '#,##0'
    FMT_X = '0.00"x"'

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    
    items = a["items"]
    n_items = len(items)
    nq = a.get("nq", 8)
    ny = 10
    ops_years = [f"FY{a['start_fy'] + (nq // 4) + y}" for y in range(ny)]

    def apply_page_setup(ws, landscape=True, title_rows='3:3'):
        ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE if landscape else ws.ORIENTATION_PORTRAIT
        ws.page_setup.paperSize = ws.PAPERSIZE_A4
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.oddFooter.right.text = "Page &P of &N"
        ws.oddFooter.left.text = "Confidential - Bank Credit Appraisal Dossier"
        ws.oddHeader.left.text = f"{a.get('entity_name', 'Detailed Project Report')}  |  {ws.title}"
        if title_rows:
            ws.print_title_rows = title_rows

    def autofit_cols(ws, min_w=13, max_w=45):
        for col in ws.columns:
            col_letter = get_column_letter(col[0].column)
            max_len = 0
            for cell in col:
                val = str(cell.value or '')
                if cell.number_format and ('0.00' in cell.number_format or '%' in cell.number_format):
                    max_len = max(max_len, 14)
                elif '\n' in val:
                    lines = val.split('\n')
                    max_len = max(max_len, max(len(l) for l in lines))
                else:
                    max_len = max(max_len, len(val))
            if col_letter == 'A':
                ws.column_dimensions[col_letter].width = 4
            elif col_letter == 'B':
                ws.column_dimensions[col_letter].width = max(38, min(max_len + 3, max_w))
            else:
                ws.column_dimensions[col_letter].width = max(min_w, min(max_len + 3, 20))

    # =========================================================================
    # 1. SHEET 1: COVER
    # =========================================================================
    ws1 = wb.create_sheet("Cover")
    apply_page_setup(ws1, landscape=False, title_rows=None)
    
    ws1.cell(row=2, column=2, value="DETAILED PROJECT REPORT (DPR)").font = Font(name="Calibri", size=18, bold=True, color=NAVY)
    ws1.cell(row=3, column=2, value="TERM LOAN CREDIT APPRAISAL DOSSIER").font = Font(name="Calibri", size=12, bold=True, color=SLATE)
    
    cover_data = [
        ("PROJECT TITLE & PURPOSE", [
            ("Project Name", a.get("project_name", "Detailed Project Report")),
            ("Project Purpose / Activity", a.get("project_purpose", "Setting up a 5-Star Luxury Resort")),
            ("Project / Unit Location", a.get("unit_location", "Goa, India")),
        ]),
        ("CREDIT FACILITIES SOUGHT", [
            ("Term Loan Facility", a.get("facility_term_loan", "₹ 70.00 Crore")),
            ("Working Capital Facility", a.get("facility_wc", "₹ 5.00 Crore")),
            ("Total Credit Facility", a.get("facility_total", "₹ 75.00 Crore")),
        ]),
        ("LENDER / BANK SUBMISSION", [
            ("Submitted To (Bank Name)", a.get("bank_name", "State Bank of India")),
            ("Branch Name", a.get("bank_branch", "Commercial Branch")),
            ("Branch Address", a.get("bank_address", "Nariman Point, Mumbai - 400021")),
        ]),
        ("BORROWING ENTITY DETAILS", [
            ("Name of the Entity", a.get("entity_name", "Grand Horizon Hospitality Pvt Ltd")),
            ("Constitution", a.get("constitution", "Private Limited Company")),
            ("Registered Office Address", a.get("reg_address", "124 Hospitality Boulevard, Mumbai")),
            ("Date of Commencement", a.get("commencement_date", "15-Aug-2026")),
            ("Permanent Account Number (PAN)", a.get("pan", "AAACG1234F")),
            ("GST Registration Number (GSTIN)", a.get("gstin", "27AAACG1234F1Z5")),
            ("Udyam (MSME) Registration", a.get("udyam", "UDYAM-MH-03-0012345 (Medium)")),
            ("Corporate Identity Number (CIN)", a.get("cin", "U55101MH2024PTC123456")),
            ("Statutory Licences", a.get("licences", "FSSAI, Star Classification, Fire NOC, Pollution Consent")),
        ]),
        ("PROMOTER / MANAGEMENT DETAILS", [
            ("Promoter / Managing Director", a.get("promoter_name", "Rajesh V. Sharma")),
            ("Promoter Shareholding & Net Worth", a.get("promoter_networth", "65.0% Equity | Net Worth: ₹ 95.00 Cr")),
            ("Authorised Signatory", a.get("auth_signatory", "Rajesh V. Sharma (Managing Director)")),
            ("Promoter CIBIL / Credit Score", a.get("cibil_score", "785 (Excellent Track Record)")),
        ]),
    ]
    
    cr = 5
    for sec_title, fields in cover_data:
        ws1.cell(row=cr, column=2, value=sec_title).font = Font(name="Calibri", size=10, bold=True, color=WHITE)
        ws1.cell(row=cr, column=2).fill = fill_hdr
        ws1.cell(row=cr, column=3).fill = fill_hdr
        ws1.row_dimensions[cr].height = 20
        cr += 1
        for lbl, val in fields:
            ws1.cell(row=cr, column=2, value=lbl).font = f_bold
            ws1.cell(row=cr, column=2).fill = fill_alt
            ws1.cell(row=cr, column=2).border = border_cell
            ws1.cell(row=cr, column=3, value=val).font = f_body
            ws1.cell(row=cr, column=3).border = border_cell
            cr += 1
        cr += 1
        
    ws1.column_dimensions["A"].width = 4
    ws1.column_dimensions["B"].width = 34
    ws1.column_dimensions["C"].width = 58
    ws1.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 2. SHEET 2: ASSUMPTIONS
    # =========================================================================
    ws2 = wb.create_sheet("Assumptions")
    apply_page_setup(ws2, landscape=True, title_rows='3:3')
    
    ws2.cell(row=1, column=2, value="DETAILED PROJECT REPORT - FINANCIAL MODEL ASSUMPTIONS").font = f_title
    ws2.cell(row=2, column=2, value="All amounts in ₹ in Crore unless stated otherwise. Input cells in blue font with light yellow fill.").font = f_note
    
    scalars = [
        (4, "1. PROJECT TIMELINE & CAPACITY", None, None, None),
        (5, None, "Construction Start Financial Year (FY)", a.get("start_fy", 2026), FMT_INT),
        (6, None, "Construction Phasing Period (Quarters)", nq, FMT_INT),
        (7, None, "Operating Projection Horizon (Years)", ny, FMT_INT),
        (8, None, "Hotel Room Capacity (Keys)", a.get("rooms", 125), FMT_INT),
        (9, None, "Operating Days per Calendar Year", a.get("days", 365), FMT_INT),
        
        (11, "2. TARIFF & OCCUPANCY PARAMETERS", None, None, None),
        (12, None, "Initial Room Tariff in Year 1 (₹ per room/day)", a.get("tariff", 10000.0), FMT_INR),
        (13, None, "Annual Tariff Escalation Rate", a.get("tariff_inc", 0.05), FMT_PCT),
        (14, None, "Year 1 Occupancy Rate", a.get("occ", 0.65), FMT_PCT),
        (15, None, "Annual Occupancy Ramp-Up Rate", a.get("occ_inc", 0.05), FMT_PCT),
        (16, None, "Maximum Occupancy Cap", a.get("occ_cap", 0.80), FMT_PCT),
        (17, None, "Rooms Revenue Share of Total Revenue", a.get("room_share", 0.55), FMT_PCT),
        (18, None, "F&B Revenue Share of Total Revenue", a.get("fb_share", 0.30), FMT_PCT),
        (19, None, "Other Sources Share of Total Revenue", max(0.0, 1.0 - a.get("room_share", 0.55) - a.get("fb_share", 0.30)), FMT_PCT),
        
        (21, "3. OPERATING EXPENDITURE BENCHMARKS (% OF REVENUE)", None, None, None),
        (22, None, "F&B Consumables Cost (% of Total Revenue)", a.get("exp_fb", 0.09), FMT_PCT),
        (23, None, "Employee Costs (% of Total Revenue)", a.get("exp_emp", 0.14), FMT_PCT),
        (24, None, "Power & Fuel Expenses (% of Total Revenue)", a.get("exp_power", 0.10), FMT_PCT),
        (25, None, "Other Variable Operating Expenses (% of Total Revenue)", a.get("exp_oth", 0.08), FMT_PCT),
        (26, None, "Management / Service Fees (% of Room Revenue)", a.get("exp_service", 0.03), FMT_PCT),
        (27, None, "Administrative & General Expenses (% of Year 1 Rev)", a.get("admin", 0.12), FMT_PCT),
        (28, None, "Annual Admin Expenses Inflation Rate", a.get("admin_inc", 0.05), FMT_PCT),
        
        (30, "4. DEPRECIATION, TAXATION & FINANCING PARAMETERS", None, None, None),
        (31, None, "Useful Asset Life: Hotel Building (Years)", a.get("life_bldg", 60.0), FMT_INT),
        (32, None, "Useful Asset Life: Plant & Equipment (Years)", a.get("life_equip", 15.0), FMT_INT),
        (33, None, "Applicable Corporate Tax Rate", a.get("tax", 0.25), FMT_PCT),
        (34, None, "Term Loan Interest Rate (p.a.)", a.get("rate", 0.10), FMT_PCT),
        (35, None, "Term Loan Repayment Tenure (Years)", a.get("tenure", 10), FMT_INT),
        (36, None, "Total Installments (Quarterly / Monthly)", a.get("installments", 120), FMT_INT),
    ]
    
    for r, sec, lbl, val, fmt in scalars:
        if sec:
            ws2.cell(row=r, column=2, value=sec).font = Font(name="Calibri", size=10, bold=True, color=WHITE)
            ws2.cell(row=r, column=2).fill = fill_hdr
            ws2.cell(row=r, column=3).fill = fill_hdr
        else:
            ws2.cell(row=r, column=2, value=lbl).font = f_body
            ws2.cell(row=r, column=2).border = border_cell
            c = ws2.cell(row=r, column=3, value=val)
            c.font = f_input
            c.fill = fill_input
            c.border = border_cell
            c.number_format = fmt
            c.alignment = align_right

    # Section 5: Repayment Schedule Percentages
    ws2.cell(row=38, column=2, value="5. ANNUAL TERM LOAN PRINCIPAL REPAYMENT SCHEDULE (% OF LOAN)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 13):
        ws2.cell(row=38, column=c_i).fill = fill_hdr
        
    for y_idx in range(ny):
        col = 3 + y_idx
        ws2.cell(row=39, column=col, value=f"Y{y_idx+1}").font = f_bold
        ws2.cell(row=39, column=col).fill = fill_sec
        ws2.cell(row=39, column=col).alignment = align_center
        ws2.cell(row=39, column=col).border = border_cell
        
        rep_v = R["rep_pct"][y_idx] if y_idx < len(R["rep_pct"]) else 0.10
        c = ws2.cell(row=40, column=col, value=rep_v)
        c.font = f_input
        c.fill = fill_input
        c.number_format = FMT_PCT
        c.alignment = align_right
        c.border = border_cell
    ws2.cell(row=40, column=2, value="Repayment Percentage of Total Term Loan").font = f_body
    ws2.cell(row=40, column=2).border = border_cell

    # Section 6: Project Cost Items, Financing Margins & Phasing Table (₹ in lakh)
    ws2.cell(row=42, column=2, value="6. PROJECT COST ITEMS, PROMOTER MARGINS & QUARTERLY PHASING (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 15):
        ws2.cell(row=42, column=c_i).fill = fill_hdr
        
    item_hdrs = ["Cost Item Description", "Estimated Cost (₹ in Crore)", "Margin %", "Category", "Bldg Share %"] + [f"Q{q+1}" for q in range(nq)]
    for idx, h_text in enumerate(item_hdrs):
        col = 2 + idx
        ws2.cell(row=43, column=col, value=h_text).font = f_bold
        ws2.cell(row=43, column=col).fill = fill_sec
        ws2.cell(row=43, column=col).alignment = align_center if idx > 0 else align_left
        ws2.cell(row=43, column=col).border = border_cell

    for i, it in enumerate(items):
        r = 44 + i
        ws2.cell(row=r, column=2, value=it["name"]).font = f_body
        ws2.cell(row=r, column=2).border = border_cell
        
        c = ws2.cell(row=r, column=3, value=it["cost"])
        c.font = f_input
        c.fill = fill_input
        c.number_format = FMT_INR
        c.alignment = align_right
        c.border = border_cell
        
        c = ws2.cell(row=r, column=4, value=it["margin"])
        c.font = f_input
        c.fill = fill_input
        c.number_format = FMT_PCT
        c.alignment = align_right
        c.border = border_cell
        
        c = ws2.cell(row=r, column=5, value=it["cat"])
        c.font = f_input
        c.fill = fill_input
        c.alignment = align_center
        c.border = border_cell
        
        c = ws2.cell(row=r, column=6, value=it.get("bshare", 0.0))
        c.font = f_input
        c.fill = fill_input
        c.number_format = FMT_PCT
        c.alignment = align_right
        c.border = border_cell
        
        ph = list(it["phasing"])
        for q in range(nq):
            col = 7 + q
            v = ph[q] if q < len(ph) else 0.0
            c = ws2.cell(row=r, column=col, value=v)
            c.font = f_input
            c.fill = fill_input
            c.number_format = FMT_PCT
            c.alignment = align_right
            c.border = border_cell

    autofit_cols(ws2)
    ws2.freeze_panes = "C4"
    ws2.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 3. SHEET 3: PROJECT COST & FINANCE
    # =========================================================================
    ws3 = wb.create_sheet("Project Cost & Finance")
    apply_page_setup(ws3, landscape=True, title_rows='3:3')
    
    ws3.cell(row=1, column=2, value="PROJECT COST BREAKDOWN, FINANCING PLAN & DRAWDOWN SCHEDULE (₹ in Crore)").font = f_title
    ws3.cell(row=2, column=2, value="All figures in ₹ in Crore. Fully dynamic formulas linked to Assumptions sheet.").font = f_note
    
    # Table 1: Cost & Means of Finance
    ws3.cell(row=4, column=2, value="1. PROJECT COST BREAKDOWN & FINANCING PLAN").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 9):
        ws3.cell(row=4, column=c_i).fill = fill_hdr
        
    t1_hdrs = ["Cost Component / Particulars", "Estimated Cost", "Promoter Margin %", "Promoter Contribution", "Bank Finance", "Promoter Share %", "Bank Share %"]
    for idx, h_text in enumerate(t1_hdrs):
        col = 2 + idx
        ws3.cell(row=5, column=col, value=h_text).font = f_bold
        ws3.cell(row=5, column=col).fill = fill_sec
        ws3.cell(row=5, column=col).alignment = align_center if idx > 0 else align_left
        ws3.cell(row=5, column=col).border = border_cell

    for i in range(n_items):
        r = 6 + i
        item_r = 44 + i
        ws3.cell(row=r, column=2, value=f"=Assumptions!B{item_r}").font = f_body
        ws3.cell(row=r, column=2).border = border_cell
        
        c = ws3.cell(row=r, column=3, value=f"=Assumptions!C{item_r}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        
        c = ws3.cell(row=r, column=4, value=f"=Assumptions!D{item_r}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell
        
        c = ws3.cell(row=r, column=5, value=f"=C{r}*D{r}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        
        c = ws3.cell(row=r, column=6, value=f"=C{r}-E{r}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        
        c = ws3.cell(row=r, column=7, value=f"=E{r}/C{r}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell
        
        c = ws3.cell(row=r, column=8, value=f"=F{r}/C{r}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell

    r_core = 6 + n_items
    ws3.cell(row=r_core, column=2, value="Core Project Cost [A]").font = f_bold
    ws3.cell(row=r_core, column=2).fill = fill_total; ws3.cell(row=r_core, column=2).border = border_total
    
    ws3.cell(row=r_core, column=3, value=f"=SUM(C6:C{r_core-1})").font = f_bold
    ws3.cell(row=r_core, column=3).number_format = FMT_INR; ws3.cell(row=r_core, column=3).alignment = align_right
    ws3.cell(row=r_core, column=3).fill = fill_total; ws3.cell(row=r_core, column=3).border = border_total
    
    ws3.cell(row=r_core, column=4, value="-").font = f_bold
    ws3.cell(row=r_core, column=4).alignment = align_center; ws3.cell(row=r_core, column=4).fill = fill_total; ws3.cell(row=r_core, column=4).border = border_total
    
    ws3.cell(row=r_core, column=5, value=f"=SUM(E6:E{r_core-1})").font = f_bold
    ws3.cell(row=r_core, column=5).number_format = FMT_INR; ws3.cell(row=r_core, column=5).alignment = align_right
    ws3.cell(row=r_core, column=5).fill = fill_total; ws3.cell(row=r_core, column=5).border = border_total
    
    ws3.cell(row=r_core, column=6, value=f"=SUM(F6:F{r_core-1})").font = f_bold
    ws3.cell(row=r_core, column=6).number_format = FMT_INR; ws3.cell(row=r_core, column=6).alignment = align_right
    ws3.cell(row=r_core, column=6).fill = fill_total; ws3.cell(row=r_core, column=6).border = border_total
    
    ws3.cell(row=r_core, column=7, value=f"=E{r_core}/C{r_core}").font = f_bold
    ws3.cell(row=r_core, column=7).number_format = FMT_PCT; ws3.cell(row=r_core, column=7).alignment = align_right
    ws3.cell(row=r_core, column=7).fill = fill_total; ws3.cell(row=r_core, column=7).border = border_total
    
    ws3.cell(row=r_core, column=8, value=f"=F{r_core}/C{r_core}").font = f_bold
    ws3.cell(row=r_core, column=8).number_format = FMT_PCT; ws3.cell(row=r_core, column=8).alignment = align_right
    ws3.cell(row=r_core, column=8).fill = fill_total; ws3.cell(row=r_core, column=8).border = border_total

    # IDC Row (Forward reference to Table 3 Total IDC cell)
    # We will determine Table 3 row index:
    # Table 2 capex phasing starts at r_phase_start = r_tot + 3
    # r_tot = r_core + 2
    r_idc = r_core + 1
    r_tot = r_core + 2
    r_de = r_core + 3
    
    r_phase_start = r_de + 2
    r_capex_tot = r_phase_start + 1 + n_items
    r_dd_start = r_capex_tot + 2
    r_dd_tot = r_dd_start + 1 + n_items
    r_open = r_dd_tot + 2
    r_draw = r_open + 1
    r_close = r_open + 2
    r_avg = r_open + 3
    r_idc_q = r_open + 4
    
    idc_total_cell = f"K{r_idc_q}"
    
    ws3.cell(row=r_idc, column=2, value="Interest During Construction (IDC) [B]").font = f_body
    ws3.cell(row=r_idc, column=2).border = border_cell
    
    ws3.cell(row=r_idc, column=3, value=f"={idc_total_cell}").font = f_body
    ws3.cell(row=r_idc, column=3).number_format = FMT_INR; ws3.cell(row=r_idc, column=3).alignment = align_right; ws3.cell(row=r_idc, column=3).border = border_cell
    
    ws3.cell(row=r_idc, column=4, value=1.0).font = f_body
    ws3.cell(row=r_idc, column=4).number_format = FMT_PCT; ws3.cell(row=r_idc, column=4).alignment = align_right; ws3.cell(row=r_idc, column=4).border = border_cell
    
    ws3.cell(row=r_idc, column=5, value=f"=C{r_idc}").font = f_body
    ws3.cell(row=r_idc, column=5).number_format = FMT_INR; ws3.cell(row=r_idc, column=5).alignment = align_right; ws3.cell(row=r_idc, column=5).border = border_cell
    
    ws3.cell(row=r_idc, column=6, value=0.0).font = f_body
    ws3.cell(row=r_idc, column=6).number_format = FMT_INR; ws3.cell(row=r_idc, column=6).alignment = align_right; ws3.cell(row=r_idc, column=6).border = border_cell
    
    ws3.cell(row=r_idc, column=7, value=1.0).font = f_body
    ws3.cell(row=r_idc, column=7).number_format = FMT_PCT; ws3.cell(row=r_idc, column=7).alignment = align_right; ws3.cell(row=r_idc, column=7).border = border_cell
    
    ws3.cell(row=r_idc, column=8, value=0.0).font = f_body
    ws3.cell(row=r_idc, column=8).number_format = FMT_PCT; ws3.cell(row=r_idc, column=8).alignment = align_right; ws3.cell(row=r_idc, column=8).border = border_cell

    # Total Project Cost Row
    ws3.cell(row=r_tot, column=2, value="Total Project Cost [A + B]").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws3.cell(row=r_tot, column=2).fill = fill_green; ws3.cell(row=r_tot, column=2).border = border_grand
    
    ws3.cell(row=r_tot, column=3, value=f"=C{r_core}+C{r_idc}").font = f_bold
    ws3.cell(row=r_tot, column=3).number_format = FMT_INR; ws3.cell(row=r_tot, column=3).alignment = align_right
    ws3.cell(row=r_tot, column=3).fill = fill_green; ws3.cell(row=r_tot, column=3).border = border_grand
    
    ws3.cell(row=r_tot, column=4, value="-").font = f_bold
    ws3.cell(row=r_tot, column=4).alignment = align_center; ws3.cell(row=r_tot, column=4).fill = fill_green; ws3.cell(row=r_tot, column=4).border = border_grand
    
    ws3.cell(row=r_tot, column=5, value=f"=E{r_core}+E{r_idc}").font = f_bold
    ws3.cell(row=r_tot, column=5).number_format = FMT_INR; ws3.cell(row=r_tot, column=5).alignment = align_right
    ws3.cell(row=r_tot, column=5).fill = fill_green; ws3.cell(row=r_tot, column=5).border = border_grand
    
    ws3.cell(row=r_tot, column=6, value=f"=F{r_core}+F{r_idc}").font = f_bold
    ws3.cell(row=r_tot, column=6).number_format = FMT_INR; ws3.cell(row=r_tot, column=6).alignment = align_right
    ws3.cell(row=r_tot, column=6).fill = fill_green; ws3.cell(row=r_tot, column=6).border = border_grand
    
    ws3.cell(row=r_tot, column=7, value=f"=E{r_tot}/C{r_tot}").font = f_bold
    ws3.cell(row=r_tot, column=7).number_format = FMT_PCT; ws3.cell(row=r_tot, column=7).alignment = align_right
    ws3.cell(row=r_tot, column=7).fill = fill_green; ws3.cell(row=r_tot, column=7).border = border_grand
    
    ws3.cell(row=r_tot, column=8, value=f"=F{r_tot}/C{r_tot}").font = f_bold
    ws3.cell(row=r_tot, column=8).number_format = FMT_PCT; ws3.cell(row=r_tot, column=8).alignment = align_right
    ws3.cell(row=r_tot, column=8).fill = fill_green; ws3.cell(row=r_tot, column=8).border = border_grand

    # Debt : Equity ratio
    ws3.cell(row=r_de, column=2, value="Debt : Equity Ratio (Bank Finance / Promoters Contribution)").font = f_bold
    ws3.cell(row=r_de, column=2).border = border_cell
    c = ws3.cell(row=r_de, column=3, value=f"=F{r_tot}/E{r_tot}")
    c.font = f_bold; c.number_format = FMT_X; c.alignment = align_right; c.border = border_cell

    # Table 2: Quarterly Capex Phasing (Q1 to Q8)
    ws3.cell(row=r_phase_start, column=2, value="2. QUARTERLY CAPITAL EXPENDITURE PHASING (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 12):
        ws3.cell(row=r_phase_start, column=c_i).fill = fill_hdr
        
    ws3.cell(row=r_phase_start+1, column=2, value="Cost Item Description").font = f_bold
    ws3.cell(row=r_phase_start+1, column=2).fill = fill_sec; ws3.cell(row=r_phase_start+1, column=2).border = border_cell
    for q in range(nq):
        col = 3 + q
        ws3.cell(row=r_phase_start+1, column=col, value=f"Q{q+1}").font = f_bold
        ws3.cell(row=r_phase_start+1, column=col).fill = fill_sec; ws3.cell(row=r_phase_start+1, column=col).alignment = align_center; ws3.cell(row=r_phase_start+1, column=col).border = border_cell
    ws3.cell(row=r_phase_start+1, column=11, value="Total Capex").font = f_bold
    ws3.cell(row=r_phase_start+1, column=11).fill = fill_sec; ws3.cell(row=r_phase_start+1, column=11).alignment = align_center; ws3.cell(row=r_phase_start+1, column=11).border = border_cell

    for i in range(n_items):
        r = r_phase_start + 2 + i
        item_r = 44 + i
        ws3.cell(row=r, column=2, value=f"=Assumptions!B{item_r}").font = f_body
        ws3.cell(row=r, column=2).border = border_cell
        for q in range(nq):
            col = 3 + q
            q_col_assump = get_column_letter(7 + q)
            c = ws3.cell(row=r, column=col, value=f"=Assumptions!$C${item_r}*Assumptions!{q_col_assump}${item_r}")
            c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        c = ws3.cell(row=r, column=11, value=f"=SUM(C{r}:J{r})")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Total Capex row
    ws3.cell(row=r_capex_tot, column=2, value="Total Capex Incurred per Quarter").font = f_bold
    ws3.cell(row=r_capex_tot, column=2).fill = fill_total; ws3.cell(row=r_capex_tot, column=2).border = border_total
    for q in range(nq):
        col = 3 + q
        col_letter = get_column_letter(col)
        c = ws3.cell(row=r_capex_tot, column=col, value=f"=SUM({col_letter}{r_phase_start+2}:{col_letter}{r_capex_tot-1})")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total
    c = ws3.cell(row=r_capex_tot, column=11, value=f"=SUM(C{r_capex_tot}:J{r_capex_tot})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    # Table 3: Quarterly Bank Loan Drawdown & IDC Computation
    ws3.cell(row=r_dd_start, column=2, value="3. QUARTERLY BANK LOAN DRAWDOWN & IDC COMPUTATION (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 12):
        ws3.cell(row=r_dd_start, column=c_i).fill = fill_hdr
        
    ws3.cell(row=r_dd_start+1, column=2, value="Item Bank Loan Drawdown").font = f_bold
    ws3.cell(row=r_dd_start+1, column=2).fill = fill_sec; ws3.cell(row=r_dd_start+1, column=2).border = border_cell
    for q in range(nq):
        col = 3 + q
        ws3.cell(row=r_dd_start+1, column=col, value=f"Q{q+1}").font = f_bold
        ws3.cell(row=r_dd_start+1, column=col).fill = fill_sec; ws3.cell(row=r_dd_start+1, column=col).alignment = align_center; ws3.cell(row=r_dd_start+1, column=col).border = border_cell
    ws3.cell(row=r_dd_start+1, column=11, value="Total Bank Loan").font = f_bold
    ws3.cell(row=r_dd_start+1, column=11).fill = fill_sec; ws3.cell(row=r_dd_start+1, column=11).alignment = align_center; ws3.cell(row=r_dd_start+1, column=11).border = border_cell

    for i in range(n_items):
        r = r_dd_start + 2 + i
        item_r = 44 + i
        cpx_r = r_phase_start + 2 + i
        ws3.cell(row=r, column=2, value=f"=Assumptions!B{item_r}").font = f_body
        ws3.cell(row=r, column=2).border = border_cell
        for q in range(nq):
            col = 3 + q
            col_letter = get_column_letter(col)
            c = ws3.cell(row=r, column=col, value=f"={col_letter}{cpx_r}*(1-Assumptions!$D${item_r})")
            c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        c = ws3.cell(row=r, column=11, value=f"=SUM(C{r}:J{r})")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Total Bank Loan Drawn in Quarter
    ws3.cell(row=r_dd_tot, column=2, value="Total Bank Loan Drawn in Quarter").font = f_bold
    ws3.cell(row=r_dd_tot, column=2).fill = fill_total; ws3.cell(row=r_dd_tot, column=2).border = border_total
    for q in range(nq):
        col = 3 + q
        col_letter = get_column_letter(col)
        c = ws3.cell(row=r_dd_tot, column=col, value=f"=SUM({col_letter}{r_dd_start+2}:{col_letter}{r_dd_tot-1})")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total
    c = ws3.cell(row=r_dd_tot, column=11, value=f"=SUM(C{r_dd_tot}:J{r_dd_tot})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    # IDC Computation rows:
    ws3.cell(row=r_open, column=2, value="Opening Loan Balance").font = f_body; ws3.cell(row=r_open, column=2).border = border_cell
    c = ws3.cell(row=r_open, column=3, value=0.0)
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    for q in range(1, nq):
        curr_col = get_column_letter(3 + q)
        prev_col = get_column_letter(2 + q)
        c = ws3.cell(row=r_open, column=3 + q, value=f"={prev_col}{r_close}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    ws3.cell(row=r_open, column=11, value="-").font = f_body; ws3.cell(row=r_open, column=11).alignment = align_center; ws3.cell(row=r_open, column=11).border = border_cell

    ws3.cell(row=r_draw, column=2, value="Add: Bank Loan Drawdown during Quarter").font = f_body; ws3.cell(row=r_draw, column=2).border = border_cell
    for q in range(nq):
        col = 3 + q
        col_letter = get_column_letter(col)
        c = ws3.cell(row=r_draw, column=col, value=f"={col_letter}{r_dd_tot}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    c = ws3.cell(row=r_draw, column=11, value=f"=SUM(C{r_draw}:J{r_draw})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    ws3.cell(row=r_close, column=2, value="Closing Loan Balance").font = f_body; ws3.cell(row=r_close, column=2).border = border_cell
    for q in range(nq):
        col = 3 + q
        col_letter = get_column_letter(col)
        c = ws3.cell(row=r_close, column=col, value=f"={col_letter}{r_open}+{col_letter}{r_draw}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    c = ws3.cell(row=r_close, column=11, value=f"=J{r_close}")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    ws3.cell(row=r_avg, column=2, value="Average Loan Balance during Quarter").font = f_body; ws3.cell(row=r_avg, column=2).border = border_cell
    for q in range(nq):
        col = 3 + q
        col_letter = get_column_letter(col)
        c = ws3.cell(row=r_avg, column=col, value=f"=({col_letter}{r_open}+{col_letter}{r_close})/2")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    c = ws3.cell(row=r_avg, column=11, value="-").font = f_body; ws3.cell(row=r_avg, column=11).alignment = align_center; ws3.cell(row=r_avg, column=11).border = border_cell

    ws3.cell(row=r_idc_q, column=2, value="Interest During Construction (IDC) for Quarter").font = f_bold
    ws3.cell(row=r_idc_q, column=2).fill = fill_total; ws3.cell(row=r_idc_q, column=2).border = border_total
    for q in range(nq):
        col = 3 + q
        col_letter = get_column_letter(col)
        c = ws3.cell(row=r_idc_q, column=col, value=f"={col_letter}{r_avg}*Assumptions!$C$34*(3/12)")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total
    c = ws3.cell(row=r_idc_q, column=11, value=f"=SUM(C{r_idc_q}:J{r_idc_q})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    autofit_cols(ws3)
    ws3.freeze_panes = "C5"
    ws3.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 4. SHEET 4: DEPRECIATION
    # =========================================================================
    ws4 = wb.create_sheet("Depreciation")
    apply_page_setup(ws4, landscape=True, title_rows='3:3')
    
    ws4.cell(row=1, column=2, value="FIXED ASSET CAPITALISATION & DEPRECIATION SCHEDULE (₹ in Crore)").font = f_title
    ws4.cell(row=2, column=2, value="Straight Line Method (SLM) depreciation based on statutory useful asset life.").font = f_note
    
    # Table 1: Asset Capitalisation Base
    ws4.cell(row=4, column=2, value="1. FIXED ASSET ALLOCATION & CAPITALISATION BASE (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 7):
        ws4.cell(row=4, column=c_i).fill = fill_hdr
        
    dep_hdrs = ["Cost Component", "Total Cost", "Building Base", "Equipment Base", "Land Base"]
    for idx, h_text in enumerate(dep_hdrs):
        col = 2 + idx
        ws4.cell(row=5, column=col, value=h_text).font = f_bold
        ws4.cell(row=5, column=col).fill = fill_sec
        ws4.cell(row=5, column=col).alignment = align_center if idx > 0 else align_left
        ws4.cell(row=5, column=col).border = border_cell

    for i in range(n_items):
        r = 6 + i
        item_r = 44 + i
        cost_r = 6 + i
        ws4.cell(row=r, column=2, value=f"=Assumptions!B{item_r}").font = f_body; ws4.cell(row=r, column=2).border = border_cell
        
        c = ws4.cell(row=r, column=3, value=f"='Project Cost & Finance'!C{cost_r}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        
        # Building base
        c = ws4.cell(row=r, column=4, value=f'=IF(Assumptions!E{item_r}="building", C{r}, IF(Assumptions!E{item_r}="shared", C{r}*Assumptions!F{item_r}, 0))')
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        
        # Equipment base
        c = ws4.cell(row=r, column=5, value=f'=IF(Assumptions!E{item_r}="equipment", C{r}, IF(Assumptions!E{item_r}="shared", C{r}*(1-Assumptions!F{item_r}), 0))')
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
        
        # Land base
        c = ws4.cell(row=r, column=6, value=f'=IF(Assumptions!E{item_r}="land", C{r}, 0)')
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # IDC Row in Depreciation
    r_dep_idc = 6 + n_items
    ws4.cell(row=r_dep_idc, column=2, value="Interest During Construction (IDC)").font = f_body; ws4.cell(row=r_dep_idc, column=2).border = border_cell
    c = ws4.cell(row=r_dep_idc, column=3, value=f"='Project Cost & Finance'!C{r_idc}")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    
    c = ws4.cell(row=r_dep_idc, column=4, value=f"=C{r_dep_idc}/2")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    
    c = ws4.cell(row=r_dep_idc, column=5, value=f"=C{r_dep_idc}/2")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    
    c = ws4.cell(row=r_dep_idc, column=6, value=0.0)
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Total Capitalised Asset Base Row
    r_dep_tot = r_dep_idc + 1
    ws4.cell(row=r_dep_tot, column=2, value="Total Capitalised Fixed Asset Base").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws4.cell(row=r_dep_tot, column=2).fill = fill_green; ws4.cell(row=r_dep_tot, column=2).border = border_grand
    
    c = ws4.cell(row=r_dep_tot, column=3, value=f"=SUM(C6:C{r_dep_idc})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand
    
    c = ws4.cell(row=r_dep_tot, column=4, value=f"=SUM(D6:D{r_dep_idc})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand
    
    c = ws4.cell(row=r_dep_tot, column=5, value=f"=SUM(E6:E{r_dep_idc})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand
    
    c = ws4.cell(row=r_dep_tot, column=6, value=f"=SUM(F6:F{r_dep_idc})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    # Annual Depreciation Breakdown
    r_dep_rate = r_dep_tot + 2
    ws4.cell(row=r_dep_rate, column=2, value="2. ANNUAL DEPRECIATION COMPUTATION (SLM)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 6):
        ws4.cell(row=r_dep_rate, column=c_i).fill = fill_hdr
        
    ws4.cell(row=r_dep_rate+1, column=2, value="Asset Class").font = f_bold; ws4.cell(row=r_dep_rate+1, column=2).fill = fill_sec; ws4.cell(row=r_dep_rate+1, column=2).border = border_cell
    ws4.cell(row=r_dep_rate+1, column=3, value="Asset Base (₹ in Crore)").font = f_bold; ws4.cell(row=r_dep_rate+1, column=3).fill = fill_sec; ws4.cell(row=r_dep_rate+1, column=3).alignment = align_right; ws4.cell(row=r_dep_rate+1, column=3).border = border_cell
    ws4.cell(row=r_dep_rate+1, column=4, value="Useful Life (Yrs)").font = f_bold; ws4.cell(row=r_dep_rate+1, column=4).fill = fill_sec; ws4.cell(row=r_dep_rate+1, column=4).alignment = align_center; ws4.cell(row=r_dep_rate+1, column=4).border = border_cell
    ws4.cell(row=r_dep_rate+1, column=5, value="Annual Depreciation (₹ in Crore)").font = f_bold; ws4.cell(row=r_dep_rate+1, column=5).fill = fill_sec; ws4.cell(row=r_dep_rate+1, column=5).alignment = align_right; ws4.cell(row=r_dep_rate+1, column=5).border = border_cell

    # Building
    ws4.cell(row=r_dep_rate+2, column=2, value="Hotel Building & Civil Infrastructure").font = f_body; ws4.cell(row=r_dep_rate+2, column=2).border = border_cell
    c = ws4.cell(row=r_dep_rate+2, column=3, value=f"=D{r_dep_tot}")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    c = ws4.cell(row=r_dep_rate+2, column=4, value="=Assumptions!$C$31")
    c.font = f_body; c.number_format = FMT_INT; c.alignment = align_center; c.border = border_cell
    c = ws4.cell(row=r_dep_rate+2, column=5, value=f"=C{r_dep_rate+2}/D{r_dep_rate+2}")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Equipment
    ws4.cell(row=r_dep_rate+3, column=2, value="Plant, Machinery & Kitchen Equipment").font = f_body; ws4.cell(row=r_dep_rate+3, column=2).border = border_cell
    c = ws4.cell(row=r_dep_rate+3, column=3, value=f"=E{r_dep_tot}")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    c = ws4.cell(row=r_dep_rate+3, column=4, value="=Assumptions!$C$32")
    c.font = f_body; c.number_format = FMT_INT; c.alignment = align_center; c.border = border_cell
    c = ws4.cell(row=r_dep_rate+3, column=5, value=f"=C{r_dep_rate+3}/D{r_dep_rate+3}")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Total Annual Deprec
    r_ann_dep = r_dep_rate + 4
    ws4.cell(row=r_ann_dep, column=2, value="Total Annual Depreciation Charge").font = f_bold
    ws4.cell(row=r_ann_dep, column=2).fill = fill_total; ws4.cell(row=r_ann_dep, column=2).border = border_total
    c = ws4.cell(row=r_ann_dep, column=3, value=f"=C{r_dep_rate+2}+C{r_dep_rate+3}")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total
    ws4.cell(row=r_ann_dep, column=4, value="-").font = f_bold; ws4.cell(row=r_ann_dep, column=4).alignment = align_center; ws4.cell(row=r_ann_dep, column=4).fill = fill_total; ws4.cell(row=r_ann_dep, column=4).border = border_total
    c = ws4.cell(row=r_ann_dep, column=5, value=f"=E{r_dep_rate+2}+E{r_dep_rate+3}")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    # Table 3: 10-Year Schedule
    r_sched = r_ann_dep + 2
    r_gb = r_sched + 2
    r_oad = r_gb + 1
    r_adc = r_oad + 1
    r_cad = r_adc + 1
    r_nb = r_cad + 1

    ws4.cell(row=r_sched, column=2, value="3. 10-YEAR FIXED ASSET & DEPRECIATION SCHEDULE (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 13):
        ws4.cell(row=r_sched, column=c_i).fill = fill_hdr
        
    ws4.cell(row=r_sched+1, column=2, value="Particulars").font = f_bold; ws4.cell(row=r_sched+1, column=2).fill = fill_sec; ws4.cell(row=r_sched+1, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        ws4.cell(row=r_sched+1, column=col, value=f"Y{y_idx+1} ({ops_years[y_idx]})").font = f_bold
        ws4.cell(row=r_sched+1, column=col).fill = fill_sec; ws4.cell(row=r_sched+1, column=col).alignment = align_center; ws4.cell(row=r_sched+1, column=col).border = border_cell

    # Gross Block
    ws4.cell(row=r_gb, column=2, value="Gross Block (Original Cost)").font = f_bold; ws4.cell(row=r_gb, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        c = ws4.cell(row=r_gb, column=col, value=f"=$C${r_dep_tot}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Opening Acc Deprec
    ws4.cell(row=r_oad, column=2, value="Opening Accumulated Depreciation").font = f_body; ws4.cell(row=r_oad, column=2).border = border_cell
    c = ws4.cell(row=r_oad, column=3, value=0.0)
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    for y_idx in range(1, ny):
        col = 3 + y_idx
        prev_col = get_column_letter(2 + y_idx)
        c = ws4.cell(row=r_oad, column=col, value=f"={prev_col}{r_cad}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Annual Deprec Charge
    r_adc = r_oad + 1
    ws4.cell(row=r_adc, column=2, value="Depreciation Charge for the Year").font = f_body; ws4.cell(row=r_adc, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        c = ws4.cell(row=r_adc, column=col, value=f"=$E${r_ann_dep}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Closing Acc Deprec
    r_cad = r_adc + 1
    ws4.cell(row=r_cad, column=2, value="Closing Accumulated Depreciation").font = f_bold; ws4.cell(row=r_cad, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws4.cell(row=r_cad, column=col, value=f"={col_letter}{r_oad}+{col_letter}{r_adc}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_alt; c.border = border_cell

    # Net Block
    r_nb = r_cad + 1
    ws4.cell(row=r_nb, column=2, value="Net Block (Closing Written Down Value)").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws4.cell(row=r_nb, column=2).fill = fill_green; ws4.cell(row=r_nb, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws4.cell(row=r_nb, column=col, value=f"={col_letter}{r_gb}-{col_letter}{r_cad}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    autofit_cols(ws4)
    ws4.freeze_panes = "C5"
    ws4.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 5. SHEET 5: LOAN REPAYMENT SCHEDULE
    # =========================================================================
    ws5 = wb.create_sheet("Loan Repayment Schedule")
    apply_page_setup(ws5, landscape=True, title_rows='3:3')
    
    ws5.cell(row=1, column=2, value="TERM LOAN REPAYMENT SCHEDULE & INTEREST BURDEN (₹ in Crore)").font = f_title
    ws5.cell(row=2, column=2, value="Amortization schedule linked to sanction terms and stepped repayment profile.").font = f_note
    
    ws5.cell(row=4, column=2, value="TERM LOAN REPAYMENT & DEBT SERVICE OBLIGATION (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 14):
        ws5.cell(row=4, column=c_i).fill = fill_hdr
        
    ws5.cell(row=5, column=2, value="Particulars").font = f_bold; ws5.cell(row=5, column=2).fill = fill_sec; ws5.cell(row=5, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        ws5.cell(row=5, column=col, value=f"Y{y_idx+1} ({ops_years[y_idx]})").font = f_bold
        ws5.cell(row=5, column=col).fill = fill_sec; ws5.cell(row=5, column=col).alignment = align_center; ws5.cell(row=5, column=col).border = border_cell
    ws5.cell(row=5, column=13, value="Total").font = f_bold; ws5.cell(row=5, column=13).fill = fill_sec; ws5.cell(row=5, column=13).alignment = align_center; ws5.cell(row=5, column=13).border = border_cell

    # Row indices for Loan Repayment Schedule
    r_tl_sanct = 6
    r_rep_pct = 7
    r_l_open = 8
    r_l_rep = 9
    r_l_close = 10
    r_l_avg = 11
    r_l_int = 12
    r_l_ds = 13

    # Total Term Loan Sanctioned
    ws5.cell(row=r_tl_sanct, column=2, value="Total Term Loan Sanctioned (Bank Finance)").font = f_bold; ws5.cell(row=r_tl_sanct, column=2).border = border_cell
    c = ws5.cell(row=r_tl_sanct, column=3, value=f"='Project Cost & Finance'!$F${r_tot}")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Repayment %
    ws5.cell(row=r_rep_pct, column=2, value="Annual Principal Repayment Percentage").font = f_body; ws5.cell(row=r_rep_pct, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws5.cell(row=r_rep_pct, column=col, value=f"=Assumptions!{col_letter}$40")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell
    c = ws5.cell(row=r_rep_pct, column=13, value=f"=SUM(C{r_rep_pct}:L{r_rep_pct})")
    c.font = f_bold; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell

    # Opening Debt Balance
    ws5.cell(row=r_l_open, column=2, value="Opening Debt Balance").font = f_body; ws5.cell(row=r_l_open, column=2).border = border_cell
    c = ws5.cell(row=r_l_open, column=3, value=f"=C{r_tl_sanct}")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    for y_idx in range(1, ny):
        col = 3 + y_idx
        prev_col = get_column_letter(2 + y_idx)
        c = ws5.cell(row=r_l_open, column=col, value=f"={prev_col}{r_l_close}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    ws5.cell(row=r_l_open, column=13, value="-").font = f_body; ws5.cell(row=r_l_open, column=13).alignment = align_center; ws5.cell(row=r_l_open, column=13).border = border_cell

    # Principal Repayment
    r_l_rep = 9
    ws5.cell(row=r_l_rep, column=2, value="[-] Principal Repayment during Year").font = f_bold; ws5.cell(row=r_l_rep, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws5.cell(row=r_l_rep, column=col, value=f"=$C${r_tl_sanct}*{col_letter}{r_rep_pct}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    c = ws5.cell(row=r_l_rep, column=13, value=f"=SUM(C{r_l_rep}:L{r_l_rep})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Closing Debt Balance
    r_l_close = 10
    ws5.cell(row=r_l_close, column=2, value="Closing Debt Balance").font = f_bold; ws5.cell(row=r_l_close, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws5.cell(row=r_l_close, column=col, value=f"={col_letter}{r_l_open}-{col_letter}{r_l_rep}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    c = ws5.cell(row=r_l_close, column=13, value=f"=L{r_l_close}")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Average Debt Balance
    r_l_avg = 11
    ws5.cell(row=r_l_avg, column=2, value="Average Debt Balance").font = f_body; ws5.cell(row=r_l_avg, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws5.cell(row=r_l_avg, column=col, value=f"=({col_letter}{r_l_open}+{col_letter}{r_l_close})/2")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    ws5.cell(row=r_l_avg, column=13, value="-").font = f_body; ws5.cell(row=r_l_avg, column=13).alignment = align_center; ws5.cell(row=r_l_avg, column=13).border = border_cell

    # Interest on Term Loan
    r_l_int = 12
    ws5.cell(row=r_l_int, column=2, value="Interest on Term Loan (Finance Cost)").font = f_bold
    ws5.cell(row=r_l_int, column=2).fill = fill_total; ws5.cell(row=r_l_int, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws5.cell(row=r_l_int, column=col, value=f"={col_letter}{r_l_open}*Assumptions!$C$34")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total
    c = ws5.cell(row=r_l_int, column=13, value=f"=SUM(C{r_l_int}:L{r_l_int})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    # Total Debt Service
    r_l_ds = 13
    ws5.cell(row=r_l_ds, column=2, value="Total Debt Service Obligation (Principal + Interest)").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws5.cell(row=r_l_ds, column=2).fill = fill_green; ws5.cell(row=r_l_ds, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws5.cell(row=r_l_ds, column=col, value=f"={col_letter}{r_l_rep}+{col_letter}{r_l_int}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand
    c = ws5.cell(row=r_l_ds, column=13, value=f"=SUM(C{r_l_ds}:L{r_l_ds})")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    autofit_cols(ws5)
    ws5.freeze_panes = "C6"
    ws5.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 6. SHEET 6: PROJECTED P&L
    # =========================================================================
    ws6 = wb.create_sheet("Projected P&L")
    apply_page_setup(ws6, landscape=True, title_rows='3:3')
    
    ws6.cell(row=1, column=2, value="PROJECTED PROFIT & LOSS STATEMENT (₹ in Crore)").font = f_title
    ws6.cell(row=2, column=2, value="10-Year operating income statement. Live formulas linked to Assumptions, Depreciation & Debt sheets.").font = f_note
    
    ws6.cell(row=4, column=2, value="PROJECT OPERATING PERFORMANCE & EARNINGS (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 13):
        ws6.cell(row=4, column=c_i).fill = fill_hdr
        
    ws6.cell(row=5, column=2, value="Particulars").font = f_bold; ws6.cell(row=5, column=2).fill = fill_sec; ws6.cell(row=5, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        ws6.cell(row=5, column=col, value=f"Y{y_idx+1} ({ops_years[y_idx]})").font = f_bold
        ws6.cell(row=5, column=col).fill = fill_sec; ws6.cell(row=5, column=col).alignment = align_center; ws6.cell(row=5, column=col).border = border_cell

    # Operational metrics
    r_pnl_occ = 6
    ws6.cell(row=r_pnl_occ, column=2, value="Occupancy Rate Assumed (%)").font = f_body; ws6.cell(row=r_pnl_occ, column=2).border = border_cell
    c = ws6.cell(row=r_pnl_occ, column=3, value="=Assumptions!$C$14")
    c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell
    for y_idx in range(1, ny):
        col = 3 + y_idx
        prev_col = get_column_letter(2 + y_idx)
        c = ws6.cell(row=r_pnl_occ, column=col, value=f"=MIN(Assumptions!$C$16, {prev_col}{r_pnl_occ}+Assumptions!$C$15)")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell

    r_pnl_tar = 7
    ws6.cell(row=r_pnl_tar, column=2, value="Average Room Tariff per Day (₹)").font = f_body; ws6.cell(row=r_pnl_tar, column=2).border = border_cell
    c = ws6.cell(row=r_pnl_tar, column=3, value="=Assumptions!$C$12")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    for y_idx in range(1, ny):
        col = 3 + y_idx
        prev_col = get_column_letter(2 + y_idx)
        c = ws6.cell(row=r_pnl_tar, column=col, value=f"={prev_col}{r_pnl_tar}*(1+Assumptions!$C$13)")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Section A: Revenues
    r_rev_sec = 8
    ws6.cell(row=r_rev_sec, column=2, value="A. Operating Revenues (₹ in Crore)").font = f_sec

    r_rev_room = 9
    ws6.cell(row=r_rev_room, column=2, value="Room Revenues").font = f_body; ws6.cell(row=r_rev_room, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_rev_room, column=col, value=f"=(Assumptions!$C$8*Assumptions!$C$9*{col_letter}{r_pnl_occ}*{col_letter}{r_pnl_tar})/10000000")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_rev_fb = 10
    ws6.cell(row=r_rev_fb, column=2, value="Food & Beverages (F&B) Revenues").font = f_body; ws6.cell(row=r_rev_fb, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_rev_fb, column=col, value=f"={col_letter}{r_rev_room}*(Assumptions!$C$18/Assumptions!$C$17)")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_rev_oth = 11
    ws6.cell(row=r_rev_oth, column=2, value="Other Operating Income (Banquets, Spa, etc.)").font = f_body; ws6.cell(row=r_rev_oth, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_rev_oth, column=col, value=f"={col_letter}{r_rev_room}*(Assumptions!$C$19/Assumptions!$C$17)")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_tot_rev = 12
    ws6.cell(row=r_tot_rev, column=2, value="Total Operating Revenue [A]").font = f_bold
    ws6.cell(row=r_tot_rev, column=2).fill = fill_total; ws6.cell(row=r_tot_rev, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_tot_rev, column=col, value=f"=SUM({col_letter}{r_rev_room}:{col_letter}{r_rev_oth})")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    # Section B: Variable Expenses
    r_var_sec = 13
    ws6.cell(row=r_var_sec, column=2, value="B. Variable Operating Expenses (₹ in Crore)").font = f_sec

    r_v_fb = 14
    ws6.cell(row=r_v_fb, column=2, value="F&B Consumables & Raw Materials").font = f_body; ws6.cell(row=r_v_fb, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_v_fb, column=col, value=f"={col_letter}{r_tot_rev}*Assumptions!$C$22")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_v_emp = 15
    ws6.cell(row=r_v_emp, column=2, value="Staff & Employee Costs").font = f_body; ws6.cell(row=r_v_emp, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_v_emp, column=col, value=f"={col_letter}{r_tot_rev}*Assumptions!$C$23")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_v_pow = 16
    ws6.cell(row=r_v_pow, column=2, value="Power, Fuel & Utility Charges").font = f_body; ws6.cell(row=r_v_pow, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_v_pow, column=col, value=f"={col_letter}{r_tot_rev}*Assumptions!$C$24")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_v_oth = 17
    ws6.cell(row=r_v_oth, column=2, value="Other Variable Operating Overheads").font = f_body; ws6.cell(row=r_v_oth, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_v_oth, column=col, value=f"={col_letter}{r_tot_rev}*Assumptions!$C$25")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_v_srv = 18
    ws6.cell(row=r_v_srv, column=2, value="Marriott Management / Service Fees").font = f_body; ws6.cell(row=r_v_srv, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_v_srv, column=col, value=f"={col_letter}{r_rev_room}*Assumptions!$C$26")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_tot_var = 19
    ws6.cell(row=r_tot_var, column=2, value="Total Variable Operating Expenses [B]").font = f_bold
    ws6.cell(row=r_tot_var, column=2).fill = fill_total; ws6.cell(row=r_tot_var, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_tot_var, column=col, value=f"=SUM({col_letter}{r_v_fb}:{col_letter}{r_v_srv})")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    # Section C: Fixed Expenses
    r_fix_sec = 20
    ws6.cell(row=r_fix_sec, column=2, value="C. Fixed Expenses (₹ in Crore)").font = f_sec

    r_f_adm = 21
    ws6.cell(row=r_f_adm, column=2, value="Administrative & Selling Overheads").font = f_body; ws6.cell(row=r_f_adm, column=2).border = border_cell
    c = ws6.cell(row=r_f_adm, column=3, value=f"=C{r_tot_rev}*Assumptions!$C$27")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    for y_idx in range(1, ny):
        col = 3 + y_idx
        prev_col = get_column_letter(2 + y_idx)
        c = ws6.cell(row=r_f_adm, column=col, value=f"={prev_col}{r_f_adm}*(1+Assumptions!$C$28)")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_f_dep = 22
    ws6.cell(row=r_f_dep, column=2, value="Depreciation (Straight Line Method)").font = f_body; ws6.cell(row=r_f_dep, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_f_dep, column=col, value=f"=Depreciation!{col_letter}${r_adc}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_f_int = 23
    ws6.cell(row=r_f_int, column=2, value="Interest on Term Loan (Finance Costs)").font = f_body; ws6.cell(row=r_f_int, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_f_int, column=col, value=f"='Loan Repayment Schedule'!{col_letter}${r_l_int}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_tot_fix = 24
    ws6.cell(row=r_tot_fix, column=2, value="Total Fixed Expenses [C]").font = f_bold
    ws6.cell(row=r_tot_fix, column=2).fill = fill_total; ws6.cell(row=r_tot_fix, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_tot_fix, column=col, value=f"={col_letter}{r_f_adm}+{col_letter}{r_f_dep}+{col_letter}{r_f_int}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    r_tot_exp = 25
    ws6.cell(row=r_tot_exp, column=2, value="Total Operating Expenditure [D = B + C]").font = f_bold
    ws6.cell(row=r_tot_exp, column=2).fill = fill_sec; ws6.cell(row=r_tot_exp, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_tot_exp, column=col, value=f"={col_letter}{r_tot_var}+{col_letter}{r_tot_fix}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_sec; c.border = border_total

    # Section D: Profitability
    r_ebitda = 26
    ws6.cell(row=r_ebitda, column=2, value="EBITDA (Earnings before Int, Tax & Deprec)").font = f_bold; ws6.cell(row=r_ebitda, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_ebitda, column=col, value=f"={col_letter}{r_tot_rev}-{col_letter}{r_tot_var}-{col_letter}{r_f_adm}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_ebit = 27
    ws6.cell(row=r_ebit, column=2, value="Operating Profit (EBIT)").font = f_bold; ws6.cell(row=r_ebit, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_ebit, column=col, value=f"={col_letter}{r_ebitda}-{col_letter}{r_f_dep}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_pbt = 28
    ws6.cell(row=r_pbt, column=2, value="Net Profit Before Tax (PBT) [E = A - D]").font = f_bold
    ws6.cell(row=r_pbt, column=2).fill = fill_total; ws6.cell(row=r_pbt, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_pbt, column=col, value=f"={col_letter}{r_tot_rev}-{col_letter}{r_tot_exp}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    r_tax = 29
    ws6.cell(row=r_tax, column=2, value="[-] Provision for Corporate Income Tax").font = f_body; ws6.cell(row=r_tax, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_tax, column=col, value=f"=MAX(0, {col_letter}{r_pbt}*Assumptions!$C$33)")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_pat = 30
    ws6.cell(row=r_pat, column=2, value="Net Profit After Tax (PAT) [F = E - Tax]").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws6.cell(row=r_pat, column=2).fill = fill_green; ws6.cell(row=r_pat, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws6.cell(row=r_pat, column=col, value=f"={col_letter}{r_pbt}-{col_letter}{r_tax}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    autofit_cols(ws6)
    ws6.freeze_panes = "C6"
    ws6.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 7. SHEET 7: PROJECTED BALANCE SHEET
    # =========================================================================
    ws7 = wb.create_sheet("Projected Balance Sheet")
    apply_page_setup(ws7, landscape=True, title_rows='3:3')
    
    ws7.cell(row=1, column=2, value="PROJECTED BALANCE SHEET (₹ in Crore)").font = f_title
    ws7.cell(row=2, column=2, value="Financial position at the end of each operating financial year. Fully reconciled and verified.").font = f_note
    
    ws7.cell(row=4, column=2, value="ASSETS & LIABILITIES (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 13):
        ws7.cell(row=4, column=c_i).fill = fill_hdr
        
    ws7.cell(row=5, column=2, value="Particulars").font = f_bold; ws7.cell(row=5, column=2).fill = fill_sec; ws7.cell(row=5, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        ws7.cell(row=5, column=col, value=f"Y{y_idx+1} ({ops_years[y_idx]})").font = f_bold
        ws7.cell(row=5, column=col).fill = fill_sec; ws7.cell(row=5, column=col).alignment = align_center; ws7.cell(row=5, column=col).border = border_cell

    # Assets
    r_bs_ast_sec = 6
    ws7.cell(row=r_bs_ast_sec, column=2, value="I. ASSETS").font = f_sec

    r_bs_gb = 7
    ws7.cell(row=r_bs_gb, column=2, value="Gross Fixed Assets (Gross Block)").font = f_body; ws7.cell(row=r_bs_gb, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_bs_gb, column=col, value=f"=Depreciation!{col_letter}${r_gb}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_bs_ad = 8
    ws7.cell(row=r_bs_ad, column=2, value="[-] Accumulated Depreciation").font = f_body; ws7.cell(row=r_bs_ad, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_bs_ad, column=col, value=f"=Depreciation!{col_letter}${r_cad}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_bs_nb = 9
    ws7.cell(row=r_bs_nb, column=2, value="Net Fixed Assets (Net Block)").font = f_bold
    ws7.cell(row=r_bs_nb, column=2).fill = fill_total; ws7.cell(row=r_bs_nb, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_bs_nb, column=col, value=f"={col_letter}{r_bs_gb}-{col_letter}{r_bs_ad}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    r_bs_cwip = 10
    ws7.cell(row=r_bs_cwip, column=2, value="Capital Work-in-Progress (CWIP)").font = f_body; ws7.cell(row=r_bs_cwip, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        c = ws7.cell(row=r_bs_cwip, column=col, value=0.0)
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_bs_cash = 11
    ws7.cell(row=r_bs_cash, column=2, value="Cash & Bank Balances").font = f_body; ws7.cell(row=r_bs_cash, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        # Point to Cash Flow sheet closing cash
        c = ws7.cell(row=r_bs_cash, column=col, value=f"='Cash Flow'!{col_letter}$13")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_tot_ast = 12
    ws7.cell(row=r_tot_ast, column=2, value="Total Assets").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws7.cell(row=r_tot_ast, column=2).fill = fill_green; ws7.cell(row=r_tot_ast, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_tot_ast, column=col, value=f"={col_letter}{r_bs_nb}+{col_letter}{r_bs_cwip}+{col_letter}{r_bs_cash}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    # Liabilities & Equity
    r_bs_eq_sec = 13
    ws7.cell(row=r_bs_eq_sec, column=2, value="II. EQUITY & LIABILITIES").font = f_sec

    r_bs_cap = 14
    ws7.cell(row=r_bs_cap, column=2, value="Promoter Share Capital / Equity").font = f_body; ws7.cell(row=r_bs_cap, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        c = ws7.cell(row=r_bs_cap, column=col, value=f"='Project Cost & Finance'!$E${r_tot}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_bs_res = 15
    ws7.cell(row=r_bs_res, column=2, value="Reserves & Surplus (Accumulated Retained Earnings)").font = f_body; ws7.cell(row=r_bs_res, column=2).border = border_cell
    c = ws7.cell(row=r_bs_res, column=3, value=f"='Projected P&L'!C${r_pat}")
    c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    for y_idx in range(1, ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        prev_col = get_column_letter(2 + y_idx)
        c = ws7.cell(row=r_bs_res, column=col, value=f"={prev_col}{r_bs_res}+'Projected P&L'!{col_letter}${r_pat}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_bs_nw = 16
    ws7.cell(row=r_bs_nw, column=2, value="Total Net Worth (Shareholders' Funds)").font = f_bold
    ws7.cell(row=r_bs_nw, column=2).fill = fill_total; ws7.cell(row=r_bs_nw, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_bs_nw, column=col, value=f"={col_letter}{r_bs_cap}+{col_letter}{r_bs_res}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    r_bs_loan = 17
    ws7.cell(row=r_bs_loan, column=2, value="Bank Term Loan (Outstanding Non-Current Debt)").font = f_body; ws7.cell(row=r_bs_loan, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_bs_loan, column=col, value=f"='Loan Repayment Schedule'!{col_letter}${r_l_close}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_tot_liab = 18
    ws7.cell(row=r_tot_liab, column=2, value="Total Liabilities & Net Worth").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws7.cell(row=r_tot_liab, column=2).fill = fill_green; ws7.cell(row=r_tot_liab, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_tot_liab, column=col, value=f"={col_letter}{r_bs_nw}+{col_letter}{r_bs_loan}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    # CHECK CELL ROW (DIFFERENCE)
    r_bs_diff = 19
    ws7.cell(row=r_bs_diff, column=2, value="Balance Sheet Check (Total Assets - Total Liabilities)").font = f_bold
    ws7.cell(row=r_bs_diff, column=2).fill = fill_sec; ws7.cell(row=r_bs_diff, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_bs_diff, column=col, value=f"={col_letter}{r_tot_ast}-{col_letter}{r_tot_liab}")
        c.font = f_green; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_total

    r_bs_status = 20
    ws7.cell(row=r_bs_status, column=2, value="Audit Verification Status").font = f_bold
    ws7.cell(row=r_bs_status, column=2).fill = fill_sec; ws7.cell(row=r_bs_status, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws7.cell(row=r_bs_status, column=col, value=f'=IF(ABS({col_letter}{r_bs_diff})<0.01, "0.00 (TALLIES)", "DISCREPANCY")')
        c.font = f_green; c.alignment = align_center; c.fill = fill_green; c.border = border_total

    autofit_cols(ws7)
    ws7.freeze_panes = "C6"
    ws7.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 8. SHEET 8: CASH FLOW
    # =========================================================================
    ws8 = wb.create_sheet("Cash Flow")
    apply_page_setup(ws8, landscape=True, title_rows='3:3')
    
    ws8.cell(row=1, column=2, value="PROJECTED CASH FLOW STATEMENT (₹ in Crore)").font = f_title
    ws8.cell(row=2, column=2, value="Operating and financing cash reconciliation. Closing cash balance links to Balance Sheet.").font = f_note
    
    ws8.cell(row=4, column=2, value="CASH FLOW STATEMENT (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 13):
        ws8.cell(row=4, column=c_i).fill = fill_hdr
        
    ws8.cell(row=5, column=2, value="Particulars").font = f_bold; ws8.cell(row=5, column=2).fill = fill_sec; ws8.cell(row=5, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        ws8.cell(row=5, column=col, value=f"Y{y_idx+1} ({ops_years[y_idx]})").font = f_bold
        ws8.cell(row=5, column=col).fill = fill_sec; ws8.cell(row=5, column=col).alignment = align_center; ws8.cell(row=5, column=col).border = border_cell

    # Operating cash flow
    r_cf_op_sec = 6
    ws8.cell(row=r_cf_op_sec, column=2, value="I. CASH FLOW FROM OPERATING ACTIVITIES").font = f_sec

    r_cf_pat = 7
    ws8.cell(row=r_cf_pat, column=2, value="Net Profit After Tax (PAT)").font = f_body; ws8.cell(row=r_cf_pat, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws8.cell(row=r_cf_pat, column=col, value=f"='Projected P&L'!{col_letter}${r_pat}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_cf_dep = 8
    ws8.cell(row=r_cf_dep, column=2, value="[+] Non-Cash Depreciation Added Back").font = f_body; ws8.cell(row=r_cf_dep, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws8.cell(row=r_cf_dep, column=col, value=f"=Depreciation!{col_letter}${r_adc}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_cf_op_tot = 9
    ws8.cell(row=r_cf_op_tot, column=2, value="Operating Cash Flow [A]").font = f_bold
    ws8.cell(row=r_cf_op_tot, column=2).fill = fill_total; ws8.cell(row=r_cf_op_tot, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws8.cell(row=r_cf_op_tot, column=col, value=f"={col_letter}{r_cf_pat}+{col_letter}{r_cf_dep}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    # Financing cash flow
    r_cf_fin_sec = 10
    ws8.cell(row=r_cf_fin_sec, column=2, value="II. CASH FLOW FROM FINANCING ACTIVITIES").font = f_sec

    r_cf_rep = 11
    ws8.cell(row=r_cf_rep, column=2, value="[-] Term Loan Principal Repayment").font = f_body; ws8.cell(row=r_cf_rep, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws8.cell(row=r_cf_rep, column=col, value=f"=-'Loan Repayment Schedule'!{col_letter}${r_l_rep}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    # Net change in cash
    r_cf_net = 12
    ws8.cell(row=r_cf_net, column=2, value="Net Cash Surplus / (Deficit) for the Year [A + B]").font = f_bold
    ws8.cell(row=r_cf_net, column=2).fill = fill_sec; ws8.cell(row=r_cf_net, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws8.cell(row=r_cf_net, column=col, value=f"={col_letter}{r_cf_op_tot}+{col_letter}{r_cf_rep}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_sec; c.border = border_total

    # Closing cash row (Row 13) - IMPORTANT: referenced by Balance Sheet!
    r_cf_close = 13
    ws8.cell(row=r_cf_close, column=2, value="Closing Cash & Bank Balance").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws8.cell(row=r_cf_close, column=2).fill = fill_green; ws8.cell(row=r_cf_close, column=2).border = border_grand
    c = ws8.cell(row=r_cf_close, column=3, value=f"=C{r_cf_net}")
    c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand
    for y_idx in range(1, ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        prev_col = get_column_letter(2 + y_idx)
        c = ws8.cell(row=r_cf_close, column=col, value=f"={prev_col}{r_cf_close}+{col_letter}{r_cf_net}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    autofit_cols(ws8)
    ws8.freeze_panes = "C6"
    ws8.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 9. SHEET 9: RATIOS & DSCR
    # =========================================================================
    ws9 = wb.create_sheet("Ratios & DSCR")
    apply_page_setup(ws9, landscape=True, title_rows='3:3')
    
    ws9.cell(row=1, column=2, value="BANKING RATIOS, DEBT SERVICE COVERAGE (DSCR) & CHARTS").font = f_title
    ws9.cell(row=2, column=2, value="Key bank appraisal viability indicators and coverage trends.").font = f_note
    
    ws9.cell(row=4, column=2, value="1. DEBT SERVICE COVERAGE RATIO (DSCR) SCHEDULE (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 14):
        ws9.cell(row=4, column=c_i).fill = fill_hdr
        
    ws9.cell(row=5, column=2, value="Particulars").font = f_bold; ws9.cell(row=5, column=2).fill = fill_sec; ws9.cell(row=5, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        ws9.cell(row=5, column=col, value=f"Y{y_idx+1}").font = f_bold
        ws9.cell(row=5, column=col).fill = fill_sec; ws9.cell(row=5, column=col).alignment = align_center; ws9.cell(row=5, column=col).border = border_cell
    ws9.cell(row=5, column=13, value="Average / Benchmark").font = f_bold; ws9.cell(row=5, column=13).fill = fill_sec; ws9.cell(row=5, column=13).alignment = align_center; ws9.cell(row=5, column=13).border = border_cell

    # DSCR Components
    r_dscr_pat = 6
    ws9.cell(row=r_dscr_pat, column=2, value="Net Profit After Tax (PAT)").font = f_body; ws9.cell(row=r_dscr_pat, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_dscr_pat, column=col, value=f"='Projected P&L'!{col_letter}${r_pat}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_dscr_pat, column=13, value=f"=AVERAGE(C{r_dscr_pat}:L{r_dscr_pat})").font = f_bold; ws9.cell(row=r_dscr_pat, column=13).number_format = FMT_INR; ws9.cell(row=r_dscr_pat, column=13).alignment = align_right; ws9.cell(row=r_dscr_pat, column=13).border = border_cell

    r_dscr_dep = 7
    ws9.cell(row=r_dscr_dep, column=2, value="[+] Depreciation for the Year").font = f_body; ws9.cell(row=r_dscr_dep, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_dscr_dep, column=col, value=f"=Depreciation!{col_letter}${r_adc}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_dscr_dep, column=13, value=f"=AVERAGE(C{r_dscr_dep}:L{r_dscr_dep})").font = f_bold; ws9.cell(row=r_dscr_dep, column=13).number_format = FMT_INR; ws9.cell(row=r_dscr_dep, column=13).alignment = align_right; ws9.cell(row=r_dscr_dep, column=13).border = border_cell

    r_dscr_int = 8
    ws9.cell(row=r_dscr_int, column=2, value="[+] Interest on Term Loan").font = f_body; ws9.cell(row=r_dscr_int, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_dscr_int, column=col, value=f"='Loan Repayment Schedule'!{col_letter}${r_l_int}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_dscr_int, column=13, value=f"=AVERAGE(C{r_dscr_int}:L{r_dscr_int})").font = f_bold; ws9.cell(row=r_dscr_int, column=13).number_format = FMT_INR; ws9.cell(row=r_dscr_int, column=13).alignment = align_right; ws9.cell(row=r_dscr_int, column=13).border = border_cell

    r_dscr_cads = 9
    ws9.cell(row=r_dscr_cads, column=2, value="Cash Available for Debt Service (CADS)").font = f_bold
    ws9.cell(row=r_dscr_cads, column=2).fill = fill_total; ws9.cell(row=r_dscr_cads, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_dscr_cads, column=col, value=f"={col_letter}{r_dscr_pat}+{col_letter}{r_dscr_dep}+{col_letter}{r_dscr_int}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total
    ws9.cell(row=r_dscr_cads, column=13, value=f"=AVERAGE(C{r_dscr_cads}:L{r_dscr_cads})").font = f_bold; ws9.cell(row=r_dscr_cads, column=13).number_format = FMT_INR; ws9.cell(row=r_dscr_cads, column=13).alignment = align_right; ws9.cell(row=r_dscr_cads, column=13).fill = fill_total; ws9.cell(row=r_dscr_cads, column=13).border = border_total

    r_dscr_rep = 10
    ws9.cell(row=r_dscr_rep, column=2, value="Principal Repayment Installment").font = f_body; ws9.cell(row=r_dscr_rep, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_dscr_rep, column=col, value=f"='Loan Repayment Schedule'!{col_letter}${r_l_rep}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_dscr_rep, column=13, value=f"=AVERAGE(C{r_dscr_rep}:L{r_dscr_rep})").font = f_bold; ws9.cell(row=r_dscr_rep, column=13).number_format = FMT_INR; ws9.cell(row=r_dscr_rep, column=13).alignment = align_right; ws9.cell(row=r_dscr_rep, column=13).border = border_cell

    r_dscr_ds = 11
    ws9.cell(row=r_dscr_ds, column=2, value="Total Debt Service Obligation (Principal + Interest)").font = f_bold
    ws9.cell(row=r_dscr_ds, column=2).fill = fill_sec; ws9.cell(row=r_dscr_ds, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_dscr_ds, column=col, value=f"={col_letter}{r_dscr_rep}+{col_letter}{r_dscr_int}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_sec; c.border = border_total
    ws9.cell(row=r_dscr_ds, column=13, value=f"=AVERAGE(C{r_dscr_ds}:L{r_dscr_ds})").font = f_bold; ws9.cell(row=r_dscr_ds, column=13).number_format = FMT_INR; ws9.cell(row=r_dscr_ds, column=13).alignment = align_right; ws9.cell(row=r_dscr_ds, column=13).fill = fill_sec; ws9.cell(row=r_dscr_ds, column=13).border = border_total

    r_dscr_val = 12
    ws9.cell(row=r_dscr_val, column=2, value="Debt Service Coverage Ratio (DSCR) [Times]").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws9.cell(row=r_dscr_val, column=2).fill = fill_green; ws9.cell(row=r_dscr_val, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_dscr_val, column=col, value=f"={col_letter}{r_dscr_cads}/{col_letter}{r_dscr_ds}")
        c.font = f_bold; c.number_format = FMT_X; c.alignment = align_right; c.fill = fill_green; c.border = border_grand
    c = ws9.cell(row=r_dscr_val, column=13, value=f"=AVERAGE(C{r_dscr_val}:L{r_dscr_val})")
    c.font = f_bold; c.number_format = FMT_X; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    # Key Financial Ratios
    r_ratio_sec = 14
    ws9.cell(row=r_ratio_sec, column=2, value="2. KEY FINANCIAL RATIOS & VIABILITY BENCHMARKS").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 14):
        ws9.cell(row=r_ratio_sec, column=c_i).fill = fill_hdr

    r_icr = 15
    ws9.cell(row=r_icr, column=2, value="Interest Coverage Ratio (EBIT / Interest)").font = f_body; ws9.cell(row=r_icr, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_icr, column=col, value=f"='Projected P&L'!{col_letter}${r_ebit}/'Loan Repayment Schedule'!{col_letter}${r_l_int}")
        c.font = f_body; c.number_format = FMT_X; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_icr, column=13, value=f"=AVERAGE(C{r_icr}:L{r_icr})").font = f_bold; ws9.cell(row=r_icr, column=13).number_format = FMT_X; ws9.cell(row=r_icr, column=13).alignment = align_right; ws9.cell(row=r_icr, column=13).border = border_cell

    r_der = 16
    ws9.cell(row=r_der, column=2, value="Debt-Equity Ratio (Term Loan / Net Worth)").font = f_body; ws9.cell(row=r_der, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_der, column=col, value=f"='Projected Balance Sheet'!{col_letter}${r_bs_loan}/'Projected Balance Sheet'!{col_letter}${r_bs_nw}")
        c.font = f_body; c.number_format = FMT_X; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_der, column=13, value=f"=AVERAGE(C{r_der}:L{r_der})").font = f_bold; ws9.cell(row=r_der, column=13).number_format = FMT_X; ws9.cell(row=r_der, column=13).alignment = align_right; ws9.cell(row=r_der, column=13).border = border_cell

    r_npm = 17
    ws9.cell(row=r_npm, column=2, value="Net Profit Margin (% of Total Revenue)").font = f_body; ws9.cell(row=r_npm, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_npm, column=col, value=f"='Projected P&L'!{col_letter}${r_pat}/'Projected P&L'!{col_letter}${r_tot_rev}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_npm, column=13, value=f"=AVERAGE(C{r_npm}:L{r_npm})").font = f_bold; ws9.cell(row=r_npm, column=13).number_format = FMT_PCT; ws9.cell(row=r_npm, column=13).alignment = align_right; ws9.cell(row=r_npm, column=13).border = border_cell

    r_ebitda_m = 18
    ws9.cell(row=r_ebitda_m, column=2, value="Operating EBITDA Margin (%)").font = f_body; ws9.cell(row=r_ebitda_m, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_ebitda_m, column=col, value=f"='Projected P&L'!{col_letter}${r_ebitda}/'Projected P&L'!{col_letter}${r_tot_rev}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_ebitda_m, column=13, value=f"=AVERAGE(C{r_ebitda_m}:L{r_ebitda_m})").font = f_bold; ws9.cell(row=r_ebitda_m, column=13).number_format = FMT_PCT; ws9.cell(row=r_ebitda_m, column=13).alignment = align_right; ws9.cell(row=r_ebitda_m, column=13).border = border_cell

    r_ronw = 19
    ws9.cell(row=r_ronw, column=2, value="Return on Net Worth (ROE / RONW %)").font = f_body; ws9.cell(row=r_ronw, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws9.cell(row=r_ronw, column=col, value=f"='Projected P&L'!{col_letter}${r_pat}/'Projected Balance Sheet'!{col_letter}${r_bs_nw}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell
    ws9.cell(row=r_ronw, column=13, value=f"=AVERAGE(C{r_ronw}:L{r_ronw})").font = f_bold; ws9.cell(row=r_ronw, column=13).number_format = FMT_PCT; ws9.cell(row=r_ronw, column=13).alignment = align_right; ws9.cell(row=r_ronw, column=13).border = border_cell

    # Openpyxl Live Charts on Ratios & DSCR sheet:
    # 1. Revenue vs Profit Chart
    chart1 = BarChart()
    chart1.type = "col"
    chart1.style = 10
    chart1.title = "Revenue vs Net Profit After Tax (₹ in Crore)"
    chart1.y_axis.title = "₹ in Crore"
    chart1.x_axis.title = "Operating Year"
    chart1.width = 16
    chart1.height = 10
    
    # We can create a mini data summary table for charts below row 21:
    r_ch_data = 21
    ws9.cell(row=r_ch_data, column=2, value="Chart Data Table").font = f_bold
    ws9.cell(row=r_ch_data+1, column=2, value="Metric")
    ws9.cell(row=r_ch_data+2, column=2, value="Revenue")
    ws9.cell(row=r_ch_data+3, column=2, value="PAT")
    ws9.cell(row=r_ch_data+4, column=2, value="DSCR")
    
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        ws9.cell(row=r_ch_data+1, column=col, value=f"Y{y_idx+1}")
        ws9.cell(row=r_ch_data+2, column=col, value=f"='Projected P&L'!{col_letter}${r_tot_rev}")
        ws9.cell(row=r_ch_data+3, column=col, value=f"='Projected P&L'!{col_letter}${r_pat}")
        ws9.cell(row=r_ch_data+4, column=col, value=f"={col_letter}{r_dscr_val}")
        
    data1 = Reference(ws9, min_col=2, min_row=r_ch_data+2, max_col=12, max_row=r_ch_data+3)
    cats1 = Reference(ws9, min_col=3, min_row=r_ch_data+1, max_col=12, max_row=r_ch_data+1)
    chart1.add_data(data1, titles_from_data=True, from_rows=True)
    chart1.set_categories(cats1)
    ws9.add_chart(chart1, "B27")
    
    # 2. DSCR Line Chart
    chart2 = LineChart()
    chart2.title = "DSCR Trajectory (Debt Service Coverage Ratio)"
    chart2.style = 13
    chart2.y_axis.title = "Coverage (Times)"
    chart2.x_axis.title = "Operating Year"
    chart2.width = 16
    chart2.height = 10
    
    data2 = Reference(ws9, min_col=2, min_row=r_ch_data+4, max_col=12, max_row=r_ch_data+4)
    chart2.add_data(data2, titles_from_data=True, from_rows=True)
    chart2.set_categories(cats1)
    ws9.add_chart(chart2, "H27")

    autofit_cols(ws9)
    ws9.freeze_panes = "C6"
    ws9.views.sheetView[0].showGridLines = True

    # =========================================================================
    # 10. SHEET 10: BREAK-EVEN
    # =========================================================================
    ws10 = wb.create_sheet("Break-even")
    apply_page_setup(ws10, landscape=True, title_rows='3:3')
    
    ws10.cell(row=1, column=2, value="BREAK-EVEN POINT (BEP) & MARGIN OF SAFETY ANALYSIS (₹ in Crore)").font = f_title
    ws10.cell(row=2, column=2, value="Cost-Volume-Profit (CVP) analysis over 10-year projection horizon.").font = f_note
    
    ws10.cell(row=4, column=2, value="BREAK-EVEN CAPACITY & SENSITIVITY ANALYSIS (₹ in Crore)").font = Font(name="Calibri", size=10, bold=True, color=WHITE)
    for c_i in range(2, 13):
        ws10.cell(row=4, column=c_i).fill = fill_hdr
        
    ws10.cell(row=5, column=2, value="Particulars").font = f_bold; ws10.cell(row=5, column=2).fill = fill_sec; ws10.cell(row=5, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        ws10.cell(row=5, column=col, value=f"Y{y_idx+1} ({ops_years[y_idx]})").font = f_bold
        ws10.cell(row=5, column=col).fill = fill_sec; ws10.cell(row=5, column=col).alignment = align_center; ws10.cell(row=5, column=col).border = border_cell

    r_be_rev = 6
    ws10.cell(row=r_be_rev, column=2, value="Total Operating Revenue [A]").font = f_bold; ws10.cell(row=r_be_rev, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_rev, column=col, value=f"='Projected P&L'!{col_letter}${r_tot_rev}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_be_var = 7
    ws10.cell(row=r_be_var, column=2, value="[-] Total Variable Costs [B]").font = f_body; ws10.cell(row=r_be_var, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_var, column=col, value=f"='Projected P&L'!{col_letter}${r_tot_var}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_be_con = 8
    ws10.cell(row=r_be_con, column=2, value="Contribution [C = A - B]").font = f_bold
    ws10.cell(row=r_be_con, column=2).fill = fill_total; ws10.cell(row=r_be_con, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_con, column=col, value=f"={col_letter}{r_be_rev}-{col_letter}{r_be_var}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    r_be_pv = 9
    ws10.cell(row=r_be_pv, column=2, value="Profit Volume (PV) Ratio [Contribution % of Sales]").font = f_body; ws10.cell(row=r_be_pv, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_pv, column=col, value=f"={col_letter}{r_be_con}/{col_letter}{r_be_rev}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell

    r_be_fix = 10
    ws10.cell(row=r_be_fix, column=2, value="Fixed Costs (Admin + Depreciation + Interest)").font = f_body; ws10.cell(row=r_be_fix, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_fix, column=col, value=f"='Projected P&L'!{col_letter}${r_tot_fix}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_be_sales = 11
    ws10.cell(row=r_be_sales, column=2, value="Break-Even Sales Revenue (₹ in Crore) [Fixed / PV]").font = f_bold
    ws10.cell(row=r_be_sales, column=2).fill = fill_total; ws10.cell(row=r_be_sales, column=2).border = border_total
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_sales, column=col, value=f"={col_letter}{r_be_fix}/{col_letter}{r_be_pv}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.fill = fill_total; c.border = border_total

    r_be_pct = 12
    ws10.cell(row=r_be_pct, column=2, value="Break-Even Point (% of Operating Revenue)").font = Font(name="Calibri", size=10, bold=True, color=NAVY)
    ws10.cell(row=r_be_pct, column=2).fill = fill_green; ws10.cell(row=r_be_pct, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_pct, column=col, value=f"={col_letter}{r_be_sales}/{col_letter}{r_be_rev}")
        c.font = f_bold; c.number_format = FMT_PCT; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    r_be_cf = 13
    ws10.cell(row=r_be_cf, column=2, value="Cash Fixed Costs (excluding Depreciation)").font = f_body; ws10.cell(row=r_be_cf, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_cf, column=col, value=f"={col_letter}{r_be_fix}-'Projected P&L'!{col_letter}${r_f_dep}")
        c.font = f_body; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_be_cbep = 14
    ws10.cell(row=r_be_cbep, column=2, value="Cash Break-Even Point (% of Sales)").font = f_body; ws10.cell(row=r_be_cbep, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_cbep, column=col, value=f"=({col_letter}{r_be_cf}/{col_letter}{r_be_pv})/{col_letter}{r_be_rev}")
        c.font = f_body; c.number_format = FMT_PCT; c.alignment = align_right; c.border = border_cell

    r_be_mos = 15
    ws10.cell(row=r_be_mos, column=2, value="Margin of Safety (₹ in Crore) [Sales - Break-Even]").font = f_bold; ws10.cell(row=r_be_mos, column=2).border = border_cell
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_mos, column=col, value=f"={col_letter}{r_be_rev}-{col_letter}{r_be_sales}")
        c.font = f_bold; c.number_format = FMT_INR; c.alignment = align_right; c.border = border_cell

    r_be_mosp = 16
    ws10.cell(row=r_be_mosp, column=2, value="Margin of Safety (% of Operating Revenue)").font = f_bold
    ws10.cell(row=r_be_mosp, column=2).fill = fill_green; ws10.cell(row=r_be_mosp, column=2).border = border_grand
    for y_idx in range(ny):
        col = 3 + y_idx
        col_letter = get_column_letter(col)
        c = ws10.cell(row=r_be_mosp, column=col, value=f"={col_letter}{r_be_mos}/{col_letter}{r_be_rev}")
        c.font = f_bold; c.number_format = FMT_PCT; c.alignment = align_right; c.fill = fill_green; c.border = border_grand

    autofit_cols(ws10)
    ws10.freeze_panes = "C6"
    ws10.views.sheetView[0].showGridLines = True

    # Save workbook
    wb.save(output_path)
    print(f"Successfully generated 10-sheet live-formula workbook at: {output_path}")
    return True


# --------------------------------------------------------------------------
# Redesigned Bank-Submission PDF Export Engine (A4 Landscape, ₹ in lakh)
# --------------------------------------------------------------------------

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, Rect, String, Line

def fmt_inr(v, decimals=2, parens=True):
    if v is None or v == "" or v == "n/a":
        return "n/a" if v == "n/a" else ""
    if isinstance(v, str):
        return v
    if abs(v) < 1e-5:
        return "-"
    is_neg = v < 0
    val = abs(v)
    s = f"{val:.{decimals}f}"
    parts = s.split(".")
    int_part = parts[0]
    dec_part = ("." + parts[1]) if len(parts) > 1 and decimals > 0 else ""
    
    if len(int_part) <= 3:
        formatted_int = int_part
    else:
        last3 = int_part[-3:]
        rest = int_part[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        formatted_int = ",".join(groups) + "," + last3
        
    res = formatted_int + dec_part
    if is_neg:
        return f"({res})" if parens else f"-{res}"
    return res

def fmt_pct(v):
    if v is None or v == "" or v == "n/a": return "n/a"
    if isinstance(v, str): return v
    return f"{v*100.0:.2f}%"

def fmt_x(v):
    if v is None or v == "" or v == "n/a": return "n/a"
    if isinstance(v, str): return v
    return f"{v:.2f}x"

def fmt_val_lakh(v, f):
    if v is None or v == "" or v == "n/a": return "n/a" if v == "n/a" else ""
    if isinstance(v, str): return v
    if f == "pct": return fmt_pct(v)
    if f == "x": return fmt_x(v)
    if f == "yrs": return f"{v:.2f} years"
    if f == "int": return str(int(round(v)))
    if f == "num0": return fmt_inr(v, decimals=0)
    return fmt_inr(v, decimals=2)

class _NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self._entity_name = "DETAILED PROJECT REPORT"
        self._doc_title = "DETAILED PROJECT REPORT"

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        w, h = self._pagesize  # landscape A4: 841.89 x 595.27
        m_left = 70.87
        m_right = w - 70.87
        
        # Header (pages 2+)
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#1F3864"))
            self.setLineWidth(1.0)
            self.line(m_left, h - 52, m_right, h - 52)

            self.setFont("Helvetica-Bold", 8.5)
            self.setFillColor(colors.HexColor("#1F3864"))
            self.drawString(m_left, h - 45, getattr(self, "_entity_name", "DETAILED PROJECT REPORT").upper())
            
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#666666"))
            self.drawRightString(m_right, h - 45, "Detailed Project Report | Bank Credit Appraisal")

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#D9D9D9"))
        self.setLineWidth(0.75)
        self.line(m_left, 48, m_right, 48)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#666666"))
        self.drawString(m_left, 34, "Confidential - For Lender Credit Appraisal | All amounts in ₹ in Crore unless stated otherwise")
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#1F3864"))
        self.drawRightString(m_right, 34, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def _pdf_make_bar_chart(title, labels, series, series_colors, series_names, width=340, height=125, hline=None, hname=""):
    d = Drawing(width, height)
    d.add(Rect(0, 0, width, height, fillColor=colors.HexColor('#FAFAFA'), strokeColor=colors.HexColor('#D9D9D9'), strokeWidth=0.5, rx=3, ry=3))
    d.add(String(10, height - 14, title, fontName=FONT_BOLD, fontSize=8, fillColor=colors.HexColor('#1F3864')))

    lx = width - 10
    for nm, col in reversed(list(zip(series_names, series_colors))):
        lx -= len(nm) * 4.8 + 20
        d.add(Rect(lx, height - 15, 8, 6, fillColor=colors.HexColor(col), strokeColor=None))
        d.add(String(lx + 10, height - 14, nm, fontName=FONT_NORM, fontSize=6.5, fillColor=colors.HexColor('#444444')))

    ml, mr, mt, mb = 36, 10, 24, 18
    pw = width - ml - mr
    ph = height - mt - mb

    all_vals = [v for s in series for v in s if v is not None]
    if hline is not None:
        all_vals.append(hline)
    vmax = max(all_vals + [0.0])
    vmin = min(all_vals + [0.0])
    if vmax - vmin < 1e-6:
        vmax = vmin + 1.0
    span = vmax - vmin

    for k in range(5):
        val = vmin + span * k / 4.0
        y = mb + (val - vmin) / span * ph
        d.add(Line(ml, y, width - mr, y, strokeColor=colors.HexColor('#EAEAEA'), strokeWidth=0.5))
        d.add(String(ml - 4, y - 2, f'{val:.1f}' if val < 100 else f'{val:.0f}', fontName=FONT_NORM, fontSize=5.5, fillColor=colors.HexColor('#888888'), textAnchor='end'))

    n_groups = len(labels)
    n_bars = len(series)
    gw = pw / max(1, n_groups)
    bw = min(11.0, (gw - 3) / max(1, n_bars))

    for i, lbl in enumerate(labels):
        gx = ml + i * gw + (gw - n_bars * bw) / 2.0
        for j, s in enumerate(series):
            if i >= len(s): continue
            v = s[i]
            if v is None: continue
            y0 = mb + (0.0 - vmin) / span * ph
            y1 = mb + (v - vmin) / span * ph
            by = min(y0, y1)
            bh = abs(y1 - y0)
            d.add(Rect(gx + j * bw, by, bw - 0.5, max(bh, 0.5), fillColor=colors.HexColor(series_colors[j]), strokeColor=None))
        d.add(String(ml + i * gw + gw / 2.0, mb - 7, lbl, fontName=FONT_NORM, fontSize=5.5, fillColor=colors.HexColor('#555555'), textAnchor='middle'))

    if hline is not None:
        hy = mb + (hline - vmin) / span * ph
        d.add(Line(ml, hy, width - mr, hy, strokeColor=colors.HexColor('#C00000'), strokeWidth=1, strokeDashArray=[3, 2]))
        d.add(String(width - mr - 2, hy + 2.5, hname, fontName=FONT_BOLD, fontSize=5.5, fillColor=colors.HexColor('#C00000'), textAnchor='end'))

    return d

def _pdf_build_kpi_card_table(a, R, total_width=700):
    de = (R["loan"] / R["total_prom"]) if (R.get("total_prom", 0) > 0) else None
    b0 = R["bep_pct"][0] if (R.get("bep_pct") and len(R["bep_pct"]) > 0 and R["bep_pct"][0] is not None) else None

    # Amounts in ₹ in Crore!
    cards = [
        ("Total Project Cost", f"₹ {fmt_inr(R['total_cost'])} Cr", "#1F3864"),
        ("Promoter Contribution", f"₹ {fmt_inr(R['total_prom'])} Cr ({(R['total_prom']/R['total_cost']*100):.1f}%)" if R['total_cost'] > 0 else "n/a", "#2F5597"),
        ("Term Loan (Bank)", f"₹ {fmt_inr(R['loan'])} Cr ({(R['loan']/R['total_cost']*100):.1f}%)" if R['total_cost'] > 0 else "n/a", "#1F3864"),
        ("Interest During Constr.", f"₹ {fmt_inr(R['idc'])} Cr", "#2F5597"),
        ("Debt : Equity Ratio", f"{de:.2f}x (Max 2.0x)" if de is not None else "n/a", "#1F3864"),
        ("Average DSCR", f"{R['avg_dscr']:.2f}x" if R['avg_dscr'] is not None else "n/a", "#276A3C"),
        ("Minimum DSCR", f"{R['min_dscr']:.2f}x" if R['min_dscr'] is not None else "n/a", "#276A3C"),
        ("Project IRR", f"{R['irr']*100:.2f}%" if R['irr'] is not None else "n/a", "#1F3864"),
        ("Simple Pay-back", f"{R['payback']:.2f} Years" if R['payback'] is not None else "n/a", "#2F5597"),
        ("Break-Even (Yr 1)", f"{b0*100:.1f}% Capacity" if b0 is not None else "n/a", "#1F3864"),
    ]

    col_w = total_width / 5.0
    table_data = [[], [], [], []]
    for i in range(5):
        t1, v1, _ = cards[i]
        table_data[0].append(t1.upper())
        table_data[1].append(v1)
        t2, v2, _ = cards[i + 5]
        table_data[2].append(t2.upper())
        table_data[3].append(v2)

    t_style = [
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 6),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 1), (-1, 1), FONT_BOLD),
        ('FONTSIZE', (0, 1), (-1, 1), 8.5),
        ('TEXTCOLOR', (0, 1), (-1, 1), colors.white),

        ('FONTNAME', (0, 2), (-1, 2), FONT_BOLD),
        ('FONTSIZE', (0, 2), (-1, 2), 6),
        ('TEXTCOLOR', (0, 2), (-1, 2), colors.white),
        ('FONTNAME', (0, 3), (-1, 3), FONT_BOLD),
        ('FONTSIZE', (0, 3), (-1, 3), 8.5),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.white),

        ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
        ('TOPPADDING', (0, 0), (-1, 0), 3),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 4),
        ('TOPPADDING', (0, 1), (-1, 1), 1),

        ('BOTTOMPADDING', (0, 2), (-1, 2), 2),
        ('TOPPADDING', (0, 2), (-1, 2), 3),
        ('BOTTOMPADDING', (0, 3), (-1, 3), 4),
        ('TOPPADDING', (0, 3), (-1, 3), 1),

        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#BFBFBF')),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.white),
    ]
    for i in range(5):
        c1 = colors.HexColor(cards[i][2])
        c2 = colors.HexColor(cards[i + 5][2])
        t_style.append(('BACKGROUND', (i, 0), (i, 1), c1))
        t_style.append(('BACKGROUND', (i, 2), (i, 3), c2))

    t = Table(table_data, colWidths=[col_w]*5)
    t.setStyle(TableStyle(t_style))
    return t

def _pdf_build_banker_checks_table(a, R, total_width=700):
    de = (R["loan"] / R["total_prom"]) if (R.get("total_prom", 0) > 0) else None
    tally = max(abs(x) for x in R.get("diff", [0])) < 1e-4
    checks = [
        ("Min DSCR \u2265 1.25x", R["min_dscr"] is not None and R["min_dscr"] >= 1.25, f"Observed: {R['min_dscr']:.2f}x (Viable)" if R['min_dscr'] is not None else "n/a"),
        ("Project IRR > Loan Interest", R["irr"] is not None and R["irr"] > a["rate"], f"IRR {R['irr']*100:.2f}% vs Rate {a['rate']*100:.2f}%" if R['irr'] is not None else "n/a"),
        ("Debt : Equity \u2264 2 : 1", de is not None and de <= 2.0, f"Observed: {de:.2f} : 1 (Conservative)" if de is not None else "n/a"),
        ("Balance Sheet Tallies", tally, "Diff: 0.00 Cr (Assets == Liab)"),
    ]
    col_w = total_width / 4.0
    hdr, val = [], []
    t_style = [
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 1, colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#BFBFBF')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]
    for idx, (crit, ok, detail) in enumerate(checks):
        badge = "PASS" if ok else "REVIEW"
        hdr.append(f"{badge} : {crit}")
        val.append(detail)
        bg = colors.HexColor("#276A3C") if ok else colors.HexColor("#C00000")
        t_style.append(('BACKGROUND', (idx, 0), (idx, 0), bg))
        t_style.append(('TEXTCOLOR', (idx, 0), (idx, 0), colors.white))
        t_style.append(('FONTNAME', (idx, 0), (idx, 0), FONT_BOLD))
        t_style.append(('FONTSIZE', (idx, 0), (idx, 0), 7))

        t_style.append(('BACKGROUND', (idx, 1), (idx, 1), colors.HexColor("#E2EFDA") if ok else colors.HexColor("#FFEBEE")))
        t_style.append(('TEXTCOLOR', (idx, 1), (idx, 1), colors.HexColor("#276A3C") if ok else colors.HexColor("#C00000")))
        t_style.append(('FONTNAME', (idx, 1), (idx, 1), FONT_NORM))
        t_style.append(('FONTSIZE', (idx, 1), (idx, 1), 6.5))

    t = Table([hdr, val], colWidths=[col_w]*4)
    t.setStyle(TableStyle(t_style))
    return t

def _pdf_convert_rows_to_table(rows, total_width=700, default_col0_width=180, pad_v=1.2, scale_lakh=False):
    if not rows: return None
    max_vals = max(len(r[2]) for r in rows if len(r) > 2 and isinstance(r[2], list))
    num_cols = max_vals + 1
    col0_w = min(default_col0_width, total_width * 0.40)
    data_col_w = (total_width - col0_w) / max(1, (num_cols - 1))
    col_widths = [col0_w] + [data_col_w] * (num_cols - 1)

    f_size = 5.0 if num_cols > 15 else (5.5 if num_cols > 12 else 6.0)
    pad_h = 2.0

    table_data = []
    t_style = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), pad_v),
        ('BOTTOMPADDING', (0, 0), (-1, -1), pad_v),
        ('LEFTPADDING', (0, 0), (-1, -1), pad_h),
        ('RIGHTPADDING', (0, 0), (-1, -1), pad_h),
    ]
    odd_row = False

    for row_idx, r in enumerate(rows):
        kind, label, vals, f = r
        fl = f if isinstance(f, list) else [f] * max(1, len(vals))

        cells = [label]
        for i, v in enumerate(vals):
            fmt = fl[i] if i < len(fl) else fl[-1]
            if scale_lakh and fmt not in ("pct", "x", "yrs", "int") and isinstance(v, (int, float)):
                v_scaled = v * 100.0
            else:
                v_scaled = v
            cells.append(fmt_val_lakh(v_scaled, fmt))
        cells += [""] * (num_cols - len(cells))
        table_data.append(cells)

        if kind == "head":
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#1F3864')),
                ('TEXTCOLOR', (0, row_idx), (-1, row_idx), colors.white),
                ('FONTNAME', (0, row_idx), (-1, row_idx), FONT_BOLD),
                ('FONTSIZE', (0, row_idx), (-1, row_idx), f_size + 0.3),
                ('ALIGN', (0, row_idx), (0, row_idx), 'LEFT'),
                ('ALIGN', (1, row_idx), (-1, row_idx), 'RIGHT'),
                ('BOTTOMPADDING', (0, row_idx), (-1, row_idx), pad_v + 0.8),
                ('TOPPADDING', (0, row_idx), (-1, row_idx), pad_v + 0.8),
            ])
            odd_row = False
        elif kind == "section":
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#D9E1F2')),
                ('TEXTCOLOR', (0, row_idx), (-1, row_idx), colors.HexColor('#1F3864')),
                ('FONTNAME', (0, row_idx), (-1, row_idx), FONT_BOLD),
                ('FONTSIZE', (0, row_idx), (-1, row_idx), f_size + 0.2),
                ('ALIGN', (0, row_idx), (-1, row_idx), 'LEFT'),
                ('SPAN', (0, row_idx), (-1, row_idx)),
                ('TOPPADDING', (0, row_idx), (-1, row_idx), pad_v + 0.3),
                ('BOTTOMPADDING', (0, row_idx), (-1, row_idx), pad_v + 0.3),
            ])
            odd_row = False
        elif kind == "total":
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#D9E1F2')),
                ('TEXTCOLOR', (0, row_idx), (-1, row_idx), colors.HexColor('#000000')),
                ('FONTNAME', (0, row_idx), (-1, row_idx), FONT_BOLD),
                ('FONTSIZE', (0, row_idx), (-1, row_idx), f_size),
                ('ALIGN', (0, row_idx), (0, row_idx), 'LEFT'),
                ('ALIGN', (1, row_idx), (-1, row_idx), 'RIGHT'),
                ('LINEABOVE', (0, row_idx), (-1, row_idx), 0.5, colors.HexColor('#1F3864')),
                ('LINEBELOW', (0, row_idx), (-1, row_idx), 0.5, colors.HexColor('#1F3864')),
            ])
            odd_row = False
        elif kind == "grand":
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#E2EFDA')),
                ('TEXTCOLOR', (0, row_idx), (-1, row_idx), colors.HexColor('#276A3C')),
                ('FONTNAME', (0, row_idx), (-1, row_idx), FONT_BOLD),
                ('FONTSIZE', (0, row_idx), (-1, row_idx), f_size + 0.3),
                ('ALIGN', (0, row_idx), (0, row_idx), 'LEFT'),
                ('ALIGN', (1, row_idx), (-1, row_idx), 'RIGHT'),
                ('LINEABOVE', (0, row_idx), (-1, row_idx), 0.75, colors.HexColor('#1F3864')),
                ('LINEBELOW', (0, row_idx), (-1, row_idx), 1.25, colors.HexColor('#1F3864')),
            ])
            if len(vals) == 1 and num_cols > 2:
                t_style.append(('ALIGN', (1, row_idx), (-1, row_idx), 'RIGHT'))
            odd_row = False
        elif kind == "check":
            good = all(isinstance(v, (int, float)) and abs(v) < 1e-4 for v in vals)
            bg = colors.HexColor('#E2EFDA') if good else colors.HexColor('#FFEBEE')
            fg = colors.HexColor('#276A3C') if good else colors.HexColor('#C00000')
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), bg),
                ('TEXTCOLOR', (0, row_idx), (-1, row_idx), fg),
                ('FONTNAME', (0, row_idx), (-1, row_idx), FONT_BOLD),
                ('FONTSIZE', (0, row_idx), (-1, row_idx), f_size),
                ('ALIGN', (0, row_idx), (0, row_idx), 'LEFT'),
                ('ALIGN', (1, row_idx), (-1, row_idx), 'RIGHT'),
            ])
            odd_row = False
        elif kind == "note":
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), colors.white),
                ('TEXTCOLOR', (0, row_idx), (-1, row_idx), colors.HexColor('#666666')),
                ('FONTNAME', (0, row_idx), (-1, row_idx), FONT_ITALIC),
                ('FONTSIZE', (0, row_idx), (-1, row_idx), f_size - 0.4),
                ('ALIGN', (0, row_idx), (-1, row_idx), 'LEFT'),
                ('SPAN', (0, row_idx), (-1, row_idx)),
                ('TOPPADDING', (0, row_idx), (-1, row_idx), 0.5),
                ('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 0.5),
            ])
            odd_row = False
        elif kind == "blank":
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), colors.white),
                ('SPAN', (0, row_idx), (-1, row_idx)),
                ('TOPPADDING', (0, row_idx), (-1, row_idx), 0.5),
                ('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 0.5),
            ])
            odd_row = False
        else: # "row"
            bg = colors.white if not odd_row else colors.HexColor('#F2F2F2')
            odd_row = not odd_row
            t_style.extend([
                ('BACKGROUND', (0, row_idx), (-1, row_idx), bg),
                ('TEXTCOLOR', (0, row_idx), (-1, row_idx), colors.HexColor('#1A1A1A')),
                ('FONTNAME', (0, row_idx), (-1, row_idx), FONT_NORM),
                ('FONTSIZE', (0, row_idx), (-1, row_idx), f_size),
                ('ALIGN', (0, row_idx), (0, row_idx), 'LEFT'),
                ('ALIGN', (1, row_idx), (-1, row_idx), 'RIGHT'),
                ('LINEBELOW', (0, row_idx), (-1, row_idx), 0.25, colors.HexColor('#E5E5E5')),
            ])

    t_style.append(('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#BFBFBF')))
    t = Table(table_data, colWidths=col_widths, repeatRows=1 if rows[0][0] == "head" else 0)
    t.setStyle(TableStyle(t_style))
    return t

def register_calibri():
    font_path = 'C:/Windows/Fonts/calibri.ttf'
    bold_path = 'C:/Windows/Fonts/calibrib.ttf'
    italic_path = 'C:/Windows/Fonts/calibrii.ttf'
    bolditalic_path = 'C:/Windows/Fonts/calibriz.ttf'
    if os.path.exists(font_path) and os.path.exists(bold_path):
        try:
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            pdfmetrics.registerFont(TTFont('Calibri', font_path))
            pdfmetrics.registerFont(TTFont('Calibri-Bold', bold_path))
            if os.path.exists(italic_path):
                pdfmetrics.registerFont(TTFont('Calibri-Italic', italic_path))
            if os.path.exists(bolditalic_path):
                pdfmetrics.registerFont(TTFont('Calibri-BoldItalic', bolditalic_path))
            registerFontFamily('Calibri', normal='Calibri', bold='Calibri-Bold', 
                               italic='Calibri-Italic' if os.path.exists(italic_path) else 'Calibri', 
                               boldItalic='Calibri-BoldItalic' if os.path.exists(bolditalic_path) else 'Calibri-Bold')
            return 'Calibri', 'Calibri-Bold', 'Calibri-Italic'
        except Exception:
            pass
    return FONT_NORM, FONT_BOLD, FONT_ITALIC

FONT_NORM, FONT_BOLD, FONT_ITALIC = register_calibri()

def _pdf_split_report_into_sections(rows):
    sections = []
    current_sec = []
    for r in rows:
        if r[0] == "head" and current_sec:
            sections.append(current_sec)
            current_sec = [r]
        elif r[0] == "blank" and current_sec:
            sections.append(current_sec)
            current_sec = []
        else:
            if r[0] != "blank":
                current_sec.append(r)
    if current_sec:
        sections.append(current_sec)
    return sections

def export_to_pdf(output_path, a, R):
    def _xml_escape(text):
        if text is None: return ""
        s = str(text).replace("₹", "Rs. ")
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    IS, BS, CF = build_reports(a, R)

    # 2.5 cm margins = 70.87 pt
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=70.87,
        rightMargin=70.87,
        topMargin=70.87,
        bottomMargin=70.87,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName=FONT_BOLD,
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#1F3864'),
        keepWithNext=True
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName=FONT_NORM,
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#666666'),
        keepWithNext=True
    )
    sec_heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName=FONT_BOLD,
        fontSize=9,
        leading=11.5,
        textColor=colors.HexColor('#1F3864'),
        spaceAfter=2,
        spaceBefore=3,
        keepWithNext=True
    )

    story = []
    total_w = 700.15  # 841.89 - 2 * 70.87

    # =========================================================================
    # PAGE 1: FRONT PAGE & PROJECT INFORMATION DOSSIER
    # =========================================================================
    pname = a.get("project_name", "Detailed Project Report") or "Detailed Project Report"
    ppurpose = a.get("project_purpose", "")
    bank_nm = a.get("bank_name", "")
    bank_br = a.get("bank_branch", "")
    bank_addr = a.get("bank_address", "")
    fac_tl = a.get("facility_term_loan", "")
    fac_wc = a.get("facility_wc", "")
    fac_tot = a.get("facility_total", "")

    # Top Banner Table
    title_p = Paragraph(
        f"<b>DETAILED PROJECT REPORT (DPR)</b><br/>"
        f"<font size=10.5 color='#FFF2CC'><b>{_xml_escape(pname).upper()}</b></font><br/>"
        f"<font size=7.5 color='#D9E1F2'><b>Project Purpose:</b> {_xml_escape(ppurpose)}</font><br/>"
        f"<font size=7.5 color='#FFFFFF'><b>Submitted To:</b> {_xml_escape(bank_nm)}  |  {_xml_escape(bank_br)}</font><br/>"
        f"<font size=7 color='#D9E1F2'>{_xml_escape(bank_addr)}</font>",
        ParagraphStyle('T_FP', fontName=FONT_NORM, fontSize=13, leading=15, textColor=colors.white)
    )

    fac_p = Paragraph(
        f"<b>CREDIT FACILITIES SOUGHT</b><br/>"
        f"<font size=7.5 color='#FFFFFF'><b>- Term Loan:</b> {_xml_escape(fac_tl)}</font><br/>"
        f"<font size=7.5 color='#D9E1F2'><b>- Working Capital:</b> {_xml_escape(fac_wc)}</font><br/>"
        f"<font size=8 color='#A9D18E'><b>- Total Proposed:</b> {_xml_escape(fac_tot)}</font><br/>"
        f"<font size=6.8 color='#D9E1F2'><b>Appraisal Type:</b> Project Finance &amp; Term Loan Appraisal</font>",
        ParagraphStyle('F_FP', fontName=FONT_NORM, fontSize=8, leading=11, textColor=colors.white)
    )

    banner_table = Table([[title_p, fac_p]], colWidths=[total_w * 0.62, total_w * 0.38])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1F3864')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#102040')),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 3))

    # Section 1 Header: Entity Details & Statutory Registrations
    sec1_hdr = Table([[Paragraph("<b>1. ENTITY DETAILS &amp; STATUTORY REGISTRATIONS</b>",
                                  ParagraphStyle('S1H', fontName=FONT_BOLD, fontSize=8, leading=10, textColor=colors.white))]],
                     colWidths=[total_w])
    sec1_hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#2F5597')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(sec1_hdr)
    story.append(Spacer(1, 2))

    lbl_s = ParagraphStyle('L_FP', fontName=FONT_BOLD, fontSize=6.5, leading=8.5, textColor=colors.HexColor('#1F3864'))
    val_s = ParagraphStyle('V_FP', fontName=FONT_NORM, fontSize=6.5, leading=8.5, textColor=colors.HexColor('#222222'))
    val_b = ParagraphStyle('VB_FP', fontName=FONT_BOLD, fontSize=6.5, leading=8.5, textColor=colors.HexColor('#276A3C'))

    w_half = total_w / 2.0
    sec1_col1 = [
        [Paragraph("Entity Legal Name:", lbl_s), Paragraph(_xml_escape(a.get("entity_name")), val_b)],
        [Paragraph("Constitution:", lbl_s), Paragraph(_xml_escape(a.get("constitution")), val_s)],
        [Paragraph("Registered Office:", lbl_s), Paragraph(_xml_escape(a.get("reg_address")), val_s)],
        [Paragraph("Project Location:", lbl_s), Paragraph(_xml_escape(a.get("unit_location")), val_s)],
        [Paragraph("Commencement Date:", lbl_s), Paragraph(_xml_escape(a.get("commencement_date")), val_s)],
        [Paragraph("Contact Details:", lbl_s), Paragraph(f"Ph: {_xml_escape(a.get('contact_phone'))} | Email: {_xml_escape(a.get('contact_email'))}", val_s)],
    ]
    t_sec1_c1 = Table(sec1_col1, colWidths=[w_half * 0.35, w_half * 0.65])
    t_sec1_c1.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9D9D9')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#EAEAEA')),
    ]))

    sec1_col2 = [
        [Paragraph("PAN Number:", lbl_s), Paragraph(_xml_escape(a.get("pan")), val_b)],
        [Paragraph("GSTIN Registration:", lbl_s), Paragraph(_xml_escape(a.get("gstin")), val_b)],
        [Paragraph("Udyam (MSME) Reg:", lbl_s), Paragraph(_xml_escape(a.get("udyam")), val_s)],
        [Paragraph("CIN / LLPIN Number:", lbl_s), Paragraph(_xml_escape(a.get("cin")), val_s)],
        [Paragraph("Statutory Licences:", lbl_s), Paragraph(_xml_escape(a.get("licences")), val_s)],
        [Paragraph("Website:", lbl_s), Paragraph(_xml_escape(a.get("contact_web")), val_s)],
    ]
    t_sec1_c2 = Table(sec1_col2, colWidths=[w_half * 0.35, w_half * 0.65])
    t_sec1_c2.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9D9D9')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#EAEAEA')),
    ]))

    sec1_table = Table([[t_sec1_c1, t_sec1_c2]], colWidths=[w_half, w_half])
    sec1_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(sec1_table)
    story.append(Spacer(1, 3))

    # Section 2 Header: Promoter / Management Details & Banking Profile
    sec2_hdr = Table([[Paragraph("<b>2. PROMOTER / MANAGEMENT DETAILS &amp; BANKING PROFILE</b>",
                                  ParagraphStyle('S2H', fontName=FONT_BOLD, fontSize=8, leading=10, textColor=colors.white))]],
                     colWidths=[total_w])
    sec2_hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#2F5597')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(sec2_hdr)
    story.append(Spacer(1, 2))

    w_prom = total_w * 0.58
    w_bank = total_w * 0.42

    prom_rows = [
        [Paragraph("Name &amp; Designation:", lbl_s), Paragraph(f"<b>{_xml_escape(a.get('promoter_name'))}</b> ({_xml_escape(a.get('promoter_desig'))})", val_s)],
        [Paragraph("Shareholding &amp; Net Worth:", lbl_s), Paragraph(_xml_escape(a.get('promoter_networth')), val_b)],
        [Paragraph("DIN / DPIN Number:", lbl_s), Paragraph(_xml_escape(a.get('promoter_din')), val_s)],
        [Paragraph("Educational Qualification:", lbl_s), Paragraph(_xml_escape(a.get('promoter_qual')), val_s)],
        [Paragraph("Experience in Line:", lbl_s), Paragraph(_xml_escape(a.get('promoter_exp')), val_s)],
        [Paragraph("Residential Address:", lbl_s), Paragraph(_xml_escape(a.get('promoter_address')), val_s)],
    ]
    t_prom = Table(prom_rows, colWidths=[w_prom * 0.32, w_prom * 0.68])
    t_prom.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9D9D9')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#EAEAEA')),
    ]))

    bank_rows = [
        [Paragraph("Authorised Signatory:", lbl_s), Paragraph(f"<b>{_xml_escape(a.get('auth_signatory'))}</b>", val_s)],
        [Paragraph("Promoter CIBIL Score:", lbl_s), Paragraph(_xml_escape(a.get('cibil_score')), val_b)],
        [Paragraph("Existing Bank Limits:", lbl_s), Paragraph(_xml_escape(a.get('existing_bank_limits')), val_s)],
        [Paragraph("Credit Rating / Conduct:", lbl_s), Paragraph(_xml_escape(a.get('credit_rating')), val_s)],
        [Paragraph("Statutory Auditor:", lbl_s), Paragraph(_xml_escape(a.get('statutory_auditor')), val_s)],
        [Paragraph("Place &amp; Date of Dossier:", lbl_s), Paragraph(f"{_xml_escape(a.get('dossier_place'))} | {_xml_escape(a.get('dossier_date'))}", val_s)],
    ]
    t_bank = Table(bank_rows, colWidths=[w_bank * 0.38, w_bank * 0.62])
    t_bank.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9D9D9')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#EAEAEA')),
    ]))

    sec2_table = Table([[t_prom, t_bank]], colWidths=[w_prom, w_bank])
    sec2_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(sec2_table)
    story.append(Spacer(1, 3))

    # Declaration note
    decl_p = Paragraph(
        "<b>Declaration &amp; Certification:</b> We hereby certify that the particulars, statements, and financial projections given above and in the annexed detailed project report are true, correct, and complete to the best of our knowledge and belief, and no material fact has been omitted.",
        ParagraphStyle('Dec', fontName=FONT_ITALIC, fontSize=6.5, leading=8.5, textColor=colors.HexColor('#555555'))
    )
    decl_t = Table([[decl_p]], colWidths=[total_w])
    decl_t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F2F2F2')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9D9D9')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(decl_t)

    # =========================================================================
    # PAGE 2: EXECUTIVE DASHBOARD & PROJECT SNAPSHOT
    # =========================================================================
    story.append(PageBreak())
    banner_data = [
        [
            Paragraph(f"<b>DETAILED PROJECT REPORT (DPR)</b><br/><font size=10 color='#1F3864'>{pname.upper()}</font>", title_style),
            Paragraph("<b>Project Finance &amp; Term Loan Appraisal</b><br/>"
                      f"Construction Start: {fy_label(a['start_fy'])} | Tenure: {a['tenure']} Years<br/>"
                      f"Currency: Indian Rupee (INR) | Denomination: ₹ in Crore", subtitle_style)
        ]
    ]
    banner_t = Table(banner_data, colWidths=[total_w * 0.60, total_w * 0.40])
    banner_t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('LINEBELOW', (0, 0), (-1, -1), 1.0, colors.HexColor('#1F3864')),
    ]))
    story.append(banner_t)
    story.append(Spacer(1, 3))

    story.append(Paragraph("<b>1. Key Financial &amp; Operational Highlights (₹ in Crore)</b>", sec_heading_style))
    story.append(_pdf_build_kpi_card_table(a, R, total_w))
    story.append(Spacer(1, 3))

    story.append(Paragraph("<b>2. Banker's Appraisal &amp; Viability Benchmarks</b>", sec_heading_style))
    story.append(_pdf_build_banker_checks_table(a, R, total_w))
    story.append(Spacer(1, 3))

    story.append(Paragraph("<b>3. Operating Performance &amp; Debt Service Trajectory (₹ in Crore)</b>", sec_heading_style))
    chart_w = (total_w - 10) / 2.0
    lab = [y[2:] for y in R["ops_years"]]
    
    # Series in Crore!
    rev_cr = R["rev"]
    pat_cr = R["pat"]
    ch1 = _pdf_make_bar_chart(
        "Revenue vs Net Profit After Tax (PAT) [₹ in Crore]",
        lab,
        [rev_cr, pat_cr],
        ['#1F3864', '#2F5597'],
        ["Revenue", "PAT"],
        width=chart_w,
        height=125
    )
    dscr_clean = [(0.0 if v is None else v) for v in R["dscr"]]
    ch2 = _pdf_make_bar_chart(
        "Debt Service Coverage Ratio (DSCR) [Times]",
        lab,
        [dscr_clean],
        ['#276A3C'],
        ["DSCR"],
        width=chart_w,
        height=125,
        hline=1.25,
        hname="1.25x Min"
    )
    chart_table = Table([[ch1, ch2]], colWidths=[chart_w + 5, chart_w + 5])
    chart_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(chart_table)

    # =========================================================================
    # PAGE 3: ASSUMPTIONS, PROJECT COST & MEANS OF FINANCE
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("<b>PROJECT ASSUMPTIONS, COST OF PROJECT &amp; MEANS OF FINANCE (₹ in Crore)</b>", title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1F3864'), spaceAfter=2, spaceBefore=1))

    mof_rows = [
        ("head", "Particulars", ["Total Cost", "Margin %", "Promoter Contribution", "Bank Finance"], "num"),
    ]
    for i, it in enumerate(a["items"]):
        mof_rows.append(("row", it["name"], [it["cost"], it["margin"], R["prom_item"][i], R["bank_item"][i]],
                         ["num", "pct", "num", "num"]))
    mof_rows.append(("total", "Core Project Cost [A]", [R["core"], "", R["core_prom"], R["core_bank"]], "num"))
    mof_rows.append(("row", "Interest During Construction [B]", [R["idc"], 1.0, R["idc"], 0.0],
                     ["num", "pct", "num", "num"]))
    mof_rows.append(("grand", "Total Project Cost [A+B]", [R["total_cost"], "", R["total_prom"], R["total_bank"]], "num"))

    story.append(Paragraph("<b>Project Cost Breakdown &amp; Financing Plan (₹ in Crore)</b>", sec_heading_style))
    story.append(_pdf_convert_rows_to_table(mof_rows, total_width=total_w, default_col0_width=210, pad_v=0.6, scale_lakh=False))
    story.append(Spacer(1, 2))

    phase_rows = [
        ("head", "Cost Phasing (% per quarter)", ["Q%d" % (q + 1) for q in range(R["nq"])], "num")
    ]
    for it in a["items"]:
        ph = list(it["phasing"])
        phase_rows.append(("row", it["name"], ph[:R["nq"] - 1] + [1.0 - sum(ph[:R["nq"] - 1])], "pct"))

    story.append(Paragraph("<b>Quarterly Capital Expenditure Phasing</b>", sec_heading_style))
    story.append(_pdf_convert_rows_to_table(phase_rows, total_width=total_w, default_col0_width=200, pad_v=0.6, scale_lakh=False))
    story.append(Spacer(1, 2))

    # Operational Parameters
    story.append(Paragraph("<b>Summary of Operational, Financing &amp; Tax Parameters</b>", sec_heading_style))
    repay_lbl = REPAY_LABELS.get(a.get("repay_type", "stepped"), a.get("repay_type", "stepped"))
    param_list = [
        ("Term Loan Interest Rate", f"{a['rate']*100:.2f}% p.a."),
        ("Corporate Tax Rate", f"{a['tax']*100:.2f}%"),
        ("Useful Life: Hotel Building", f"{a['life_bldg']:.0f} Years"),
        ("Useful Life: Kitchen Equipment", f"{a['life_equip']:.0f} Years"),
        ("Revenue Share: Rooms", f"{a['room_share']*100:.1f}%"),
        ("Revenue Share: Food & Beverages", f"{a['fb_share']*100:.1f}%"),
        ("Revenue Share: Other Sources", f"{(1.0 - a['room_share'] - a['fb_share'])*100:.1f}%"),
        ("Total Room Capacity", f"{a['rooms']} Rooms"),
        ("Operating Days / Year", f"{a['days']} Days"),
        ("First Year Occupancy / Cap", f"{a['occ']*100:.1f}% / {a['occ_cap']*100:.1f}%"),
        ("Annual Occupancy Ramp-up", f"{a['occ_inc']*100:.1f}%"),
        ("Initial Room Tariff per Day", f"Rs. {a['tariff']:,.0f}"),
        ("Annual Room Tariff Escalation", f"{a['tariff_inc']*100:.1f}%"),
        ("F&B Consumables (% Rev)", f"{a['exp_fb']*100:.1f}%"),
        ("Employee Costs (% Rev)", f"{a['exp_emp']*100:.1f}%"),
        ("Power & Fuel (% Rev)", f"{a['exp_power']*100:.1f}%"),
        ("Other Variable Costs (% Rev)", f"{a['exp_oth']*100:.1f}%"),
        ("Marriott Service Fees (% Room Rev)", f"{a['exp_service']*100:.1f}%"),
        ("Admin & Selling Exp (% Rev Yr 1)", f"{a['admin']*100:.1f}%"),
        ("Admin Exp Annual Inflation", f"{a['admin_inc']*100:.1f}%"),
        ("Term Loan Repayment Tenure", f"{a['tenure']} Years"),
        ("Total Loan Installments", f"{a['installments']} Installments"),
        ("Repayment Amortization Profile", repay_lbl),
    ]
    half = (len(param_list) + 1) // 2
    col1, col2 = param_list[:half], param_list[half:]

    def _format_param_subtable(plist, width):
        tdata = []
        for k, v in plist:
            tdata.append([k, v])
        t_s = [
            ('FONTNAME', (0, 0), (0, -1), FONT_NORM),
            ('FONTSIZE', (0, 0), (-1, -1), 4.8),
            ('FONTNAME', (1, 0), (1, -1), FONT_BOLD),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 0.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.HexColor('#E5E5E5')),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#BFBFBF')),
        ]
        tb = Table(tdata, colWidths=[width * 0.65, width * 0.35])
        tb.setStyle(TableStyle(t_s))
        return tb

    half_w = (total_w - 10) / 2.0
    params_table = Table([[_format_param_subtable(col1, half_w), _format_param_subtable(col2, half_w)]],
                         colWidths=[half_w + 5, half_w + 5])
    params_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(params_table)

    # =========================================================================
    # PAGE 4: PROJECT INCOME STATEMENT (OPERATING PERFORMANCE)
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("<b>PROJECT INCOME STATEMENT - OPERATING PERFORMANCE (₹ in Crore)</b>", title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1F3864'), spaceAfter=2, spaceBefore=1))

    is_sections = _pdf_split_report_into_sections(IS)
    if is_sections:
        sec_pnl = []
        for r in is_sections[0]:
            if r[0] == "note":
                sec_pnl.append(("note", "All amounts in ₹ in Crore", [], "num"))
            else:
                sec_pnl.append(r)
        story.append(_pdf_convert_rows_to_table(sec_pnl, total_width=total_w, default_col0_width=180, pad_v=0.6, scale_lakh=False))

    # =========================================================================
    # PAGE 5: DEBT SERVICE & LOAN AMORTIZATION
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("<b>TERM LOAN REPAYMENT SCHEDULE &amp; DEBT SERVICE COVERAGE (₹ in Crore)</b>", title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1F3864'), spaceAfter=3, spaceBefore=1))

    if len(is_sections) > 1:
        story.append(Paragraph("<b>1. Term Loan Repayment Schedule &amp; Interest Burden (₹ in Crore)</b>", sec_heading_style))
        story.append(_pdf_convert_rows_to_table(is_sections[1], total_width=total_w, default_col0_width=180, pad_v=0.65, scale_lakh=False))
        story.append(Spacer(1, 3))

    if len(is_sections) > 2:
        story.append(Paragraph("<b>2. Debt Service Coverage Ratio (DSCR) Analysis (₹ in Crore)</b>", sec_heading_style))
        story.append(_pdf_convert_rows_to_table(is_sections[2], total_width=total_w, default_col0_width=180, pad_v=0.65, scale_lakh=False))
        story.append(Spacer(1, 3))

    # Loan repayment chart
    story.append(Paragraph("<b>3. Outstanding Term Loan Principal Amortization Trajectory (₹ in Crore)</b>", sec_heading_style))
    debt_cr = R["l_close"]
    ch_debt = _pdf_make_bar_chart(
        "Outstanding Term Loan Balance Trajectory [₹ in Crore]",
        lab,
        [debt_cr],
        ['#1F3864'],
        ["Closing Debt"],
        width=total_w,
        height=85
    )
    story.append(ch_debt)

    # =========================================================================
    # PAGE 6: FINANCIAL VIABILITY, BREAK-EVEN & RETURNS
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("<b>PROJECT PROFITABILITY, BREAK-EVEN &amp; FINANCIAL VIABILITY (₹ in Crore)</b>", title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1F3864'), spaceAfter=3, spaceBefore=1))

    if len(is_sections) > 5:
        story.append(Paragraph("<b>1. Break-Even Point (BEP) Analysis &amp; Margin of Safety (₹ in Crore)</b>", sec_heading_style))
        story.append(_pdf_convert_rows_to_table(is_sections[5], total_width=total_w, default_col0_width=180, pad_v=0.65, scale_lakh=False))
        story.append(Spacer(1, 3))

    if len(is_sections) > 3:
        story.append(Paragraph("<b>2. Internal Rate of Return (IRR) Schedule (₹ in Crore)</b>", sec_heading_style))
        story.append(_pdf_convert_rows_to_table(is_sections[3], total_width=total_w, default_col0_width=180, pad_v=0.65, scale_lakh=False))
        story.append(Spacer(1, 3))

    if len(is_sections) > 4:
        story.append(Paragraph("<b>3. Simple Pay-Back Period Calculation</b>", sec_heading_style))
        story.append(_pdf_convert_rows_to_table(is_sections[4], total_width=total_w, default_col0_width=180, pad_v=0.65, scale_lakh=False))

    # =========================================================================
    # PAGE 7: PROJECTED BALANCE SHEET & CASH FLOW STATEMENT
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("<b>PROJECTED BALANCE SHEET &amp; CASH FLOW STATEMENT (₹ in Crore)</b>", title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1F3864'), spaceAfter=3, spaceBefore=1))

    story.append(Paragraph("<b>1. Projected Balance Sheet (₹ in Crore)</b>", sec_heading_style))
    bs_lakh = [r for r in BS if r[0] != "note"]
    story.append(_pdf_convert_rows_to_table(bs_lakh, total_width=total_w, default_col0_width=165, pad_v=0.45, scale_lakh=False))
    story.append(Spacer(1, 2))

    story.append(Paragraph("<b>2. Projected Cash Flow Statement (₹ in Crore)</b>", sec_heading_style))
    cf_lakh = [r for r in CF if r[0] != "note"]
    story.append(_pdf_convert_rows_to_table(cf_lakh, total_width=total_w, default_col0_width=165, pad_v=0.45, scale_lakh=False))

    def on_page_setup(canvas_obj, doc_obj):
        canvas_obj._entity_name = str(a.get("entity_name", "Grand Horizon Hospitality Pvt Ltd"))
        canvas_obj._doc_title = f"{pname.upper()} - DETAILED PROJECT REPORT"

    doc.build(
        story,
        canvasmaker=_NumberedCanvas,
        onFirstPage=on_page_setup,
        onLaterPages=on_page_setup
    )
    print(f"Successfully generated 7-page PDF at: {output_path}")
    return True


# --------------------------------------------------------------------------
def main():
    try:                                    # sharper text on high-DPI Windows screens
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
