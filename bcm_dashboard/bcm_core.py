"""
bcm_core.py - data loading, cleaning and aggregation for the BCM Finance dashboard.

Python port of the logic in BCM_Finance_GRN_VIT_PRF_Dashboard_v10.html
(header-row detection, column aliasing, MSME / ageing normalisation, Indian
financial-year derivation, Indian number formatting, grouping and zone ranking).
"""
from __future__ import annotations

import io
import re
from datetime import datetime, timedelta

import warnings

import pandas as pd

warnings.filterwarnings("ignore", message="Parsing dates")
warnings.filterwarnings("ignore", message="Could not infer format")

# --------------------------------------------------------------------------
# Module configuration
# --------------------------------------------------------------------------
MODULES = {
    "grn": {
        "sheet": "Open_GRN",
        "name": "Open GRN/SRN",
        "subtitle": "BCM Monthly Finance Dashboard | Open GRN/SRN Monitoring",
        "detail_title": "Open GRN/SRN Details",
        "export_name": "BCM_Open_GRN_Filtered_View.csv",
        "record_label": "GRN/SRN records",
        "profit_label": "Profit Center-wise Open Value",
        "vendor_subtitle": "Top 10 vendors by open GRN/SRN value. Click a bar to open transaction details.",
        "has_msme": True,
        "amount_in_lakhs": True,
        "amount_col": "Rs. In Lakhs",
        "date_col": "GRN Posting Date",
    },
    "vitprf": {
        "sheet": "VIT_PRF",
        "name": "Open VIT/PRF",
        "subtitle": "BCM Monthly Finance Dashboard | Open VIT/PRF Monitoring",
        "detail_title": "Open VIT/PRF Details",
        "export_name": "BCM_Open_VIT_PRF_Filtered_View.csv",
        "record_label": "VIT/PRF records",
        "profit_label": "Profit Center-wise Open VIT/PRF Value",
        "vendor_subtitle": "Top 10 vendors by open VIT/PRF value. Click a bar to open transaction details.",
        "has_msme": False,
        "amount_in_lakhs": False,
        "amount_col": "Gross Amount",
        "date_col": "VIT/PRF Posting Date",
    },
}

AGE_ORDER = [
    "Upto Mar 2024", "2024-2025", "Apr-25 to Sep-25",
    "Oct-25 to Mar-26", "Apr-26", "May-26", "June-26 Onwards",
]
VIT_AGE_ORDER = ["0-30 days", "30-45 days", "45-90 days", "90-180 days", "> 6 months"]

DISPLAY_COLUMNS = {
    "grn": ["GRN Posting Date", "Financial Year", "Profit Center", "Profit center Decrip",
            "Vendor Code", "Vendor Name", "MSME Classfication", "Rs. In Lakhs"],
    "vitprf": ["VIT/PRF Posting Date", "Financial Year", "Proc Type Text", "Profit Center",
               "Profit center Decrip", "Vendor Code", "Vendor Name", "Gross Amount"],
}
DRILL_COLUMNS = {
    "grn": ["GRN Posting Date", "Financial Year", "Profit Center", "Profit center Decrip",
            "Vendor Code", "Vendor Name", "MSME Classfication", "Rs. In Lakhs",
            "SBU", "ZONE_C", "Period as per Posting Date"],
    "vitprf": ["VIT/PRF Posting Date", "Financial Year", "Proc Type Text", "Reference No",
               "Profit Center", "Profit center Decrip", "Vendor Code", "Vendor Name",
               "Gross Amount", "SBU", "ZONE_C", "Period as per Posting Date"],
}

