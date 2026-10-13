"""Extract Form 35 data from Income-tax Department PDFs (ITBA formats).

Supported document types (auto-detected from text):
  * Assessment order (u/s 143(3) / 144 / 147 ... with or without 144B)
  * Computation sheet issued with the order
  * Notice of demand u/s 156
  * Client's own tax computation (e.g. TaxbasePRO / Computax style)

Every extractor returns {field_key: value}. Documents are merged in priority
order so the assessment order wins over secondary documents.
"""
import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import pymupdf

from data_models import AppealData

PAN_RE = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b")
DATE_RE = r"(\d{2}[/.-]\d{2}[/.-]\d{4})"
AMOUNT_LINE_RE = re.compile(r"^-?[\d,]+$")

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Orissa", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

DOC_ORDER = "Assessment order"
DOC_COMPUTATION = "Computation sheet"
DOC_DEMAND = "Demand notice u/s 156"
DOC_CLIENT_COMP = "Client computation"
DOC_UNKNOWN = "Unrecognised document"

# Lower number = higher priority when two documents supply the same field.
DOC_PRIORITY = {DOC_ORDER: 0, DOC_COMPUTATION: 1, DOC_DEMAND: 2, DOC_CLIENT_COMP: 3, DOC_UNKNOWN: 4}


@dataclass
class ExtractedDoc:
    path: str
    doc_type: str
    text: str
    values: Dict[str, str] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    @property
    def name(self) -> str:
        return os.path.basename(self.path)


# ----------------------------------------------------------------- helpers

def read_pdf_text(path: str) -> str:
    with pymupdf.open(path) as doc:
        return "\n".join(f"[PAGE {i + 1}]\n{page.get_text()}" for i, page in enumerate(doc))


def squash(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def clean_amount(raw: str) -> str:
    """'Rs.11,48,714/-' -> '11,48,714' (Indian grouping, sign preserved)."""
    if not raw:
        return ""
    s = raw.replace("Rs.", "").replace("Rs", "").replace("/-", "").replace(" ", "")
    neg = s.startswith("-")
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return ""
    return ("-" if neg else "") + indian_format(int(digits))


def to_int(amount: str) -> Optional[int]:
    if not amount:
        return None
    s = amount.strip()
    if s.lower() in ("nil", "na", "n.a."):
        return 0
    neg = s.startswith("-")
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return None
    return -int(digits) if neg else int(digits)


def indian_format(n: int) -> str:
    neg = n < 0
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d{2})+$)", r"\1,", head)
        s = f"{head},{tail}"
    return ("-" if neg else "") + s


def norm_date(d: str) -> str:
    return re.sub(r"[.-]", "/", d.strip()) if d else ""


def norm_ay(ay: str) -> str:
    """'2024-2025' / '2024-25' -> '2024-25'."""
    m = re.match(r"(\d{4})\s*-\s*(\d{2,4})", ay or "")
    if not m:
        return ay or ""
    return f"{m.group(1)}-{m.group(2)[-2:]}"


def first(pattern: str, text: str, flags: int = 0, group: int = 1) -> str:
    m = re.search(pattern, text, flags)
    return m.group(group).strip() if m else ""


def amount_after_label(text: str, label_pattern: str, max_lines: int = 4) -> str:
    """Find the line matching label_pattern and return the first pure-number
    line that follows it (ITBA PDFs put label and value on separate lines)."""
    lines = [ln.strip() for ln in text.splitlines()]
    rx = re.compile(label_pattern, re.I)
    for i, ln in enumerate(lines):
        if rx.search(ln):
            for nxt in lines[i + 1:i + 1 + max_lines]:
                if AMOUNT_LINE_RE.match(nxt):
                    return clean_amount(nxt)
    return ""


def split_name(full: str, pan: str) -> Tuple[str, str, str]:
    full = squash(full)
    # 4th character of PAN: P = individual. Everyone else is an entity -> whole name in last name.
    is_individual = len(pan) == 10 and pan[3] == "P"
    parts = full.split()
    if not is_individual and pan:
        return "", "", full
    if len(parts) == 1:
        return "", "", parts[0]
    if len(parts) == 2:
        return parts[0], "", parts[1]
    return parts[0], " ".join(parts[1:-1]), parts[-1]


