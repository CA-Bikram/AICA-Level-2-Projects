"""Professional invoice PDF built with reportlab. Print uses this same PDF."""
import os
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (Image, KeepTogether, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

from .calculations import amount_in_words, fmt_money, fmt_qty

BLUE = colors.HexColor("#1556B0")
LIGHT_BLUE = colors.HexColor("#EAF1FB")
RED = colors.HexColor("#C62828")
GREY = colors.HexColor("#555555")
LINE = colors.HexColor("#B8C7DE")


def _style(name, size=9, bold=False, color=colors.black, align=0, leading=None):
    return ParagraphStyle(
        name, fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size, leading=leading or size + 3, textColor=color,
        alignment=align)


S_NORMAL = _style("n")
S_SMALL = _style("s", 8, color=GREY)
S_BOLD = _style("b", 9, True)
S_RIGHT = _style("r", 9, align=TA_RIGHT)
S_RIGHT_B = _style("rb", 9, True, align=TA_RIGHT)
S_CENTER = _style("c", 9, align=TA_CENTER)
S_HEAD = _style("h", 8.5, True, colors.white, TA_CENTER)
S_TRADE = _style("t", 17, True, BLUE, leading=20)
S_TITLE = _style("ti", 15, True, RED, TA_RIGHT, 18)
S_LABEL = _style("l", 8.5, True, BLUE)
S_GRAND = _style("g", 11, True, colors.white, TA_RIGHT, 14)
S_GRAND_L = _style("gl", 11, True, colors.white, leading=14)


def _t(text):
    return escape(str(text or "")).replace("\n", "<br/>")


def _date(iso):
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d-%m-%Y")
    except Exception:
        return str(iso or "")


def _pct(value):
    return f"{float(value):g}%"


def _logo(path, max_w=30 * mm, max_h=24 * mm):
    if not path or not os.path.exists(path):
        return None
    try:
        width, height = ImageReader(path).getSize()
        scale = min(max_w / width, max_h / height)
        return Image(path, width=width * scale, height=height * scale)
    except Exception:
        return None


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY)
    canvas.drawString(doc.leftMargin, 7 * mm, "This is a computer generated invoice.")
    canvas.drawRightString(A4[0] - doc.rightMargin, 7 * mm, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def build_invoice_pdf(invoice, seller, path, logo_path=None):
    """Write the invoice PDF to `path` and return the path."""
    doc = SimpleDocTemplate(
        str(path), pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=10 * mm, bottomMargin=13 * mm,
        title=f"Invoice {invoice.get('invoice_no', '')}",
        author=seller.get("trade_name", "") or "Smart Billing Manager")
    width = doc.width
    story = []
    cust = invoice.get("customer", {})
    interstate = bool(invoice.get("interstate"))

    # ---------------- header ----------------
    seller_lines = [Paragraph(_t(seller.get("trade_name") or "Your Business Name"), S_TRADE)]
    if seller.get("address"):
        seller_lines.append(Paragraph(_t(seller["address"]), S_NORMAL))
    contact = " | ".join(x for x in (
        f"Mobile: {seller['mobile']}" if seller.get("mobile") else "",
        f"Email: {seller['email']}" if seller.get("email") else "") if x)
    if contact:
        seller_lines.append(Paragraph(_t(contact), S_NORMAL))
    reg = " | ".join(x for x in (
        f"GSTIN: {seller['gstin']}" if seller.get("gstin") else "",
        f"State: {seller['state']}" if seller.get("state") else "") if x)
    if reg:
        seller_lines.append(Paragraph(f"<b>{_t(reg)}</b>", S_NORMAL))

    title = "TAX INVOICE" if seller.get("gstin") else "INVOICE"
    right = [Paragraph(title, S_TITLE), Spacer(1, 4),
             Paragraph(f"<b>Invoice No:</b> {_t(invoice.get('invoice_no'))}", S_RIGHT),
             Paragraph(f"<b>Date:</b> {_date(invoice.get('date'))}", S_RIGHT)]

    logo = _logo(logo_path)
    if logo:
        header = Table([[logo, seller_lines, right]],
                       colWidths=[34 * mm, width - 34 * mm - 52 * mm, 52 * mm])
    else:
        header = Table([[seller_lines, right]], colWidths=[width - 52 * mm, 52 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 2, BLUE),
    ]))
    story += [header, Spacer(1, 3 * mm)]

    # ---------------- bill to ----------------
    bill = [Paragraph("BILL TO", S_LABEL),
            Paragraph(f"<b>{_t(cust.get('name'))}</b>", _style("cn", 10.5, True))]
    if cust.get("address"):
        bill.append(Paragraph(_t(cust["address"]), S_NORMAL))
    if cust.get("mobile"):
        bill.append(Paragraph(f"Mobile: {_t(cust['mobile'])}", S_NORMAL))
    if cust.get("gstin"):
        bill.append(Paragraph(f"GSTIN: {_t(cust['gstin'])}", S_NORMAL))
    info = [Paragraph("INVOICE DETAILS", S_LABEL),
            Paragraph(f"Invoice No: <b>{_t(invoice.get('invoice_no'))}</b>", S_NORMAL),
            Paragraph(f"Invoice Date: <b>{_date(invoice.get('date'))}</b>", S_NORMAL),
            Paragraph(f"Supply Type: {'Inter-State (IGST)' if interstate else 'Intra-State (CGST + SGST)'}", S_NORMAL)]
    party = Table([[bill, info]], colWidths=[width * 0.58, width * 0.42])
    party.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LINEAFTER", (0, 0), (0, 0), 0.7, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BLUE),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [party, Spacer(1, 3 * mm)]

    # ---------------- items ----------------
    heads = ["#", "Item Description", "HSN/SAC", "Qty", "Rate", "Amount", "GST %", "GST Amt", "Total"]
    rows = [[Paragraph(h, S_HEAD) for h in heads]]
    for n, it in enumerate(invoice.get("items", []), 1):
        rows.append([
            Paragraph(str(n), S_CENTER), Paragraph(_t(it["name"]), S_NORMAL),
            Paragraph(_t(it.get("hsn", "")), S_CENTER),
            Paragraph(fmt_qty(it["qty"]), S_RIGHT), Paragraph(fmt_money(it["rate"]), S_RIGHT),
            Paragraph(fmt_money(it["amount"]), S_RIGHT), Paragraph(_pct(it["gst_pct"]), S_CENTER),
            Paragraph(fmt_money(it["gst_amount"]), S_RIGHT), Paragraph(fmt_money(it["total"]), S_RIGHT),
        ])
    fixed = [8 * mm, 0, 18 * mm, 15 * mm, 21 * mm, 24 * mm, 14 * mm, 21 * mm, 25 * mm]
    fixed[1] = width - sum(fixed)
    items = Table(rows, colWidths=fixed, repeatRows=1)
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("BOX", (0, 0), (-1, -1), 0.8, BLUE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6F9FE")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [items, Spacer(1, 3 * mm)]

    # ---------------- tax summary + totals ----------------
    if interstate:
        tax_heads = ["GST %", "Taxable Value", "IGST", "Total GST"]
        tax_rows = [[_pct(r["gst_pct"]), fmt_money(r["taxable"]), fmt_money(r["igst"]),
                     fmt_money(r["total_gst"])] for r in invoice.get("tax_summary", [])]
        tax_total = ["Total", fmt_money(invoice.get("subtotal", 0)),
                     fmt_money(invoice.get("igst", 0)), fmt_money(invoice.get("total_gst", 0))]
    else:
        tax_heads = ["GST %", "Taxable Value", "CGST", "SGST", "Total GST"]
        tax_rows = [[_pct(r["gst_pct"]), fmt_money(r["taxable"]), fmt_money(r["cgst"]),
                     fmt_money(r["sgst"]), fmt_money(r["total_gst"])]
                    for r in invoice.get("tax_summary", [])]
        tax_total = ["Total", fmt_money(invoice.get("subtotal", 0)),
                     fmt_money(invoice.get("cgst", 0)), fmt_money(invoice.get("sgst", 0)),
                     fmt_money(invoice.get("total_gst", 0))]
    left_w = width * 0.58
    s_tr, s_trb = _style("tr", 8.5, align=TA_RIGHT), _style("trb", 8.5, True, align=TA_RIGHT)
    tax_data = ([[Paragraph(h, S_HEAD) for h in tax_heads]]
                + [[Paragraph(c, s_tr if i else S_CENTER) for i, c in enumerate(r)] for r in tax_rows]
                + [[Paragraph(c, s_trb if i else _style("tc", 9, True, align=TA_CENTER))
                    for i, c in enumerate(tax_total)]])
    rest = (left_w - 14 * mm) / (len(tax_heads) - 1)
    tax = Table(tax_data, colWidths=[14 * mm] + [rest] * (len(tax_heads) - 1))
    tax.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_BLUE),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    left = [Paragraph("TAX SUMMARY", S_LABEL), Spacer(1, 2), tax, Spacer(1, 5),
            Paragraph("AMOUNT IN WORDS", S_LABEL),
            Paragraph(f"<b>{_t(amount_in_words(invoice.get('grand_total', 0)))}</b>", S_NORMAL)]

    total_rows = [["Subtotal (Taxable)", fmt_money(invoice.get("subtotal", 0))]]
    if interstate:
        total_rows.append(["IGST", fmt_money(invoice.get("igst", 0))])
    else:
        total_rows.append(["CGST", fmt_money(invoice.get("cgst", 0))])
        total_rows.append(["SGST", fmt_money(invoice.get("sgst", 0))])
    total_rows.append(["Total GST", fmt_money(invoice.get("total_gst", 0))])
    if abs(invoice.get("round_off", 0)) >= 0.005:
        total_rows.append(["Round Off", f"{invoice['round_off']:+.2f}"])
    data = [[Paragraph(a, S_NORMAL), Paragraph(b, S_RIGHT)] for a, b in total_rows]
    data.append([Paragraph("GRAND TOTAL", S_GRAND_L),
                 Paragraph("Rs. " + fmt_money(invoice.get("grand_total", 0)), S_GRAND)])
    grand_row = len(data) - 1
    received = invoice.get("received_amount", 0) or 0
    if received > 0:
        data.append([Paragraph("Amount Received", S_NORMAL), Paragraph(fmt_money(received), S_RIGHT)])
        data.append([Paragraph("<b>Balance Due</b>", S_NORMAL),
                     Paragraph(f"<font color='#C62828'><b>{fmt_money(invoice.get('outstanding_amount', 0))}</b></font>", S_RIGHT)])
    right_w = width - left_w - 5 * mm
    totals = Table(data, colWidths=[right_w * 0.5, right_w * 0.5])
    totals.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, BLUE),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("BACKGROUND", (0, grand_row), (-1, grand_row), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    block = Table([[left, "", totals]], colWidths=[left_w, 5 * mm, right_w])
    block.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [KeepTogether(block), Spacer(1, 5 * mm)]

    # ---------------- footer: bank, declaration, signature ----------------
    bank = [Paragraph("BANK DETAILS", S_LABEL)]
    for label, key in (("Bank", "bank_name"), ("A/c Name", "bank_account_name"),
                       ("A/c No", "bank_account_no"), ("IFSC", "bank_ifsc"),
                       ("Branch", "bank_branch"), ("UPI", "upi_id")):
        if seller.get(key):
            bank.append(Paragraph(f"{label}: <b>{_t(seller[key])}</b>", S_NORMAL))
    if len(bank) == 1:
        bank.append(Paragraph("-", S_NORMAL))
    decl = [Paragraph("DECLARATION", S_LABEL), Paragraph(_t(seller.get("declaration")), S_SMALL)]
    if seller.get("terms"):
        decl += [Spacer(1, 3), Paragraph("TERMS &amp; CONDITIONS", S_LABEL),
                 Paragraph(_t(seller["terms"]), S_SMALL)]
    sign = [Paragraph(f"For <b>{_t(seller.get('trade_name') or '')}</b>", S_RIGHT),
            Spacer(1, 16 * mm), Paragraph("Authorised Signatory", S_RIGHT)]
    foot = Table([[bank, decl, sign]], colWidths=[width * 0.31, width * 0.39, width * 0.30])
    foot.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LINEAFTER", (0, 0), (1, 0), 0.7, LINE),
        ("LINEABOVE", (0, 0), (-1, 0), 1.5, RED),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(KeepTogether(foot))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return str(path)
