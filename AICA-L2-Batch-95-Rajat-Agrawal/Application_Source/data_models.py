"""Data model for Form No. 35 (Rule 45) - Appeal before CIT(A) / JCIT(A) / NFAC.

FIELDS is the single source of truth: the GUI builds its tabs from it and the
PDF exporter prints rows in this order.
"""
from dataclasses import dataclass, field, fields as dc_fields, asdict
from typing import Dict, List, Optional

YES_NO = ["", "Yes", "No"]
YES_NO_NA = ["", "Yes", "No", "Not applicable"]


@dataclass(frozen=True)
class FieldSpec:
    key: str
    label: str
    section: str
    row: str = ""                 # Form 35 row number, e.g. "2a"
    kind: str = "text"            # text | multiline | choice
    choices: Optional[List[str]] = None
    required: bool = False
    printed: bool = True          # False = reference only, not printed on Form 35


SECTIONS = [
    "Personal information",
    "Order against which appeal is filed",
    "Appeal details",
    "Taxes paid",
    "Statement of facts, grounds and additional evidence",
    "Appeal filing details",
    "Form of verification",
    "Reference data (not printed)",
]

S1, S2, S3, S4, S5, S6, S7, S8 = SECTIONS

FIELDS: List[FieldSpec] = [
    # --- Personal information ---
    FieldSpec("first_name", "First name", S1),
    FieldSpec("middle_name", "Middle name", S1),
    FieldSpec("last_name", "Last name or name of entity", S1, required=True),
    FieldSpec("pan", "Permanent Account Number or Aadhaar number", S1, required=True),
    FieldSpec("tan", "TAN (if available)", S1),
    FieldSpec("flat_door", "Flat / Door / Block number", S1),
    FieldSpec("premises", "Name of premises / building / village", S1),
    FieldSpec("road_street", "Road / street / post office", S1),
    FieldSpec("area", "Area / locality", S1),
    FieldSpec("city", "Town / city / district", S1),
    FieldSpec("state", "State", S1),
    FieldSpec("country", "Country", S1),
    FieldSpec("pincode", "PIN code", S1),
    FieldSpec("phone", "Phone number with STD code or mobile number", S1),
    FieldSpec("email", "Email address", S1),
    FieldSpec("email_consent", "May notices or communications be sent by email?", S1, kind="choice", choices=YES_NO),

    # --- Order against which appeal is filed ---
    FieldSpec("assessment_year", "Assessment year or financial year to which appeal relates", S2, "1", required=True),
    FieldSpec("order_section", "Section and sub-section under which order was passed", S2, "2a", required=True),
    FieldSpec("order_date", "Date of order", S2, "2b", required=True),
    FieldSpec("service_date", "Date of service of order or notice of demand", S2, "2c", required=True),
    FieldSpec("authority", "Income-tax authority passing the order", S2, "3", required=True),
    FieldSpec("other_appeal_pending", "Other appeal pending for another assessment or financial year?", S2, "4", kind="choice", choices=YES_NO),
    FieldSpec("pending_appellate_authority", "JCIT(Appeals) / CIT(Appeals) with whom pending", S2, "4.1a"),
    FieldSpec("pending_appeal_no", "Appeal number and filing date", S2, "4.1b"),
    FieldSpec("pending_ay", "Assessment year or financial year", S2, "4.1c"),
    FieldSpec("pending_authority", "Authority passing order", S2, "4.1d"),
    FieldSpec("pending_section", "Section and sub-section of order", S2, "4.1e"),
    FieldSpec("pending_order_date", "Date of order", S2, "4.1f"),

    # --- Appeal details ---
    FieldSpec("appeal_section", "Section and sub-section under which appeal is preferred", S3, "5", required=True),
    FieldSpec("income_assessed", "Amount of income assessed (Rs.)", S3, "6a"),
    FieldSpec("total_addition", "Total addition to income (Rs.)", S3, "6b"),
    FieldSpec("loss_disallowance", "Total disallowance of loss (Rs.)", S3, "6c"),
    FieldSpec("disputed_addition", "Addition or disallowance of loss disputed (Rs.)", S3, "6d"),
    FieldSpec("disputed_demand", "Disputed demand (Rs.) - enter Nil in case of loss", S3, "6e"),
    FieldSpec("penalty_amount", "Penalty as per order (Rs.)", S3, "7a"),
    FieldSpec("penalty_disputed", "Penalty disputed (Rs.)", S3, "7b"),

    # --- Taxes paid ---
    FieldSpec("tax_paid_in_full", "If return filed, tax due on returned income paid in full?", S4, "8", kind="choice", choices=YES_NO_NA),
    FieldSpec("return_ack_no", "Return acknowledgement number", S4, "8.1a"),
    FieldSpec("return_filing_date", "Date of filing return", S4, "8.1b"),
    FieldSpec("total_tax_paid", "Total tax paid (Rs.)", S4, "8.1c"),
    FieldSpec("advance_tax_249", "If no return filed, amount equal to advance tax u/s 249(4)(b) paid?", S4, "9", kind="choice", choices=YES_NO_NA),
    FieldSpec("advance_tax_details", "Tax payment - BSR code, date, serial number, amount and total", S4, "9.1"),
    FieldSpec("tax_195", "Tax deposited u/s 195(1), if relevant - BSR code, date, serial number, amount", S4, "10"),

    # --- Statement of facts, grounds, evidence ---
    FieldSpec("statement_of_facts", "Facts of the case in brief (not exceeding 1000 words)", S5, "11", kind="multiline", required=True),
    FieldSpec("documents_relied", "List of documentary evidence relied upon", S5, "11", kind="multiline"),
    FieldSpec("additional_evidence", "Additional documentary evidence under rule 46A filed?", S5, "12", kind="choice", choices=YES_NO),
    FieldSpec("additional_evidence_list", "List of such documentary evidence (if Yes)", S5, "12.1", kind="multiline"),
    FieldSpec("grounds_of_appeal", "Grounds of appeal (each ground not exceeding 100 words)", S5, "13", kind="multiline", required=True),

    # --- Appeal filing details ---
    FieldSpec("delay", "Delay in filing appeal?", S6, "14", kind="choice", choices=YES_NO),
    FieldSpec("condonation_grounds", "Grounds for condonation of delay, if relevant (not exceeding 500 words)", S6, "15", kind="multiline"),
    FieldSpec("appeal_fee", "Appeal fees - BSR code, date, serial number, amount", S6, "16"),
    FieldSpec("service_address", "Address for service of notices", S6, "17", kind="multiline"),

    # --- Verification ---
    FieldSpec("verifier_name", "Name of appellant signing the verification", S7, required=True),
    FieldSpec("place", "Place", S7),
    FieldSpec("verification_date", "Date", S7),

    # --- Reviewer inputs, not printed ---
    FieldSpec("service_confirmed", "I checked the actual service date against the record", S8, kind="choice", choices=YES_NO, printed=False),
    FieldSpec("drafts_reviewed", "I reviewed the facts, grounds and figures for this case", S8, kind="choice", choices=YES_NO, printed=False),
    FieldSpec("reviewer_notes", "Confirmed facts, disputed issues and drafting instructions", S8, kind="multiline", printed=False),
    FieldSpec("ai_review_notes", "AI evidence references and questions (not verified automatically)", S8, kind="multiline", printed=False),
    # --- Reference only ---
    FieldSpec("assessee_status", "Status", S8, printed=False),
    FieldSpec("nature_of_business", "Nature of business", S8, printed=False),
    FieldSpec("returned_income", "Returned income (Rs.)", S8, printed=False),
    FieldSpec("ward", "Jurisdictional Ward / Circle", S8, printed=False),
    FieldSpec("order_din", "DIN of assessment order", S8, printed=False),
    FieldSpec("demand_notice_din", "DIN of demand notice u/s 156", S8, printed=False),
    FieldSpec("tds_credit", "TDS as per computation sheet (Rs.)", S8, printed=False),
    FieldSpec("interest_charged", "Interest charged u/s 234A/B/C/D (Rs.)", S8, printed=False),
    FieldSpec("penalty_initiated", "Penalty proceedings initiated", S8, printed=False),
    FieldSpec("addition_details", "Additions / variations (one per line: description | amount)", S8, kind="multiline", printed=False),
]

