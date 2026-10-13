"""
bcm_engine.py - generic loading + pivoting for every BCM open-item section (see bcm_config.SECTIONS).
"""
from __future__ import annotations

import io
import re
from datetime import date

import pandas as pd

from bcm_config import SECTIONS
from bcm_core import clean_text, indian_2dp, indian_int, normalize_header, parse_amount, parse_date_any

# Spelling variants of sub zones -> one display name (extend if needed)
SUBZONE_ALIASES = {"bhubaneswar": "Bhubaneshwar", "bhubaneshwar": "Bhubaneshwar", "bbsr": "Bhubaneshwar",
                   "guwahati": "Guwahati", "gauhati": "Guwahati"}

AMOUNT_FIELDS = {"amount"}
DATE_FIELDS = {"date", "entry_date", "end_date", "orig_date"}
NUM_FIELDS = {"days", "total", "verified", "ar_no", "ar_value", "cum_exp", "cum_capex", "open_cwip"}
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


# ----------------------------------------------------------------------------- reading
def read_any(file_bytes: bytes, name: str) -> dict[str, pd.DataFrame]:
    """All sheets of a workbook (or a CSV) as raw frames without headers."""
    if name.lower().endswith(".csv"):
        return {re.sub(r"\.csv$", "", name, flags=re.I): pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=object,
                                                                    keep_default_na=False)}
    return pd.read_excel(io.BytesIO(file_bytes), sheet_name=None, header=None, dtype=object, keep_default_na=False)


def _all_aliases(sec) -> set[str]:
    return {normalize_header(a) for aliases in sec["fields"].values() for a in aliases}


def _header_row(raw: pd.DataFrame, aliases: set[str]) -> int:
    best, best_score = 0, 0
    for r in range(min(len(raw), 40)):
        vals = [normalize_header(x) for x in raw.iloc[r].tolist() if str(x).strip()]
        score = sum(1 for v in vals if v in aliases)
        if score > best_score:
            best, best_score = r, score
    return best


def _frame(raw: pd.DataFrame, aliases: set[str]) -> pd.DataFrame:
    if raw.empty:
        return pd.DataFrame()
    h = _header_row(raw, aliases)
    cols, seen = [], {}
    for i, c in enumerate(raw.iloc[h].tolist()):
        c = re.sub(r"\s+", " ", str(c).replace(" ", " ")).strip() or f"Column{i + 1}"
        if c in seen:
            seen[c] += 1
            c = f"{c} ({seen[c]})"
        else:
            seen[c] = 0
        cols.append(c)
    df = raw.iloc[h + 1:].copy()
    df.columns = cols
    df = df[~(df.astype(str).apply(lambda s: s.str.strip()) == "").all(axis=1)]
    # drop pivot-style "Total" lines that sometimes come with pasted extracts
    first = df.columns[0]
    df = df[~df[first].astype(str).str.strip().str.lower().isin(["grand total", "total"])]
    return df.reset_index(drop=True)


def _match_section(sheet: str, fname: str):
    s = normalize_header(sheet)
    f = normalize_header(re.sub(r"\.(xlsx|xlsm|xls|csv)$", "", fname, flags=re.I))
    for sec in SECTIONS:
        names = [normalize_header(x) for x in sec["sheets"]]
        if s in names:
            return sec
    for sec in SECTIONS:  # single-sheet file named after the section
        names = [normalize_header(x) for x in sec["sheets"]]
        if any(n and n == f for n in names):
            return sec
    return None


# ----------------------------------------------------------------------------- transforms
def norm_subzone(v) -> str:
    t = clean_text(v)
    return SUBZONE_ALIASES.get(normalize_header(t), t)


def t_msme(v) -> str:
    u = clean_text(v, "").upper()
    if "NON" in u or "NOT MSME" in u:
        return "NON-MSME"
    if u in ("", "NA", "N/A", "NONE", "-", "#N/A", "UNCLASSIFIED"):
        return "NA"
    if any(k in u for k in ("MSME", "MICRO", "SMALL", "MEDIUM")) or u == "YES":
        return "MSME"
    return u


def t_vit_age(v) -> str:
    raw = clean_text(v)
    c = re.sub(r"\s+", "", raw.upper()).replace("–", "-").replace("—", "-")
    for pats, lbl in [((">6", "ABOVE6", "MORETHAN6", "OVER6", "180+", ">180"), "> 6 months"),
                      (("90-180", "91-180", "90TO180"), "90-180 days"),
                      (("45-90", "46-90", "45TO90"), "45-90 days"),
                      (("30-45", "31-45", "30TO45"), "30-45 days"),
                      (("0-30", "0TO30"), "0-30 days")]:
        if any(p in c for p in pats):
            return lbl
    return raw


TRANSFORMS = {"msme": t_msme, "vit_age": t_vit_age, "upper": lambda v: clean_text(v).upper()}