def parse_address(raw: str) -> Dict[str, str]:
    """Split an ITBA address block into Form 35 address fields."""
    out = {}
    segs = [squash(s) for s in re.split(r"[,\n]", raw or "")]
    segs = [s for s in segs if s]
    if not segs:
        return out

    if segs and segs[-1].lower() == "india":
        out["country"] = "India"
        segs.pop()

    for i, s in enumerate(segs):
        for st in INDIAN_STATES:
            if s.lower() == st.lower():
                out["state"] = st
                segs.pop(i)
                break
        if "state" in out:
            break

    for i, s in enumerate(segs):
        m = re.search(r"\b(\d{6})\b", s)
        if m:
            out["pincode"] = m.group(1)
            city = squash(s.replace(m.group(1), "").strip(" -"))
            # "Dhule 424001 Maharashtra" style - peel the state off the city segment
            for st in INDIAN_STATES:
                if city.lower().endswith(st.lower()):
                    out.setdefault("state", st)
                    city = squash(city[: -len(st)])
            if city:
                out["city"] = city
            segs.pop(i)
            break

    if segs:
        m = re.match(r"^([\w/-]*\d[\w/-]*)\s+(.+)$", segs[0])
        if m:
            out["flat_door"] = m.group(1)
            out["road_street"] = m.group(2)
            segs = segs[1:]
    if len(segs) >= 2:
        out["premises"] = segs[0]
        out["area"] = ", ".join(segs[1:])
    elif len(segs) == 1:
        out["area"] = segs[0]
    if "country" not in out and "state" in out:
        out["country"] = "India"
    return out


def classify(text: str) -> str:
    t = text.lower()
    if "notice of demand under section 156" in t:
        return DOC_DEMAND
    if "computation sheet" in t and "reporting heads" in t:
        return DOC_COMPUTATION
    if "assessment order" in t or "order passed under section" in t or "table of variations" in t:
        return DOC_ORDER
    if "computation of total income" in t or "prev. yr" in t:
        return DOC_CLIENT_COMP
    return DOC_UNKNOWN


# ----------------------------------------------------------- per-doc parsers

def extract_order(text: str) -> Dict[str, str]:
    v: Dict[str, str] = {}
    v["pan"] = first(r"\bPAN\s*\n\s*([A-Z]{5}\d{4}[A-Z])", text) or first(PAN_RE.pattern, text)
    v["_name"] = squash(first(r"Name of the assessee\s*\n(.+)", text))
    v["_address"] = first(r"Address of the assessee\s*\n(.*?)\n\s*\d+\.\s*\n", text, re.S)
    v["assessment_year"] = norm_ay(first(r"Assessment Year\s*\n\s*(\d{4}\s*-\s*\d{2,4})", text))
    v["assessee_status"] = first(r"(?<!Residential )\bStatus\s*\n\s*([A-Z][A-Z .()&-]+)\n", text)
    v["return_filing_date"] = norm_date(first(r"Date of filing of Return of Income\s*\n\s*" + DATE_RE, text))
    v["return_ack_no"] = first(r"Acknowledgement Number of Return of\s*\n?\s*Income\s*\n\s*(\d{9,})", text)

    sec = first(r"Order passed under section\s*\n(.*?)\n\s*\d+\.\s*\n", text, re.S)
    sec = re.sub(r"\s*of the Income[-\s]*tax Act.*$", "", squash(sec), flags=re.I)
    v["order_section"] = sec

    v["returned_income"] = clean_amount(first(r"Returned Income\s*\n\s*(Rs\.?\s*[\d,]+)", text))
    v["order_date"] = norm_date(first(r"Date of Order\s*\n\s*" + DATE_RE, text))
    v["order_din"] = first(r"\bDIN\s*\n\s*(ITBA/\S+)", text)

    # The final "Assessed u/s ... at an income of" line wins over intermediate figures in the body.
    assessed = (first(r"Assessed\s+u/s[^.]*?at an income of\s*Rs\.?\s*([\d,]+)", text, re.I | re.S)
                or first(r"Round(?:ed)? off to\s*Rs\.?\s*([\d,]+)", text, re.I)
                or first(r"Total Income/Loss determined.*?Rs\.?\s*([\d,]+)", text, re.S | re.I))
    v["income_assessed"] = clean_amount(assessed)

    # Table of variations: "Variation in respect of <x>\nRs.11,48,714/-"
    variations = re.findall(r"(Variation in respect of[^\n]*?)\s*\n\s*Rs\.?\s*([\d,]+)", text, re.I)
    if not variations:
        variations = [(f"Addition", a) for a in re.findall(r"Addition of Rs\.?\s*([\d,]+)", text, re.I)[:1]]
    if variations:
        total = sum(to_int(a) or 0 for _, a in variations)
        v["total_addition"] = indian_format(total)
        v["addition_details"] = "\n".join(f"{squash(d)} | {clean_amount(a)}" for d, a in variations)

    v["_gross_receipts"] = clean_amount(first(r"receipts\s+(?:aggregating\s+to|of)\s+Rs\.?\s*([\d,]+)", text, re.I))
    v["_selection"] = "CASS" if re.search(r"\bCASS\b", text) else ""

    pens = []
    if re.search(r"270A", text):
        kind = first(r"270A[^\n(]*\(([^)]*)\)", text) or "under-reporting / mis-reporting"
        pens.append(f"u/s 270A ({kind})")
    if re.search(r"272A\(1\)\(d\)", text):
        pens.append("u/s 272A(1)(d)")
    if re.search(r"271AAC", text):
        pens.append("u/s 271AAC")
    if pens:
        v["penalty_initiated"] = " and ".join(pens)

    v["_flags"] = ",".join(k for k, rx in {
        "44ADA": r"44ADA",
        "44AD": r"44AD\b",
        "194J": r"194J",
        "NONCOMPLIANCE": r"not furnished|non-compliance|Not Received|no reply",
        "ADJOURNMENT": r"adjournment",
        "144B": r"144B",
        "CASS": r"CASS",
        "68": r"section 68\b|u/s 68\b",
        "69A": r"69A",
        "115BBE": r"115BBE",
    }.items() if re.search(rx, text, re.I))
    return v


