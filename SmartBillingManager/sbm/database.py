"""JSON database: invoices + seller settings. Files are auto-created."""
import copy
import json
import os
import re
import shutil
import uuid
from datetime import datetime

from . import config
from .calculations import payment_status

DEFAULT_SELLER = {
    "trade_name": "", "address": "", "mobile": "", "email": "",
    "gstin": "", "state": "", "logo": "",
    "bank_name": "", "bank_account_name": "", "bank_account_no": "",
    "bank_ifsc": "", "bank_branch": "", "upi_id": "",
    "declaration": ("We declare that this invoice shows the actual price of "
                    "the goods/services described and that all particulars "
                    "are true and correct."),
    "terms": "",
    "invoice_prefix": "INV-",
}


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class Database:
    def __init__(self, invoice_path=None, settings_path=None):
        config.ensure_folders()
        self.invoice_path = invoice_path or config.INVOICE_DB
        self.settings_path = settings_path or config.SETTINGS_DB
        self.warnings = []
        self.invoices = self._load(self.invoice_path, {"invoices": []})["invoices"]
        stored = self._load(self.settings_path, {"seller": {}}).get("seller", {})
        self.seller = {**DEFAULT_SELLER, **stored}
        for inv in self.invoices:
            self._refresh_payment(inv)

    # ---------- file handling ----------
    def _load(self, path, default):
        if not os.path.exists(path):
            self._write(path, default)
            return copy.deepcopy(default)
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            if not isinstance(data, dict):
                raise ValueError("unexpected structure")
            for key, value in default.items():
                data.setdefault(key, copy.deepcopy(value))
            return data
        except Exception as exc:
            backup = f"{path}.corrupt_{datetime.now():%Y%m%d_%H%M%S}"
            shutil.copy2(path, backup)
            self.warnings.append(
                f"{os.path.basename(str(path))} could not be read ({exc}). "
                f"A copy was kept as {os.path.basename(backup)} and a new file was started.")
            self._write(path, default)
            return copy.deepcopy(default)

    @staticmethod
    def _write(path, data):
        """Atomic write so a crash can never leave a half-written database."""
        path = str(path)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
        if os.path.exists(path):
            shutil.copy2(path, path + ".bak")
        os.replace(tmp, path)

    def _save_invoices(self):
        self._write(self.invoice_path, {"invoices": self.invoices})

    # ---------- seller ----------
    def save_seller(self, seller):
        self.seller = {**DEFAULT_SELLER, **seller}
        self._write(self.settings_path, {"seller": self.seller})

    def logo_path(self):
        logo = self.seller.get("logo") or ""
        if not logo:
            return None
        path = logo if os.path.isabs(logo) else str(config.DATABASE_DIR / logo)
        return path if os.path.exists(path) else None

    def store_logo(self, source):
        """Copy the chosen logo into /database so the app stays portable."""
        ext = os.path.splitext(source)[1].lower() or ".png"
        target = config.DATABASE_DIR / f"logo{ext}"
        if os.path.abspath(source) != os.path.abspath(target):
            shutil.copy2(source, target)
        return target.name

    # ---------- invoices ----------
    @staticmethod
    def _refresh_payment(inv):
        inv.setdefault("receipts", [])
        received, outstanding, status = payment_status(
            inv.get("grand_total", 0), inv["receipts"])
        inv["received_amount"] = received
        inv["outstanding_amount"] = outstanding
        inv["payment_status"] = status
        dates = [r.get("date", "") for r in inv["receipts"]]
        inv["last_receipt_date"] = max(dates) if dates else ""

    def next_invoice_no(self):
        prefix = self.seller.get("invoice_prefix", "INV-") or ""
        highest = 0
        for inv in self.invoices:
            number = str(inv.get("invoice_no", ""))
            if number.startswith(prefix):
                match = re.search(r"(\d+)$", number)
                if match:
                    highest = max(highest, int(match.group(1)))
        return f"{prefix}{highest + 1:04d}"

    def get(self, invoice_id):
        for inv in self.invoices:
            if inv["id"] == invoice_id:
                return copy.deepcopy(inv)
        return None

    def number_exists(self, invoice_no, exclude_id=None):
        wanted = invoice_no.strip().lower()
        return any(str(inv.get("invoice_no", "")).strip().lower() == wanted
                   and inv["id"] != exclude_id for inv in self.invoices)

    def save_invoice(self, invoice):
        """Insert or update. Returns the stored copy."""
        invoice = copy.deepcopy(invoice)
        self._refresh_payment(invoice)
        invoice["updated_at"] = _now()
        if invoice.get("id"):
            for index, existing in enumerate(self.invoices):
                if existing["id"] == invoice["id"]:
                    invoice.setdefault("created_at", existing.get("created_at", _now()))
                    self.invoices[index] = invoice
                    break
            else:
                invoice["created_at"] = _now()
                self.invoices.append(invoice)
        else:
            invoice["id"] = uuid.uuid4().hex
            invoice["created_at"] = _now()
            self.invoices.append(invoice)
        self._save_invoices()
        return copy.deepcopy(invoice)

    def delete_invoice(self, invoice_id):
        before = len(self.invoices)
        self.invoices = [i for i in self.invoices if i["id"] != invoice_id]
        if len(self.invoices) != before:
            self._save_invoices()
            return True
        return False

    def set_receipts(self, invoice_id, receipts):
        for inv in self.invoices:
            if inv["id"] == invoice_id:
                inv["receipts"] = copy.deepcopy(receipts)
                inv["updated_at"] = _now()
                self._refresh_payment(inv)
                self._save_invoices()
                return copy.deepcopy(inv)
        return None

    def search(self, text="", outstanding_only=False, date_from="", date_to=""):
        text = text.strip().lower()
        result = []
        for inv in self.invoices:
            cust = inv.get("customer", {})
            hay = " ".join([str(inv.get("invoice_no", "")), cust.get("name", ""),
                            cust.get("mobile", ""), cust.get("gstin", ""),
                            cust.get("address", "")]).lower()
            if text and text not in hay:
                continue
            if outstanding_only and inv.get("outstanding_amount", 0) <= 0.004:
                continue
            date = inv.get("date", "")
            if date_from and date < date_from:
                continue
            if date_to and date > date_to:
                continue
            result.append(copy.deepcopy(inv))
        result.sort(key=lambda i: (i.get("date", ""), str(i.get("invoice_no", ""))),
                    reverse=True)
        return result

    def outstanding_invoices(self):
        return self.search(outstanding_only=True)
