"""Derived and drafted Form 35 fields.

Values here are computed from extracted data (appeal section, fee, delay) or
are first drafts for the CA to edit (facts, grounds, condonation). Everything
drafted is tagged so the GUI highlights it for review.
"""
import os
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional

from data_models import AppealData
from extractor import (DOC_CLIENT_COMP, DOC_COMPUTATION, DOC_DEMAND, DOC_ORDER,
                       indian_format, to_int)

SRC_DERIVED = "Derived - verify"
SRC_DRAFT = "Drafted - review & edit"
SRC_DEFAULT = "Default - verify"

APPEAL_LIMIT_DAYS = 30


def parse_date(s: str) -> Optional[date]:
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime((s or "").strip(), fmt).date()
        except ValueError:
            pass
    return None


def fmt_date(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def appeal_section_for(order_section: str) -> str:
    s = (order_section or "").replace(" ", "")
    if re.match(r"^(143\(3\)|144|147|150|153A|153C|92CA|115WE\(3\)|115WF|115WG)", s):
        return "246A(1)(a)"
    if s.startswith("143(1)"):
        return "246A(1)(a)"
    if s.startswith("154") or s.startswith("155"):
        return "246A(1)(a) - verify for rectification orders"
    if s.startswith("201"):
        return "246A(1)(ha)"
    if s.startswith("270A") or s.startswith("271") or s.startswith("272"):
        return "246A(1)(q)"
    return ""


def appeal_fee_amount(income_assessed: str, penalty_or_other: bool = False) -> int:
    """Rule 45(3) / section 249(1) fee slabs."""
    if penalty_or_other:
        return 250
    inc = to_int(income_assessed)
    if inc is None or inc <= 100000:
        return 250
    if inc <= 200000:
        return 500
    return 1000


def _rs(v: str) -> str:
    return f"Rs. {v}/-" if v else "Rs. ____/-"


def additions(data: AppealData) -> List[tuple]:
    out = []
    for line in data.get("addition_details").splitlines():
        if "|" in line:
            desc, amt = line.rsplit("|", 1)
            desc = re.sub(r"^Variation in respect of\s*", "", desc.strip(), flags=re.I)
            desc = re.sub(r"^U/s\b", "Variation u/s", desc)
            out.append((desc.strip(), amt.strip()))
    return out


# --------------------------------------------------------------- drafting

def draft_facts(data: AppealData, hints: Dict[str, str]) -> str:
    flags = set(filter(None, hints.get("_flags", "").split(",")))
    name = data.assessee_name or "the Appellant"
    status = (data.get("assessee_status") or "assessee").lower()
    nature = data.get("nature_of_business")
    paras = []

    p = f"The Appellant, {name} (PAN {data.get('pan') or '__________'}), is an {status}"
    if nature and re.search(r"(or|er|ant|ist|man)$", nature.strip(), re.I):
        p += f" carrying on business as a {nature.lower()}."    # e.g. "Works Contractor"
    elif nature:
        p += f" engaged in the business of {nature.lower()}."
    else:
        p += "."
    paras.append(p)

    p = (f"For Assessment Year {data.get('assessment_year') or '____'}, the Appellant filed the return of income on "
         f"{data.get('return_filing_date') or '__/__/____'}"
         + (f" (Acknowledgement No. {data.get('return_ack_no')})" if data.get("return_ack_no") else "")
         + f" declaring total income of {_rs(data.get('returned_income'))}")
    if "44AD" in flags:
        gr = hints.get("_gross_receipts")
        p += (", offering business income on presumptive basis u/s 44AD"
              + (f" on gross receipts of {_rs(gr)}" if gr else ""))
    paras.append(p + ".")

    paras.append("[CONFIRM: describe notices actually issued, their service, replies filed and hearing opportunities from the record.]")

    adds = additions(data)
    p = (f"The assessment was completed u/s {data.get('order_section') or '____'} vide order dated "
         f"{data.get('order_date') or '__/__/____'}"
         + (f" (DIN {data.get('order_din')})" if data.get("order_din") else "")
         + f", determining total income at {_rs(data.get('income_assessed'))}")
    if adds:
        p += ", after making the following addition(s): " + "; ".join(f"{d} - {_rs(a)}" for d, a in adds)
    p += "."
    paras.append(p)

    p = f"Consequently, a notice of demand u/s 156 raising demand of {_rs(data.get('disputed_demand'))} was issued"
    if data.get("interest_charged"):
        p += f", including interest ({data.get('interest_charged')})"
    p += "."
    paras.append(p)

    paras.append("Being aggrieved by the said order, the Appellant prefers this appeal on the grounds stated herein.")
    return "\n\n".join(f"{i}. {t}" for i, t in enumerate(paras, 1))


def draft_grounds(data: AppealData, hints: Dict[str, str]) -> str:
    flags = set(filter(None, hints.get("_flags", "").split(",")))
    lead = "On the facts and in the circumstances of the case and in law,"
    g: List[str] = []

    # Keywords are review hints, not proof of legal or factual conclusions.
    adds = additions(data)
    for desc, amt in adds:
        g.append(f"{lead} the learned Assessing Officer erred in making an addition of {_rs(amt)} on account of "
                 f"'{desc}' without appreciating the facts and evidence on record; the addition deserves to be deleted.")

    if data.get("interest_charged"):
        secs = "/".join(re.findall(r"(234[A-D])", data.get("interest_charged")))
        g.append(f"{lead} the learned Assessing Officer erred in charging interest u/s {secs}. The levy of interest "
                 "is consequential and the Appellant denies liability for the same.")
    if not g:
        g.append("[CONFIRM: insert case-specific grounds supported by the order and record.]")

    g.append("The Appellant craves leave to add, alter, amend, modify or withdraw any of the above grounds "
             "on or before the hearing of the appeal.")
    return "\n\n".join(f"{i}. {t}" for i, t in enumerate(g, 1))


def draft_documents(docs) -> str:
    labels = {
        DOC_ORDER: "Copy of assessment order",
        DOC_COMPUTATION: "Copy of computation sheet issued with the order",
        DOC_DEMAND: "Copy of notice of demand u/s 156",
        DOC_CLIENT_COMP: "Computation of total income filed with the return",
    }
    items = [labels.get(d.doc_type, os.path.basename(d.path)) for d in docs]
    seen, out = set(), []
    for it in items:
        if it not in seen:
            seen.add(it)
            out.append(it)
    return "\n".join(f"{i}. {t}" for i, t in enumerate(out, 1))


def draft_condonation(data: AppealData) -> str:
    served = parse_date(data.get("service_date"))
    filed = parse_date(data.get("verification_date")) or datetime.now(ZoneInfo("Asia/Kolkata")).date()
    if not served:
        return ""
    due = served + timedelta(days=APPEAL_LIMIT_DAYS)
    days = (filed - due).days
    return (f"The order dated {data.get('order_date')} was served on {fmt_date(served)}. "
            f"Using the prototype's {APPEAL_LIMIT_DAYS}-day calculation, the due date is {fmt_date(due)} "
            f"and intended filing on {fmt_date(filed)} results in {days} days of delay. "
            "[CONFIRM: replace this paragraph with the actual reasons, chronology, supporting evidence "
            "and professionally verified legal basis for condonation.]")



def compute_delay(data: AppealData) -> Optional[int]:
    served = parse_date(data.get("service_date"))
    if not served:
        return None
    filed = parse_date(data.get("verification_date")) or datetime.now(ZoneInfo("Asia/Kolkata")).date()
    return (filed - (served + timedelta(days=APPEAL_LIMIT_DAYS))).days


# ------------------------------------------------------------------ apply

def apply_drafts(data: AppealData, hints: Dict[str, str], docs=(), overwrite: bool = False,
                 today: Optional[date] = None) -> None:
    """Fill derived/drafted fields. Without overwrite, only empty fields are touched."""
    today = today or datetime.now(ZoneInfo("Asia/Kolkata")).date()

    def put(key, value, src):
        if value and (overwrite or not data.get(key).strip()):
            data.set(key, value, src)

    # Actual service must be entered by the reviewer; do not infer it from issue dates.

    sec = data.get("order_section")
    authority = "Assessment Unit, Income Tax Department"
    if "144B" in sec:
        authority += " (Faceless Assessment)"
    if data.get("ward"):
        authority += f"; jurisdictional AO: {data.get('ward')}"
    put("authority", authority, SRC_DERIVED)
    put("appeal_section", appeal_section_for(sec), SRC_DERIVED)

    put("disputed_addition", data.get("total_addition"), SRC_DERIVED)
    put("loss_disallowance", "Nil", SRC_DEFAULT)
    put("penalty_amount", "Nil", SRC_DEFAULT)
    put("penalty_disputed", "Nil", SRC_DEFAULT)

    if data.get("return_ack_no"):
        put("advance_tax_249", "Not applicable", SRC_DERIVED)
    put("tax_195", "Not applicable", SRC_DEFAULT)
    put("country", "India" if data.get("state") else "", SRC_DEFAULT)

    put("statement_of_facts", draft_facts(data, hints), SRC_DRAFT)
    put("grounds_of_appeal", draft_grounds(data, hints), SRC_DRAFT)
    if docs:
        put("documents_relied", draft_documents(docs), SRC_DRAFT)

    fee = appeal_fee_amount(data.get("income_assessed"))
    put("appeal_fee", f"Rs. {indian_format(fee)}/- ; BSR code: _______ ; Date: __/__/____ ; Challan serial no.: _____",
        SRC_DERIVED)

    addr_parts = [data.get(k) for k in ("flat_door", "road_street", "premises", "area", "city")]
    addr = ", ".join(p for p in addr_parts if p)
    tail = " - ".join(p for p in (data.get("state"), data.get("pincode")) if p)
    if addr:
        put("service_address", addr + (f", {tail}" if tail else "")
            + (f"\nE-mail: {data.get('email')}" if data.get("email") else ""), SRC_DERIVED)

    put("verifier_name", data.assessee_name, SRC_DERIVED)
    put("place", data.get("city"), SRC_DERIVED)
    put("verification_date", fmt_date(today), SRC_DEFAULT)

    delay = compute_delay(data)
    if delay is not None:
        put("delay", "Yes" if delay > 0 else "No", SRC_DERIVED)
        if delay > 0:
            put("condonation_grounds", draft_condonation(data), SRC_DRAFT)