def extract_computation_sheet(text: str) -> Dict[str, str]:
    v: Dict[str, str] = {}
    v["pan"] = first(r"\bPAN\s*\n\s*([A-Z]{5}\d{4}[A-Z])", text)
    v["assessment_year"] = norm_ay(first(r"Assessment Year\s*\n\s*(\d{4}\s*-\s*\d{2,4})", text))
    v["_name"] = squash(first(r"\nName\s*\n(.*?)\nAddress", text, re.S))
    v["_address"] = first(r"\nAddress\s*\n(.*?)\n\s*Residential", text, re.S)
    v["order_section"] = squash(first(r"Order Section\s*\n(.+)", text))
    v["order_date"] = norm_date(first(r"Order Date\s*\n\s*" + DATE_RE, text))
    v["income_assessed"] = amount_after_label(text, r"^TOTAL INCOME AFTER DEDUCTIONS")
    v["tds_credit"] = amount_after_label(text, r"^TDS$")
    v["total_tax_paid"] = amount_after_label(text, r"^TOTAL TAXES PAID")
    v["disputed_demand"] = amount_after_label(text, r"^AMOUNT PAYABLE/\s*REFUNDABLE\s*$")

    interest = []
    for sec, label in (("234A", r"SECTION 234A"), ("234B", r"SECTION 234 ?B"),
                       ("234C", r"SECTION 234C"), ("234D", r"INTEREST U/S 234D")):
        amt = amount_after_label(text, label)
        if amt and to_int(amt):
            interest.append(f"{sec}: {amt}")
    if interest:
        v["interest_charged"] = "; ".join(interest)
    return v


def extract_demand_notice(text: str) -> Dict[str, str]:
    v: Dict[str, str] = {}
    v["pan"] = first(r"PAN:\s*\n?\s*([A-Z]{5}\d{4}[A-Z])", text)
    v["assessment_year"] = norm_ay(first(r"assessment year\s+(\d{4}\s*-\s*\d{2,4})", text, re.I))
    v["disputed_demand"] = clean_amount(first(r"a sum of\s*Rs\.?\s*([\d,]+)", text, re.I))
    v["demand_notice_din"] = squash(first(r"DIN & Notice No:\s*\n(.*?/\d+\(\d+\))", text, re.S)).replace(" ", "")
    v["_demand_date"] = norm_date(first(r"Date:\s*\n?\s*" + DATE_RE, text))
    block = first(r"To,\s*\n(.*?)\n\s*PAN:", text, re.S)
    lines = [squash(l) for l in block.splitlines() if squash(l)]
    if lines:
        v["_name"] = lines[0]
        v["_address"] = "\n".join(lines[1:])
    v["assessee_status"] = first(r"Status:\s*\n\s*([A-Z][A-Z ]+)", text)
    if re.search(r"NATIONAL FACELESS APPEAL CENTRE", text, re.I):
        v["_nfac"] = "1"
    return v