FIELD_BY_KEY: Dict[str, FieldSpec] = {f.key: f for f in FIELDS}


@dataclass
class AppealData:
    values: Dict[str, str] = field(default_factory=lambda: {f.key: "" for f in FIELDS})
    # key -> human readable provenance, e.g. "Order u/s 143(3).pdf" or "Drafted - review"
    sources: Dict[str, str] = field(default_factory=dict)
    source_pdf_paths: List[str] = field(default_factory=list)

    def get(self, key: str) -> str:
        return self.values.get(key, "")

    def set(self, key: str, value: str, source: str = "") -> None:
        self.values[key] = value
        if source:
            self.sources[key] = source
        else:
            self.sources.pop(key, None)

    @property
    def assessee_name(self) -> str:
        return " ".join(p for p in (self.get("first_name"), self.get("middle_name"), self.get("last_name")) if p)

    def missing_required(self) -> List[FieldSpec]:
        return [f for f in FIELDS if f.required and not self.get(f.key).strip()]

    def is_minimum_valid(self) -> bool:
        return bool(self.get("pan") and self.assessee_name and self.get("assessment_year"))

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "AppealData":
        obj = cls()
        obj.values.update({k: str(v) for k, v in d.get("values", {}).items()})
        obj.sources.update(d.get("sources", {}))
        obj.source_pdf_paths = list(d.get("source_pdf_paths", []))
        return obj
