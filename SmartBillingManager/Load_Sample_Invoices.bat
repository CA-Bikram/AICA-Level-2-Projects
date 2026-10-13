@echo off & title Smart Billing Manager - Sample Invoices & cd /d "%~dp0" & (python --version >nul 2>nul && (python -x "%~f0") || (py -3 -x "%~f0") || echo Python was not found. Install it from python.org first.) & pause & exit /b
# ---------------------------------------------------------------------------
# Smart Billing Manager - sample data loader (this .bat file runs itself in Python)
# Keep this file in the SmartBillingManager folder (next to main.py) and
# double-click it. It adds 6 sample invoices numbered SAMPLE-001 to SAMPLE-006.
# Double-click it again to remove them. Your own invoices are never touched.
# ---------------------------------------------------------------------------
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))


def day(days_ago):
    return (date.today() - timedelta(days=days_ago)).strftime("%Y-%m-%d")


SELLER = {
    "trade_name": "Sample Traders (Demo)", "address": "12, Park Street\nKolkata - 700016, West Bengal",
    "mobile": "9800000000", "email": "demo@sampletraders.example", "gstin": "19ABCDE1234F1Z5",
    "state": "West Bengal (19)", "bank_name": "Demo Bank", "bank_account_name": "Sample Traders (Demo)",
    "bank_account_no": "000011112222", "bank_ifsc": "DEMO0000001", "bank_branch": "Park Street",
    "terms": "Goods once sold will not be taken back.\nPayment due within 30 days.",
}

# number, days ago, customer (name, address, mobile, gstin), inter-state, round off,
# items (name, hsn, qty, rate, gst %), receipts (days ago, amount or "FULL", mode, note)
SAMPLES = [
    ("SAMPLE-001", 75, ("Rahul Enterprises", "45 MG Road\nKolkata - 700001", "9830011111", "19AAACR5055K1Z5"), False, True,
     [("Steel Rod 12mm TMT", "7214", 25.5, 62.75, 18), ("Cement Bag 50kg", "2523", 40, 385, 28), ("Labour Charges", "9954", 1, 2000, 18)],
     [(60, 10000, "UPI", "UTR 402511")]),
    ("SAMPLE-002", 50, ("Mehta Stores", "8 Linking Road\nMumbai - 400050", "9820022222", "27AABCM1234D1Z6"), True, True,
     [("LED Bulb 9W", "8539", 200, 68, 18), ("Extension Board 4 Socket", "8536", 50, 245, 18)],
     [(45, "FULL", "Bank Transfer", "NEFT N123456")]),
    ("SAMPLE-003", 35, ("Anita Sharma", "Flat 3B, Lake View Apartments\nKolkata - 700029", "9831033333", ""), False, True,
     [("Basmati Rice 25kg", "1006", 4, 2150, 5), ("Refined Oil 15L Tin", "1512", 2, 1890, 5), ("Packing Charges", "", 1, 150, 18)],
     []),
    ("SAMPLE-004", 20, ("Sunrise Hotel Pvt Ltd", "NH-16, Bypass Road\nBhubaneswar - 751010", "9437044444", "21AAECS9876P1Z3"), True, True,
     [("Bed Sheet Double", "6302", 60, 540, 5), ("Bath Towel", "6302", 120, 185, 5), ("Room Freshener 250ml", "3307", 48, 142.5, 18)],
     [(15, 20000, "Cheque", "Chq 004512"), (5, 15000, "Bank Transfer", "RTGS R778899")]),
    ("SAMPLE-005", 8, ("Gupta Medical Hall", "22 College Street\nKolkata - 700073", "9903055555", "19AAGFG4321H1Z8"), False, False,
     [("Digital Thermometer", "9025", 15, 132.2, 12), ("Hand Sanitizer 500ml", "3808", 36, 88.5, 18), ("Surgical Mask Box", "6307", 20, 95.75, 5)],
     []),
    ("SAMPLE-006", 1, ("Walk-in Customer", "", "", ""), False, True,
     [("Office Chair", "9401", 2, 3450, 18), ("Study Table", "9403", 1, 5200, 18)],
     [(1, "FULL", "Cash", "")]),
]


def main():
    from sbm.calculations import compute_item, compute_totals
    from sbm.database import Database

    db = Database()
    existing = [i for i in db.invoices if str(i.get("invoice_no", "")).startswith("SAMPLE-")]
    if existing:
        print(f"\n {len(existing)} sample invoice(s) are already in the database.")
        if input(" Remove them? (Y/N): ").strip().lower() == "y":
            for inv in existing:
                db.delete_invoice(inv["id"])
            if db.seller.get("trade_name") == SELLER["trade_name"]:
                db.save_seller({k: "" for k in SELLER})
            print(" Sample invoices removed.")
        else:
            print(" Nothing changed.")
        return

    if not db.seller.get("trade_name"):
        db.save_seller({**db.seller, **SELLER})
        print("\n Sample seller details added (change them under 'Seller Details').")

    print()
    for number, ago, cust, interstate, round_off, items, receipts in SAMPLES:
        lines = [compute_item(*item) for item in items]
        invoice = {
            "invoice_no": number, "date": day(ago),
            "customer": dict(zip(("name", "address", "mobile", "gstin"), cust)),
            "interstate": interstate, "round_off_enabled": round_off,
            "items": lines, "receipts": [],
        }
        invoice.update(compute_totals(lines, round_off, interstate))
        for r_ago, amount, mode, note in receipts:
            invoice["receipts"].append({
                "date": day(r_ago), "mode": mode, "note": note,
                "amount": invoice["grand_total"] if amount == "FULL" else amount})
        saved = db.save_invoice(invoice)
        print(f"  {number}  {cust[0]:<24} Total {saved['grand_total']:>11,.2f}   "
              f"Outstanding {saved['outstanding_amount']:>11,.2f}   {saved['payment_status']}")
    print("\n 6 sample invoices added. Start the app and click Search to see them.")
    print(" Run this file again to remove them.")


try:
    main()
except ImportError:
    print("\n Keep this file inside the SmartBillingManager folder (next to main.py) and run it again.")
except Exception as exc:
    print("\n Could not load sample invoices:", exc)