def _fy(d) -> str:
    if d is None or pd.isna(d):
        return "Unclassified"
    s = d.year if d.month >= 4 else d.year - 1
    return f"{s}-{(s + 1) % 100:02d}"


def _quarter(d) -> str:
    if d is None or pd.isna(d):
        return "Unclassified"
    s = d.year if d.month >= 4 else d.year - 1
    return f"Q{(d.month - 4) % 12 // 3 + 1} FY {s}-{(s + 1) % 100:02d}"


def _bucket(n, bins):
    if n is None or pd.isna(n):
        return "Unclassified"
    for upper, label in bins:
        if upper is None or n < upper:
            return label
    return bins[-1][1]


# ----------------------------------------------------------------------------- normalise
def normalize_section(sec, df: pd.DataFrame, asof: date) -> tuple[pd.DataFrame, dict]:
    """Return (canonical frame, mapping field->source column)."""
    norm_cols = {}
    for c in df.columns:
        norm_cols.setdefault(normalize_header(c), c)
    mapping = {}
    out = pd.DataFrame(index=df.index)
    for field, aliases in sec["fields"].items():
        col = next((norm_cols[normalize_header(a)] for a in aliases if normalize_header(a) in norm_cols), None)
        mapping[field] = col
        src = df[col] if col is not None else pd.Series([""] * len(df), index=df.index, dtype=object)
        if field in AMOUNT_FIELDS or field in NUM_FIELDS:
            out[field] = src.map(parse_amount)
        elif field in DATE_FIELDS:
            cache = {}
            for v in src:
                k = v if isinstance(v, (str, int, float)) or v is None else str(v)
                if k not in cache:
                    cache[k] = parse_date_any(v)
            out[field] = pd.to_datetime(pd.Series([cache[v if isinstance(v, (str, int, float)) or v is None else str(v)]
                                                   for v in src], index=src.index), errors="coerce")
        elif field == "subzone":
            out[field] = src.map(norm_subzone)
        else:
            fn = TRANSFORMS.get(sec.get("transforms", {}).get(field))
            out[field] = src.map(fn) if fn else src.map(lambda v: clean_text(v))

    asof_ts = pd.Timestamp(asof)
    for field, rule in sec.get("derive", {}).items():
        have = field in out and mapping.get(field) and (out[field] != "Unclassified").any()
        if have:
            continue
        kind = rule[0]
        if kind == "fy_from":
            out[field] = out[rule[1]].map(_fy)
        elif kind == "quarter_from":
            out[field] = out[rule[1]].map(_quarter)
        elif kind == "year_from":
            out[field] = out[rule[1]].map(lambda d: "Unclassified" if pd.isna(d) else str(d.year))
        elif kind == "month_from":
            out[field] = out[rule[1]].map(lambda d: "Unclassified" if pd.isna(d) else d.strftime("%b %y"))
        elif kind == "date_text":
            out[field] = out[rule[1]].map(lambda d: "" if pd.isna(d) else d.strftime("%d-%b-%y"))
        elif kind == "days_bucket":
            days = out[rule[1]] if mapping.get(rule[1]) else (asof_ts - out[rule[2]]).dt.days
            out[field] = days.map(lambda n: _bucket(n, rule[3]))
        elif kind == "years_bucket":
            yrs = (asof_ts - out[rule[1]]).dt.days / 365.25
            out[field] = yrs.map(lambda n: _bucket(n, rule[2]))
    if "open_cwip" in out and not mapping.get("open_cwip") and mapping.get("cum_exp"):
        out["open_cwip"] = out["cum_exp"] - out["cum_capex"]
    out["__id"] = range(len(out))
    return out.reset_index(drop=True), mapping


def load_files(files: list[tuple[bytes, str]], asof: date) -> dict:
    """{section_key: {"df", "raw", "sheet", "mapping"}} for every section found in the uploaded files."""
    found = {}
    for data, name in files:
        for sheet, raw in read_any(data, name).items():
            sec = _match_section(sheet, name)
            if sec is None or sec["key"] in found:
                continue
            frame = _frame(raw, _all_aliases(sec))
            if frame.empty:
                continue
            df, mapping = normalize_section(sec, frame, asof)
            found[sec["key"]] = {"df": df, "raw": frame, "sheet": f"{name} › {sheet}", "mapping": mapping}
    return found


