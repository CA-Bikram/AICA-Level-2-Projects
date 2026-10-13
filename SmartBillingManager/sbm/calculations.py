"""All money maths. Uses Decimal so totals are exact to the paisa."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

TWO = Decimal("0.01")


def D(value):
    try:
        return Decimal(str(value).strip() or "0")
    except (InvalidOperation, ValueError):
        return Decimal("0")


def q2(value):
    return D(value).quantize(TWO, rounding=ROUND_HALF_UP)


def fmt_money(value):
    """1234567.5 -> '12,34,567.50' (Indian digit grouping)."""
    value = q2(value)
    sign = "-" if value < 0 else ""
    whole, frac = f"{abs(value):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return f"{sign}{whole}.{frac}"


def fmt_qty(value):
    text = f"{D(value):.3f}".rstrip("0").rstrip(".")
    return text or "0"


def compute_item(name, hsn, qty, rate, gst_pct):
    """Return one fully calculated line item."""
    qty, rate, gst_pct = D(qty), D(rate), D(gst_pct)
    taxable = q2(qty * rate)
    gst_amt = q2(taxable * gst_pct / Decimal(100))
    return {
        "name": str(name).strip(),
        "hsn": str(hsn or "").strip(),
        "qty": float(qty),
        "rate": float(q2(rate)),
        "gst_pct": float(gst_pct),
        "amount": float(taxable),
        "gst_amount": float(gst_amt),
        "total": float(taxable + gst_amt),
    }


def compute_totals(items, round_off=True, interstate=False):
    """Subtotal, GST, round off, grand total and the rate-wise tax summary."""
    subtotal = Decimal(0)
    total_gst = Decimal(0)
    by_rate = {}
    for it in items:
        amount, gst = q2(it["amount"]), q2(it["gst_amount"])
        subtotal += amount
        total_gst += gst
        row = by_rate.setdefault(D(it["gst_pct"]), [Decimal(0), Decimal(0)])
        row[0] += amount
        row[1] += gst

    summary = []
    cgst_t = sgst_t = igst_t = Decimal(0)
    for rate in sorted(by_rate):
        taxable, gst = by_rate[rate]
        if interstate:
            cgst, sgst, igst = Decimal(0), Decimal(0), gst
        else:
            cgst = q2(gst / 2)
            sgst = gst - cgst
            igst = Decimal(0)
        cgst_t, sgst_t, igst_t = cgst_t + cgst, sgst_t + sgst, igst_t + igst
        summary.append({
            "gst_pct": float(rate), "taxable": float(taxable),
            "cgst": float(cgst), "sgst": float(sgst), "igst": float(igst),
            "total_gst": float(gst),
        })

    exact = subtotal + total_gst
    if round_off:
        grand = exact.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    else:
        grand = exact
    return {
        "subtotal": float(subtotal),
        "total_gst": float(total_gst),
        "cgst": float(cgst_t), "sgst": float(sgst_t), "igst": float(igst_t),
        "round_off": float(grand - exact),
        "grand_total": float(grand),
        "tax_summary": summary,
    }


def payment_status(grand_total, receipts):
    """Return (received, outstanding, status)."""
    received = sum((q2(r.get("amount", 0)) for r in receipts), Decimal(0))
    outstanding = q2(grand_total) - received
    if received <= 0:
        status = "Unpaid"
    elif outstanding <= 0:
        status = "Paid"
    else:
        status = "Partly Paid"
    return float(received), float(outstanding), status


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
         "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
         "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
         "Eighty", "Ninety"]


def _below_thousand(n):
    words = []
    if n >= 100:
        words += [_ONES[n // 100], "Hundred"]
        n %= 100
    if n >= 20:
        words.append(_TENS[n // 10])
        n %= 10
    if n:
        words.append(_ONES[n])
    return " ".join(words)


def _int_words(n):
    if n == 0:
        return "Zero"
    parts = []
    for size, label in ((10000000, "Crore"), (100000, "Lakh"), (1000, "Thousand")):
        if n >= size:
            chunk = n // size
            n %= size
            head = _int_words(chunk) if chunk >= 1000 else _below_thousand(chunk)
            parts.append(f"{head} {label}")
    if n:
        parts.append(_below_thousand(n))
    return " ".join(parts)


def amount_in_words(amount):
    amount = q2(abs(D(amount)))
    rupees = int(amount)
    paise = int((amount - rupees) * 100)
    text = "Rupees " + _int_words(rupees)
    if paise:
        text += " and " + _below_thousand(paise) + " Paise"
    return text + " Only"
