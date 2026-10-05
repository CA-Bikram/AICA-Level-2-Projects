"""Render a filled Form No. 35 as PDF using ReportLab."""
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

from data_models import FIELDS, SECTIONS, AppealData

INK = colors.HexColor("#1f2937")
RULE = colors.HexColor("#9ca3af")
BAND = colors.HexColor("#e5e7eb")

_ss = getSampleStyleSheet()
ST_TITLE = ParagraphStyle("t", parent=_ss["Title"], fontName="Helvetica-Bold", fontSize=15, spaceAfter=1, textColor=INK)
ST_SUB = ParagraphStyle("s", parent=_ss["Normal"], fontName="Helvetica", fontSize=9, alignment=TA_CENTER, textColor=INK)
ST_HEAD = ParagraphStyle("h", parent=_ss["Normal"], fontName="Helvetica-Bold", fontSize=9.5, textColor=INK)
ST_NO = ParagraphStyle("n", parent=_ss["Normal"], fontName="Helvetica", fontSize=8.5, textColor=INK)
ST_LBL = ParagraphStyle("l", parent=_ss["Normal"], fontName="Helvetica", fontSize=8.5, leading=10.5, textColor=INK)
ST_VAL = ParagraphStyle("v", parent=_ss["Normal"], fontName="Helvetica-Bold", fontSize=8.8, leading=11, textColor=INK)
ST_LONG = ParagraphStyle("lg", parent=_ss["Normal"], fontName="Helvetica", fontSize=9, leading=12.5,
                         alignment=TA_JUSTIFY, textColor=INK, spaceAfter=4)
ST_BODY = ParagraphStyle("b", parent=ST_LONG, fontSize=9.5, leading=14)

W_NO, W_LBL = 12 * mm, 70 * mm
LONG_FIELDS = {"statement_of_facts", "grounds_of_appeal", "condonation_grounds"}


def _section_band(title: str, width: float) -> Table:
    t = Table([[Paragraph(escape(title), ST_HEAD)]], colWidths=[width])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BAND), ("BOX", (0, 0), (-1, -1), 0.5, RULE)]))
    return t


def _p(text: str, style) -> Paragraph:
    return Paragraph(escape(text or "").replace("\n", "<br/>"), style)


def _long_block(text: str):
    """Multi-paragraph text (facts, grounds) as separate flowables so it can split across pages."""
    paras = [t.strip() for t in (text or "").split("\n\n") if t.strip()] or ["-"]
    return [_p(t, ST_LONG) for t in paras]


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(15 * mm, 9 * mm, getattr(doc, "_footer_left", ""))
    canvas.drawRightString(A4[0] - 15 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def export_form35(data: AppealData, path: str) -> None:
    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=14 * mm, bottomMargin=16 * mm,
                            title=f"Form 35 - {data.assessee_name} - AY {data.get('assessment_year')}",
                            author=data.assessee_name)
    doc._footer_left = (f"Form No. 35  |  {data.assessee_name}  |  PAN {data.get('pan')}  |  "
                        f"AY {data.get('assessment_year')}")
    full_w = A4[0] - 30 * mm
    story = [
        Paragraph("FORM NO. 35", ST_TITLE),
        _p("[See rule 45]", ST_SUB),
        Spacer(1, 2),
        _p("Appeal to the Joint Commissioner (Appeals) or the Commissioner of Income-tax (Appeals)", ST_SUB),
        Spacer(1, 8),
    ]

    for section in SECTIONS:
        specs = [f for f in FIELDS if f.section == section and f.printed]
        if not specs or section == "Form of verification":
            continue
        # Short fields go in grid rows; long narrative fields break the grid and flow as
        # paragraphs, so rows are flushed in chunks to preserve the form's row order.
        rows = [[_p(section, ST_HEAD), "", ""]]
        has_header = True

        def flush():
            nonlocal rows, has_header
            if not rows:
                return
            t = Table(rows, colWidths=[W_NO, W_LBL, full_w - W_NO - W_LBL], repeatRows=1 if has_header else 0)
            style = [("GRID", (0, 0), (-1, -1), 0.5, RULE),
                     ("VALIGN", (0, 0), (-1, -1), "TOP"),
                     ("TOPPADDING", (0, 0), (-1, -1), 3),
                     ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
            if has_header:
                style += [("SPAN", (0, 0), (-1, 0)), ("BACKGROUND", (0, 0), (-1, 0), BAND)]
            t.setStyle(TableStyle(style))
            story.extend([t, Spacer(1, 6)])
            rows, has_header = [], False

        for f in specs:
            if f.key in LONG_FIELDS:
                if has_header and len(rows) == 1:
                    story.append(_section_band(section, full_w))
                    rows, has_header = [], False
                flush()
                text = data.get(f.key)
                if f.key == "condonation_grounds" and not text.strip():
                    text = "Not applicable"
                head = Table([[_p(f"{f.row}  {f.label}", ST_HEAD)]], colWidths=[full_w])
                head.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, RULE)]))
                body = _long_block(text)
                story += [KeepTogether([head, Spacer(1, 4), body[0]]), *body[1:], Spacer(1, 6)]
                continue
            rows.append([_p(f.row, ST_NO), _p(f.label, ST_LBL), _p(data.get(f.key) or "-", ST_VAL)])
        if rows and not (has_header and len(rows) == 1):
            flush()

    verifier = data.get("verifier_name") or "______________________________"
    ver = [
        _p("Form of verification", ST_HEAD),
        Spacer(1, 5),
        _p(f"I, {verifier}, the appellant, do hereby declare that what is stated above is true to the best of my "
           "information and belief. It is also certified that no additional evidence other than the evidence "
           "stated in row 12.1 above has been filed.", ST_BODY),
        Spacer(1, 10),
    ]
    sig = Table([
        ["", "", "", ""],
        [_p("Place:", ST_LBL), _p(data.get("place") or "", ST_VAL), "", _p("Signature of the appellant", ST_LBL)],
        [_p("Date:", ST_LBL), _p(data.get("verification_date") or "", ST_VAL), "", _p(f"({verifier})", ST_VAL)],
    ], colWidths=[16 * mm, 60 * mm, full_w - 136 * mm, 60 * mm], rowHeights=[28, None, None])
    sig.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                             ("LINEBELOW", (3, 0), (3, 0), 0.5, INK)]))
    ver.append(sig)
    story.append(KeepTogether(ver))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