def extract_client_computation(text: str) -> Dict[str, str]:
    v: Dict[str, str] = {}
    v["pan"] = first(r"PAN(?:/GIR)?\s*:\s*([A-Z]{5}\d{4}[A-Z])", text)
    v["assessment_year"] = norm_ay(first(r"A\.Y\.\s*:\s*(\d{4}\s*-\s*\d{2,4})", text))
    v["ward"] = squash(first(r"Ward\s*:\s*(.+)", text)).title()
    v["nature_of_business"] = squash(first(r"Nature of Bus(?:iness|\.)\s*:\s*(.+)", text))
    v["phone"] = first(r"Mobile(?: No\.?)?\s*:\s*(\+?\d[\d -]{8,})", text).replace(" ", "")
    v["email"] = first(r"E-?mail(?: ID)?\s*:\s*(\S+@\S+)", text, re.I)
    v["assessee_status"] = squash(first(r"Status\s*:\s*([A-Za-z ]+?)(?:\s*-|\n)", text)).upper()
    v["_name"] = squash(first(r"NAME\s*:\s*(.+?)\s*\(", text)) or squash(text.splitlines()[0] if text else "")
    # Tax on returned income fully covered by prepaid taxes when the computation ends in a refund
    if re.search(r"^\s*Refund\s*$", text, re.M):
        v["tax_paid_in_full"] = "Yes"
    return v


PARSERS = {
    DOC_ORDER: extract_order,
    DOC_COMPUTATION: extract_computation_sheet,
    DOC_DEMAND: extract_demand_notice,
    DOC_CLIENT_COMP: extract_client_computation,
}


def extract_document(path: str) -> ExtractedDoc:
    text = read_pdf_text(path)
    if len(text.strip()) < 50:
        d = ExtractedDoc(path, DOC_UNKNOWN, text)
        d.warnings.append("No text layer found - this looks like a scanned PDF. Enter data manually or OCR it first.")
        return d
    doc_type = classify(text)
    d = ExtractedDoc(path, doc_type, text)
    parser = PARSERS.get(doc_type)
    if parser:
        d.values = {k: v for k, v in parser(text).items() if v}
    else:
        # Best effort: at least pick up PAN and AY.
        pan = first(PAN_RE.pattern, text)
        ay = norm_ay(first(r"(?:A\.Y\.|Assessment Year)\s*:?\s*(\d{4}\s*-\s*\d{2,4})", text, re.I))
        d.values = {k: v for k, v in (("pan", pan), ("assessment_year", ay)) if v}
        d.warnings.append("Document type not recognised - only PAN / AY were read.")
    return d


# ------------------------------------------------------------------ merging

def merge(docs: List[ExtractedDoc]) -> Tuple[AppealData, List[str], Dict[str, str]]:
    """Merge docs into AppealData. Returns (data, log messages, internal hints)."""
    data = AppealData()
    log: List[str] = []
    hints: Dict[str, str] = {}
    ordered = sorted(docs, key=lambda d: DOC_PRIORITY.get(d.doc_type, 9))

    for d in ordered:
        for k, val in d.values.items():
            if k.startswith("_"):
                if k == "_flags":
                    hints["_flags"] = ",".join(filter(None, [hints.get("_flags", ""), val]))
                else:
                    hints.setdefault(k, val)
                    hints.setdefault(k + "_src", d.name)
                continue
            if not data.get(k):
                data.set(k, val, d.name)

    # cross-check PAN / AY across documents
    for key in ("pan", "assessment_year"):
        seen = {d.values.get(key) for d in docs if d.values.get(key)}
        if len(seen) > 1:
            log.append(f"WARNING: {key.upper()} differs across documents: {', '.join(sorted(seen))}")

    pan = data.get("pan")
    if hints.get("_name"):
        fn, mn, ln = split_name(hints["_name"], pan)
        src = hints["_name_src"]
        for k, val in (("first_name", fn), ("middle_name", mn), ("last_name", ln)):
            if val:
                data.set(k, val, src)
    if hints.get("_address"):
        for k, val in parse_address(hints["_address"]).items():
            if not data.get(k):
                data.set(k, val, hints["_address_src"])

    for d in docs:
        log.append(f"{d.name}: {d.doc_type} - {len([k for k in d.values if not k.startswith('_')])} values read")
        log.extend(f"  ! {w}" for w in d.warnings)
    data.source_pdf_paths = [d.path for d in docs]
    return data, log, hints