# --------------------------------------------------------------------------
# Column aliases (same lists as the HTML tool)
# --------------------------------------------------------------------------
ALIASES = {
    "profit_center": ["Profit Center", "Profit center", "Profit\nCenter", "Profit Centre",
                      "Profit Centre Code", "Plant", "Plant Code", "Business Area",
                      "Cost Center", "Cost Centre"],
    "profit_center_desc": ["Profit center Decrip", "Profit Center Decrip", "Profit center Description",
                           "Profit Center Description", "Profit Center Name", "Profit Centre Name",
                           "Plant Name", "Location", "Department"],
    "profit_center_name": ["Profit Center Name", "Profit Centre Name", "Profit center Decrip",
                           "Profit Center Decrip", "Profit center Description",
                           "Profit Center Description", "Plant Name", "Location", "Department",
                           "Profit Center", "Profit Centre", "Plant"],
    "zone": ["Sub Zone", "Sub-Zone", "SubZone", "ZONE_C", "ZONE C", "Zone_C", "ZONE", "Zone"],
    "amount_vitprf": ["Gross Amount", "VIT Amount", "PRF Amount", "VIT/PRF Amount", "Amount",
                      "Value", "Net Amount", "Invoice Amount", "Document Amount"],
    "amount_grn": ["Rs. In Lakhs", "Rs In Lakhs", "Amount Rs Lakhs", "Amount in Lakhs",
                   "Open Amount Rs Lakhs", "Open Amount", "Amount", "Value", "Net Amount",
                   "Invoice Amount", "Document Amount"],
    "period": ["Period as per Posting Date", "Period/Year", "Period Year", "Ageing",
               "Ageing Bucket", "Age Bucket", "Period", "Bucket"],
    "posting_date": ["GRN Posting Date", "VIT Posting Date", "PRF Posting Date",
                     "VIT/PRF Posting Date", "Posting Date", "Document Date", "Doc Date",
                     "Entry Date", "Created On", "Creation Date"],
    "reference": ["Reference No", "Reference Number", "VIT No", "VIT Number", "PRF No",
                  "PRF Number", "VIT/PRF No", "Document No", "Document Number",
                  "Invoice No", "Invoice Number"],
    "fy": ["Financial Year", "FY", "Fiscal Year", "Fisc Year"],
    "proc_type": ["Proc Type Text", "Proc. Type Text", "Procurement Type Text",
                  "Process Type Text", "Proc Type", "Procurement Type"],
    "vendor_code": ["Vendor Code", "Supplier Code", "Party Code"],
    "vendor_name": ["Vendor Name", "Supplier Name", "Supplier", "Party Name", "Party", "Payee Name"],
    "msme": ["MSME Classfication", "MSME Classification", "MSME", "MSME Status", "Vendor MSME"],
    "sbu": ["SBU", "Business Unit", "BU"],
}

EXPECTED_HEADERS = [
    "sbu", "zonec", "zone", "msmeclassfication", "msmeclassification",
    "rsinlakhs", "amount", "value", "openamount", "grossamount", "netamount",
    "profitcenter", "profitcentername", "plant", "plantname",
    "vendorcode", "vendorname", "supplier", "suppliername", "party", "partyname",
    "postingdate", "documentdate", "docdate", "createdon", "vit", "prf", "referenceno",
]