# ----------------------------------------------------------------------------- ordering
def order_key(label: str):
    s = str(label).strip()
    u = s.upper()
    if u in ("UNCLASSIFIED", ""):
        return (9, 0, 0, s)
    m = re.match(r"Q(\d)\s*FY\s*(\d{4})", u)
    if m:
        return (1, int(m.group(2)), int(m.group(1)), s)
    m = re.search(r"(?:UPTO|UP TO|TILL)\s+([A-Z]{3})[A-Z]*[\s\-']*(\d{2,4})", u)
    if m and m.group(1).lower() in MONTHS:
        y = int(m.group(2)); y = y + 2000 if y < 100 else y
        return (1, y - 1, MONTHS.index(m.group(1).lower()) + 1, s)
    m = re.search(r"\b([A-Z]{3})[A-Z]*[\s\-']*(\d{2,4})\b", u)
    if m and m.group(1).lower() in MONTHS:
        y = int(m.group(2)); y = y + 2000 if y < 100 else y
        return (1, y, MONTHS.index(m.group(1).lower()) + 1, s)
    m = re.match(r"(\d{4})\s*-\s*(\d{2,4})$", u)
    if m:
        return (1, int(m.group(1)), 4, s)
    m = re.match(r"^(\d{4})$", u)
    if m:
        return (1, int(m.group(1)), 0, s)
    m = re.match(r"^[<>]?\s*(\d+)", u)
    if m:
        return (1, int(m.group(1)) + (0.5 if u.startswith(">") else 0), 0, s)
    return (2, 0, 0, s.lower())


def order_buckets(values, preferred: list[str], direction: str = "asc") -> list[str]:
    vals = list(dict.fromkeys(values))
    pref_norm = {normalize_header(p): i for i, p in enumerate(preferred)}
    first = sorted([v for v in vals if normalize_header(v) in pref_norm], key=lambda v: pref_norm[normalize_header(v)])
    rest = sorted([v for v in vals if normalize_header(v) not in pref_norm and v != "Unclassified"], key=order_key,
                  reverse=(direction == "desc"))
    tail = [v for v in vals if v == "Unclassified"]
    if direction == "desc" and not preferred:
        return rest + tail
    return first + rest + tail


# ----------------------------------------------------------------------------- formatting
UNIT = {"rupees": 1.0, "lakhs": 1e5, "crores": 1e7}


def to_display(v, sec) -> float:
    return float(v or 0) * UNIT[sec.get("amount_source", "rupees")] / UNIT[sec.get("amount_display", "rupees")]


def fmt_metric(kind: str, v, sec) -> str:
    if kind == "count":
        return indian_int(v) if v else ""
    d = to_display(v, sec)
    if sec.get("amount_display", "rupees") == "rupees":
        return indian_int(d)
    return indian_2dp(d)


def smart_rupees(rupees: float) -> str:
    if abs(rupees) >= 1e7:
        return f"₹{indian_2dp(rupees / 1e7)} Cr"
    if abs(rupees) >= 1e5:
        return f"₹{indian_2dp(rupees / 1e5)} L"
    return f"₹{indian_int(rupees)}"


# ----------------------------------------------------------------------------- pivot model
def build_pivot(df: pd.DataFrame, sec) -> dict:
    """Generic pivot model used by the renderer (rows, buckets, subtotals, totals, ids per cell)."""
    rows_f = [r[0] for r in sec["rows"]]
    col = sec.get("column")
    metrics = sec["metrics"]
    has_amount = any(m[0] == "sum" for m in metrics)
    if col:
        buckets = order_buckets(df[col[0]].unique(), col[1], col[2])
    else:
        buckets = []

    def agg(g):
        return {"count": len(g), "sum": float(g["amount"].sum()) if has_amount else 0.0, "ids": g["__id"].tolist()}

    leaves = []
    for keys, g in df.groupby(rows_f, sort=False, dropna=False):
        keys = keys if isinstance(keys, tuple) else (keys,)
        cells = {b: agg(gb) for b, gb in g.groupby(col[0], sort=False)} if col else {}
        leaves.append({"keys": tuple(str(k) for k in keys), "cells": cells, "total": agg(g)})
    leaves.sort(key=lambda r: tuple(order_key(k) for k in r["keys"]))

    def total_of(sub_df):
        cells = {b: agg(gb) for b, gb in sub_df.groupby(col[0], sort=False)} if col else {}
        return {"cells": cells, "total": agg(sub_df)}

    subtotals = {}
    if len(rows_f) > 1:
        for k, g in df.groupby(rows_f[0], sort=False):
            subtotals[str(k)] = total_of(g)
    return {"rows_f": rows_f, "buckets": buckets, "leaves": leaves, "subtotals": subtotals,
            "grand": total_of(df), "metrics": metrics}


def section_stats(df: pd.DataFrame, sec) -> tuple[int, float | None]:
    """(item count, value in rupees or None) for the overview cards."""
    if sec.get("type") == "summary":
        pend = (df["total"] - df["verified"]).clip(lower=0).sum() if len(df) else 0
        return int(pend), None
    if sec.get("type") == "listing":
        return len(df), float(df["open_cwip"].sum()) * 1e7 if len(df) else 0.0
    if "amount" in df and any(m[0] == "sum" for m in sec.get("metrics", [])):
        return len(df), float(df["amount"].sum()) * UNIT[sec.get("amount_source", "rupees")]
    return len(df), None