# --------------------------------------------------------------------------
# Text / number helpers
# --------------------------------------------------------------------------
def normalize_header(h) -> str:
    s = "" if h is None else str(h)
    s = s.replace(" ", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return re.sub(r"[^a-z0-9]", "", s)


def clean_text(v, fallback: str = "Unclassified") -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return fallback
    s = re.sub(r"\s+", " ", str(v).replace(" ", " ")).strip()
    return fallback if s == "" else s


def parse_amount(v) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return 0.0 if pd.isna(v) else float(v)
    t = str(v).strip()
    neg = bool(re.fullmatch(r"\(.*\)", t))
    t = re.sub(r"[₹\s,()]", "", t)
    t = re.sub(r"[^0-9.\-]", "", t)
    try:
        x = float(t)
    except ValueError:
        return 0.0
    return -abs(x) if neg else x


def parse_date_any(v):
    if v is None or (isinstance(v, float) and pd.isna(v)) or v == "":
        return None
    if isinstance(v, (pd.Timestamp, datetime)):
        return pd.Timestamp(v)
    if isinstance(v, (int, float)):
        return pd.Timestamp("1899-12-30") + timedelta(days=float(v))
    t = str(v).strip()
    if not t:
        return None
    if re.match(r"^\d{4}-\d{1,2}-\d{1,2}", t):  # ISO text (e.g. 2026-08-05 00:00:00) - never day-first
        d = pd.to_datetime(t, errors="coerce")
        return None if pd.isna(d) else d
    # day-first first (Indian data), then fall back to pandas' default parser
    for dayfirst in (True, False):
        try:
            d = pd.to_datetime(t, dayfirst=dayfirst)
            if not pd.isna(d):
                return d
        except (ValueError, TypeError):
            pass
    return None


def format_date_dmy(v) -> str:
    d = parse_date_any(v)
    if d is None:
        return clean_text(v, "")
    return d.strftime("%d-%b-%Y")


def derive_indian_fy(v) -> str:
    d = parse_date_any(v)
    if d is None:
        return "Unclassified"
    start = d.year if d.month >= 4 else d.year - 1
    return f"{start}-{(start + 1) % 100:02d}"


def classify_msme(v) -> str:
    raw = clean_text(v)
    up = raw.upper()
    if raw == "Unclassified":
        return "Unclassified"
    if any(k in up for k in ("NON MSME", "NON-MSME", "NONMSME", "NOT MSME", "NO MSME")) or up in ("NO", "NA", "N/A"):
        return "Non MSME"
    if any(k in up for k in ("MSME", "MICRO", "SMALL", "MEDIUM")) or up == "YES":
        return "MSME"
    return raw


def normalize_age_period(v) -> str:
    raw = clean_text(v)
    up = re.sub(r"\s+", " ", raw.upper()).strip()
    if raw == "Unclassified":
        return "Unclassified"
    if any(k in up for k in ("UPTO MAR 2024", "UP TO MAR 2024", "TILL MAR 2024", "MAR 2024")):
        return "Upto Mar 2024"
    if any(k in up for k in ("2024-2025", "2024 - 2025", "2024-25", "2024 2025", "FY 2024")):
        return "2024-2025"
    if "APR-25 TO SEP-25" in up or "APR 25 TO SEP 25" in up or ("APR-25" in up and "SEP-25" in up):
        return "Apr-25 to Sep-25"
    if "OCT-25 TO MAR-26" in up or "OCT 25 TO MAR 26" in up or ("OCT-25" in up and "MAR-26" in up):
        return "Oct-25 to Mar-26"
    if any(k in up for k in ("APR-26", "APR 26", "APRIL-26", "APRIL 26")):
        return "Apr-26"
    if "MAY-26" in up or "MAY 26" in up:
        return "May-26"
    if any(k in up for k in ("JUNE-26", "JUN-26", "JUNE 26", "JUN 26")):
        return "June-26 Onwards"
    c = re.sub(r"\s+", "", up).replace("–", "-").replace("—", "-")
    if any(k in c for k in ("0-30", "0TO30")):
        return "0-30 days"
    if any(k in c for k in ("30-45", "30TO45", "31-45", "31TO45")):
        return "30-45 days"
    if any(k in c for k in ("45-90", "45TO90", "46-90", "46TO90")):
        return "45-90 days"
    if any(k in c for k in ("90-180", "90TO180", "91-180", "91TO180")):
        return "90-180 days"
    if any(k in c for k in (">6", "ABOVE6", "MORETHAN6", "GREATERTHAN6", "6MONTHSABOVE", "OVER6")):
        return "> 6 months"
    return raw


def indian_int(value) -> str:
    """Whole-number Indian digit grouping: 12,34,56,789."""
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return "0"
    if pd.isna(n) or n == 0:
        return "0"
    r = int(round(n))
    sign = "-" if r < 0 else ""
    s = str(abs(r))
    last3, other = s[-3:], s[:-3]
    if other:
        other = re.sub(r"\B(?=(\d{2})+(?!\d))", ",", other)
        last3 = other + "," + last3
    return sign + last3


def indian_2dp(value) -> str:
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return "0.00"
    s = f"{abs(n):.2f}"
    whole, dec = s.split(".")
    return ("-" if n < 0 else "") + indian_int(int(whole)) + "." + dec


def to_rupees(value, module: str) -> float:
    n = float(value or 0)
    return n * 100000 if MODULES[module]["amount_in_lakhs"] else n


def fmt_amount(value, module: str) -> str:
    """Full-rupee text, e.g. ₹ 12,34,567."""
    return "₹ " + indian_int(to_rupees(value, module))


def fmt_pivot_amount(value, module: str) -> str:
    if MODULES[module]["amount_in_lakhs"]:
        return indian_2dp(value)
    return indian_int(value)


def pivot_value_header(module: str) -> str:
    return "₹ Value (Lakhs)" if MODULES[module]["amount_in_lakhs"] else "₹ Value"


def smart_amount(value, module: str) -> str:
    r = to_rupees(value, module)
    if abs(r) >= 1e7:
        return f"₹{indian_2dp(r / 1e7)} Cr"
    if abs(r) >= 1e5:
        return f"₹{indian_2dp(r / 1e5)} Lakh"
    return "₹ " + indian_int(r)


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------
def _find_header_row(raw: pd.DataFrame) -> int:
    for r in range(min(len(raw), 81)):
        hdrs = [normalize_header(x) for x in raw.iloc[r].tolist() if not pd.isna(x)]
        matches = sum(1 for h in hdrs if any(h == e or e in h for e in EXPECTED_HEADERS))
        if matches >= 3:
            return r
    return 0


def _sheet_to_frame(raw: pd.DataFrame) -> pd.DataFrame:
    if raw.empty:
        return pd.DataFrame()
    h = _find_header_row(raw)
    header = [("" if pd.isna(x) else str(x)) for x in raw.iloc[h].tolist()]
    # make duplicate / empty headers unique so pandas is happy
    seen, cols = {}, []
    for i, name in enumerate(header):
        name = name if name.strip() else f"__col{i}"
        if name in seen:
            seen[name] += 1
            name = f"{name}__{seen[name]}"
        else:
            seen[name] = 0
        cols.append(name)
    df = raw.iloc[h + 1:].copy()
    df.columns = cols
    df = df.dropna(how="all").reset_index(drop=True)
    return df


def _pick(df: pd.DataFrame, aliases: list[str]):
    """First existing column matching one of the aliases (normalised), else None."""
    norm = {}
    for c in df.columns:
        norm.setdefault(normalize_header(c), c)
    for a in aliases:
        k = normalize_header(a)
        if k in norm:
            return df[norm[k]]
    return None


def _text(df, aliases, fallback="Unclassified") -> pd.Series:
    s = _pick(df, aliases)
    if s is None:
        return pd.Series([fallback] * len(df), index=df.index, dtype=object)
    return s.map(lambda v: clean_text(v, fallback))


def normalize_frame(df: pd.DataFrame, module: str) -> pd.DataFrame:
    """Convert a raw sheet into the canonical column set used by the dashboard."""
    cfg = MODULES[module]
    n = len(df)
    out = pd.DataFrame(index=df.index)

    pc = _text(df, ALIASES["profit_center"])
    pc_desc = _text(df, ALIASES["profit_center_desc"], "")
    pc_name = _text(df, ALIASES["profit_center_name"])

    amt_src = _pick(df, ALIASES["amount_vitprf" if module == "vitprf" else "amount_grn"])
    amount = amt_src.map(parse_amount) if amt_src is not None else pd.Series([0.0] * n, index=df.index)

    date_src = _pick(df, ALIASES["posting_date"])
    if date_src is None:
        date_src = pd.Series([None] * n, index=df.index, dtype=object)
    parsed = date_src.map(parse_date_any)
    posting = parsed.map(lambda d: d.strftime("%d-%b-%Y") if d is not None and not pd.isna(d) else "")

    if module == "grn":
        fy = parsed.map(lambda d: derive_indian_fy(d))
    else:
        fy = _text(df, ALIASES["fy"], "")
        fy = fy.map(lambda x: x or "Unclassified")

    msme_src = _pick(df, ALIASES["msme"])
    if cfg["has_msme"]:
        msme = (msme_src if msme_src is not None else pd.Series([""] * n, index=df.index)).map(classify_msme)
    else:
        msme = pd.Series(["Open VIT/PRF"] * n, index=df.index)

    period_src = _pick(df, ALIASES["period"])
    period = (period_src if period_src is not None else pd.Series([""] * n, index=df.index)).map(normalize_age_period)

    out["__id"] = range(1, n + 1)
    out["__module"] = module
    out["Posting Date"] = posting
    out[cfg["date_col"]] = posting
    out["Financial Year"] = fy
    out["Reference No"] = _text(df, ALIASES["reference"], "")
    out["Proc Type Text"] = _text(df, ALIASES["proc_type"])
    out["Profit Center"] = pc
    out["Profit center Decrip"] = pc_desc
    out["Profit Center Name"] = pc_name
    out["Vendor Code"] = _text(df, ALIASES["vendor_code"], "")
    out["Vendor Name"] = _text(df, ALIASES["vendor_name"], "")
    out["MSME Classfication"] = msme
    out["Amount"] = amount
    out[cfg["amount_col"]] = amount
    out["Period as per Posting Date"] = period
    out["SBU"] = _text(df, ALIASES["sbu"])
    out["ZONE_C"] = _text(df, ALIASES["zone"])
    return out.reset_index(drop=True)


def _norm_sheet_name(s: str) -> str:
    return normalize_header(s)


def load_workbook(file_bytes: bytes, filename: str = "") -> dict[str, pd.DataFrame]:
    """Return {'grn': df, 'vitprf': df} (empty frames when a sheet is missing)."""
    result = {"grn": pd.DataFrame(), "vitprf": pd.DataFrame()}
    if filename.lower().endswith(".csv"):
        raw = pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=object, keep_default_na=False)
        result["grn"] = normalize_frame(_sheet_to_frame(raw), "grn")
        return result

    sheets = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None, header=None, dtype=object, keep_default_na=False)
    lookup = {_norm_sheet_name(k): k for k in sheets}
    for key, cfg in MODULES.items():
        name = lookup.get(_norm_sheet_name(cfg["sheet"]))
        if name is not None:
            result[key] = normalize_frame(_sheet_to_frame(sheets[name]), key)

    if result["grn"].empty and result["vitprf"].empty and sheets:
        first = next(iter(sheets.values()))
        result["grn"] = normalize_frame(_sheet_to_frame(first), "grn")
    return result


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------
def group_data(df: pd.DataFrame, field: str, module: str) -> list[dict]:
    """Group rows by `field`. Mirrors groupData(): chart amounts clamp negatives to 0."""
    amt = module_amount_col(module)
    out = []
    if df.empty:
        return out
    tmp = df.assign(_lbl=df[field].map(clean_text), _amt=df[amt].clip(lower=0))
    for label, g in tmp.groupby("_lbl", sort=False):
        out.append({
            "label": label,
            "amount": float(g["_amt"].sum()),
            "count": int(len(g)),
            "msme_amounts": g.groupby("MSME Classfication")["_amt"].sum().to_dict(),
            "msme_counts": g.groupby("MSME Classfication").size().to_dict(),
            "ids": g["__id"].tolist(),
        })
    return out


def module_amount_col(module: str) -> str:
    return MODULES[module]["amount_col"]


def sort_by_amount(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda x: (-x["amount"], x["label"]))


def apply_zone_rank(df: pd.DataFrame, module: str) -> pd.DataFrame:
    """Add a 'Zone Rank' column: top 5 rows by amount inside each zone (else NaN)."""
    df = df.copy()
    amt = module_amount_col(module)
    df["Zone Rank"] = pd.NA
    if df.empty:
        return df
    ranks = df.groupby("ZONE_C")[amt].rank(method="first", ascending=False)
    df["Zone Rank"] = ranks.where(ranks <= 5).astype("Int64")
    return df


def order_ages(labels, module: str) -> list[str]:
    order = VIT_AGE_ORDER if module == "vitprf" else AGE_ORDER
    labels = list(labels)
    return [x for x in order if x in labels] + sorted(x for x in labels if x not in order)


def build_pivot(df: pd.DataFrame, module: str, sort_period: str, sort_metric: str, asc: bool):
    """
    Returns (periods, rows, grand) where each row is
    {zone, fy, msme, sbu, pc, periods:{p:{count,amount,ids}}, total_count, total_amount, ids}.
    """
    cfg = MODULES[module]
    has_msme = cfg["has_msme"]
    has_entity = module != "vitprf"
    amt = module_amount_col(module)
    periods = order_ages(df["Period as per Posting Date"].unique(), module)
    if df.empty:
        return periods, [], None

    keys = ["ZONE_C", "MSME Classfication" if has_msme else "Financial Year", "SBU"]
    if has_entity:
        keys.append("Profit Center Name")

    rows = []
    for key, g in df.groupby(keys, sort=False):
        entry = {
            "zone": key[0], "msme": key[1] if has_msme else "", "fy": "" if has_msme else key[1],
            "sbu": key[2], "pc": key[3] if has_entity else "",
            "periods": {}, "total_count": int(len(g)), "total_amount": float(g[amt].sum()),
            "ids": g["__id"].tolist(),
        }
        for p, gp in g.groupby("Period as per Posting Date"):
            entry["periods"][p] = {"count": int(len(gp)), "amount": float(gp[amt].sum()), "ids": gp["__id"].tolist()}
        rows.append(entry)

    def metric_val(e):
        if sort_period == "Grand Total":
            return e["total_count"] if sort_metric == "count" else e["total_amount"]
        c = e["periods"].get(sort_period)
        return (c["count"] if sort_metric == "count" else c["amount"]) if c else 0

    grp2 = "msme" if has_msme else "fy"
    # stable multi-pass sort: tiebreak -> metric -> group keys
    rows.sort(key=lambda e: e["pc"] if has_entity else e["sbu"])
    rows.sort(key=metric_val, reverse=not asc)
    rows.sort(key=lambda e: (e["zone"], e[grp2], e["sbu"]))

    grand = {"periods": {p: {"count": 0, "amount": 0.0, "ids": []} for p in periods},
             "total_count": 0, "total_amount": 0.0, "ids": []}
    for e in rows:
        for p, c in e["periods"].items():
            grand["periods"][p]["count"] += c["count"]
            grand["periods"][p]["amount"] += c["amount"]
            grand["periods"][p]["ids"] += c["ids"]
        grand["total_count"] += e["total_count"]
        grand["total_amount"] += e["total_amount"]
        grand["ids"] += e["ids"]
    return periods, rows, grand
