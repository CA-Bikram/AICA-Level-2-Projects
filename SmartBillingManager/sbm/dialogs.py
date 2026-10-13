"""Dialogs: seller details, search, receipts, invoice preview + shared helpers."""
import os
import re
import tempfile
from datetime import datetime

from PyQt6.QtCore import QDate, QPointF, QSize, Qt
from PyQt6.QtGui import QPainter, QPixmap
from PyQt6.QtWidgets import (QAbstractItemView, QCheckBox, QComboBox, QDateEdit,
                             QDialog, QDoubleSpinBox, QFileDialog, QFormLayout,
                             QGroupBox, QHBoxLayout, QHeaderView, QLabel,
                             QLineEdit, QMessageBox, QPlainTextEdit,
                             QPushButton, QScrollArea, QTableWidget,
                             QTableWidgetItem, QVBoxLayout, QWidget)

from .calculations import fmt_money

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
MOBILE_RE = re.compile(r"^\+?[0-9]{10,13}$")


# ---------- small shared helpers ----------
def info(parent, text, title="Smart Billing Manager"):
    QMessageBox.information(parent, title, text)


def warn(parent, text, title="Please check"):
    QMessageBox.warning(parent, title, text)


def confirm(parent, text, title="Confirm"):
    return QMessageBox.question(
        parent, title, text,
        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes


def button(text, slot=None, kind=None, tip=None):
    btn = QPushButton(text)
    if kind:
        btn.setProperty("kind", kind)
    if slot:
        btn.clicked.connect(slot)
    if tip:
        btn.setToolTip(tip)
    btn.setCursor(Qt.CursorShape.PointingHandCursor)
    return btn


def show_date(iso):
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d-%m-%Y")
    except Exception:
        return iso or ""


def cell(text, align_right=False, data=None):
    item = QTableWidgetItem(str(text))
    item.setFlags(Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled)
    if align_right:
        item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
    if data is not None:
        item.setData(Qt.ItemDataRole.UserRole, data)
    return item


def setup_table(table, headers, stretch_col):
    table.setColumnCount(len(headers))
    table.setHorizontalHeaderLabels(headers)
    table.setAlternatingRowColors(True)
    table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
    table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
    table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
    table.verticalHeader().setVisible(False)
    head = table.horizontalHeader()
    head.setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
    head.setSectionResizeMode(stretch_col, QHeaderView.ResizeMode.Stretch)


def date_edit(iso=None):
    edit = QDateEdit()
    edit.setCalendarPopup(True)
    edit.setDisplayFormat("dd-MM-yyyy")
    edit.setDate(QDate.fromString(iso, "yyyy-MM-dd") if iso else QDate.currentDate())
    return edit


# ---------- seller details ----------
class SellerDialog(QDialog):
    FIELDS = [("trade_name", "Trade Name *"), ("mobile", "Mobile"), ("email", "Email"),
              ("gstin", "GSTIN"), ("state", "State"), ("invoice_prefix", "Invoice No Prefix")]
    BANK = [("bank_name", "Bank Name"), ("bank_account_name", "Account Name"),
            ("bank_account_no", "Account No"), ("bank_ifsc", "IFSC"),
            ("bank_branch", "Branch"), ("upi_id", "UPI ID")]

    def __init__(self, db, parent=None):
        super().__init__(parent)
        self.db = db
        self.setWindowTitle("Seller / Business Details")
        self.setMinimumWidth(880)
        seller = db.seller
        self.edits = {}
        self.logo_source = None
        self.logo_removed = False

        biz = QGroupBox("Business Details (shown in invoice header)")
        form = QFormLayout(biz)
        for key, label in self.FIELDS:
            self.edits[key] = QLineEdit(seller.get(key, ""))
            form.addRow(label, self.edits[key])
            if key == "trade_name":
                self.address = QPlainTextEdit(seller.get("address", ""))
                self.address.setFixedHeight(62)
                form.addRow("Address", self.address)
        self.logo_label = QLabel("No logo")
        self.logo_label.setFixedSize(QSize(120, 60))
        self.logo_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.logo_label.setStyleSheet("border:1px dashed #B8C7DE;")
        self._show_logo(db.logo_path())
        row = QHBoxLayout()
        row.addWidget(self.logo_label)
        logo_buttons = QVBoxLayout()
        logo_buttons.addWidget(button("Choose Logo...", self.choose_logo, "light"))
        logo_buttons.addWidget(button("Remove Logo", self.remove_logo, "danger"))
        row.addLayout(logo_buttons)
        row.addStretch()
        form.addRow("Logo", row)

        bank = QGroupBox("Bank Details && Footer (shown in invoice footer)")
        bform = QFormLayout(bank)
        for key, label in self.BANK:
            self.edits[key] = QLineEdit(seller.get(key, ""))
            bform.addRow(label, self.edits[key])
        self.declaration = QPlainTextEdit(seller.get("declaration", ""))
        self.declaration.setFixedHeight(62)
        bform.addRow("Declaration", self.declaration)
        self.terms = QPlainTextEdit(seller.get("terms", ""))
        self.terms.setFixedHeight(62)
        bform.addRow("Terms", self.terms)

        cols = QHBoxLayout()
        cols.addWidget(biz)
        cols.addWidget(bank)
        buttons = QHBoxLayout()
        buttons.addStretch()
        buttons.addWidget(button("Save Details", self.save))
        buttons.addWidget(button("Cancel", self.reject, "light"))
        layout = QVBoxLayout(self)
        layout.addLayout(cols)
        layout.addLayout(buttons)

    def _show_logo(self, path):
        pix = QPixmap(path) if path else QPixmap()
        if pix.isNull():
            self.logo_label.setPixmap(QPixmap())
            self.logo_label.setText("No logo")
        else:
            self.logo_label.setPixmap(pix.scaled(
                116, 56, Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation))

    def choose_logo(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Choose Logo", "", "Images (*.png *.jpg *.jpeg *.bmp)")
        if path:
            if QPixmap(path).isNull():
                warn(self, "This file is not a valid image.")
                return
            self.logo_source, self.logo_removed = path, False
            self._show_logo(path)

    def remove_logo(self):
        self.logo_source, self.logo_removed = None, True
        self._show_logo(None)

    def save(self):
        data = {key: edit.text().strip() for key, edit in self.edits.items()}
        data["gstin"] = data["gstin"].upper()
        data["address"] = self.address.toPlainText().strip()
        data["declaration"] = self.declaration.toPlainText().strip()
        data["terms"] = self.terms.toPlainText().strip()
        if not data["trade_name"]:
            warn(self, "Trade Name is required.")
            return
        if data["gstin"] and not GSTIN_RE.match(data["gstin"]):
            warn(self, "GSTIN is not valid. It must be 15 characters, e.g. 27ABCDE1234F1Z5.")
            return
        data["logo"] = self.db.seller.get("logo", "")
        try:
            if self.logo_removed:
                data["logo"] = ""
            elif self.logo_source:
                data["logo"] = self.db.store_logo(self.logo_source)
            self.db.save_seller(data)
        except Exception as exc:
            warn(self, f"Could not save details:\n{exc}", "Error")
            return
        self.accept()


# ---------- receipts ----------
class ReceiptDialog(QDialog):
    """Record full / partial receipts against one saved invoice."""

    def __init__(self, db, invoice, parent=None):
        super().__init__(parent)
        self.db = db
        self.invoice = invoice
        self.setWindowTitle(f"Receipts - {invoice['invoice_no']}")
        self.setMinimumSize(800, 460)

        self.summary = QLabel()
        self.summary.setTextFormat(Qt.TextFormat.RichText)
        self.summary.setWordWrap(True)
        self.table = QTableWidget()
        setup_table(self.table, ["Receipt Date", "Amount", "Mode", "Note / Reference"], 3)

        box = QGroupBox("Add Receipt")
        row = QHBoxLayout(box)
        self.date = date_edit()
        self.amount = QDoubleSpinBox()
        self.amount.setRange(0, 999999999.99)
        self.amount.setDecimals(2)
        self.amount.setMinimumWidth(140)
        self.mode = QComboBox()
        self.mode.addItems(["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"])
        self.note = QLineEdit()
        self.note.setPlaceholderText("Note / reference no")
        for label, widget in (("Date", self.date), ("Amount", self.amount),
                              ("Mode", self.mode), ("", self.note)):
            if label:
                row.addWidget(QLabel(label))
            row.addWidget(widget, 2 if widget is self.note else 0)
        row.addWidget(button("Add Receipt", self.add_receipt))

        buttons = QHBoxLayout()
        buttons.addWidget(button("Receive Full Balance", self.fill_balance, "light"))
        buttons.addWidget(button("Delete Selected Receipt", self.delete_receipt, "danger"))
        buttons.addStretch()
        buttons.addWidget(button("Close", self.accept, "light"))

        layout = QVBoxLayout(self)
        layout.addWidget(self.summary)
        layout.addWidget(self.table)
        layout.addWidget(box)
        layout.addLayout(buttons)
        self.refresh()

    def refresh(self):
        inv = self.invoice
        self.summary.setText(
            f"<b>{inv['invoice_no']}</b> &nbsp;|&nbsp; {inv['customer'].get('name', '')}"
            f" &nbsp;|&nbsp; Invoice Total: <b>{fmt_money(inv['grand_total'])}</b>"
            f" &nbsp;|&nbsp; Received: <b>{fmt_money(inv.get('received_amount', 0))}</b>"
            f" &nbsp;|&nbsp; <span style='color:#C62828'>Outstanding: "
            f"<b>{fmt_money(inv.get('outstanding_amount', 0))}</b></span>"
            f" &nbsp;|&nbsp; {inv.get('payment_status', '')}")
        receipts = inv.get("receipts", [])
        self.table.setRowCount(len(receipts))
        for r, rc in enumerate(receipts):
            self.table.setItem(r, 0, cell(show_date(rc.get("date", ""))))
            self.table.setItem(r, 1, cell(fmt_money(rc.get("amount", 0)), True))
            self.table.setItem(r, 2, cell(rc.get("mode", "")))
            self.table.setItem(r, 3, cell(rc.get("note", "")))
        self.amount.setValue(0)
        self.note.clear()

    def fill_balance(self):
        self.amount.setValue(max(0.0, self.invoice.get("outstanding_amount", 0)))

    def add_receipt(self):
        amount = round(self.amount.value(), 2)
        outstanding = round(self.invoice.get("outstanding_amount", 0), 2)
        if amount <= 0:
            warn(self, "Enter a receipt amount greater than zero.")
            return
        if amount > outstanding + 0.004:
            warn(self, f"Receipt amount cannot be more than the outstanding "
                       f"amount ({fmt_money(outstanding)}).")
            return
        receipts = list(self.invoice.get("receipts", []))
        receipts.append({"date": self.date.date().toString("yyyy-MM-dd"),
                         "amount": amount, "mode": self.mode.currentText(),
                         "note": self.note.text().strip()})
        self._store(receipts)

    def delete_receipt(self):
        row = self.table.currentRow()
        if row < 0:
            warn(self, "Select a receipt to delete.")
            return
        if not confirm(self, "Delete the selected receipt?"):
            return
        receipts = list(self.invoice.get("receipts", []))
        del receipts[row]
        self._store(receipts)

    def _store(self, receipts):
        try:
            updated = self.db.set_receipts(self.invoice["id"], receipts)
        except Exception as exc:
            warn(self, f"Could not save receipt:\n{exc}", "Error")
            return
        if updated:
            self.invoice = updated
        self.refresh()


# ---------- search ----------
class SearchDialog(QDialog):
    HEADERS = ["Invoice No", "Date", "Customer", "Mobile", "Total", "Received",
               "Outstanding", "Status"]

    def __init__(self, db, parent=None):
        super().__init__(parent)
        self.db = db
        self.selected_id = None
        self.deleted_ids = []
        self.setWindowTitle("Search Invoices")
        self.setMinimumSize(900, 520)

        self.text = QLineEdit()
        self.text.setPlaceholderText("Search by invoice no, customer name, mobile or GSTIN...")
        self.text.textChanged.connect(self.refresh)
        self.only_due = QCheckBox("Outstanding only")
        self.only_due.toggled.connect(self.refresh)
        self.use_dates = QCheckBox("Date from")
        self.use_dates.toggled.connect(self.refresh)
        self.date_from = date_edit()
        self.date_from.setDate(QDate.currentDate().addMonths(-1))
        self.date_to = date_edit()
        self.date_from.dateChanged.connect(self.refresh)
        self.date_to.dateChanged.connect(self.refresh)
        top = QHBoxLayout()
        top.addWidget(self.text, 1)
        top.addWidget(self.only_due)
        top.addWidget(self.use_dates)
        top.addWidget(self.date_from)
        top.addWidget(QLabel("to"))
        top.addWidget(self.date_to)

        self.table = QTableWidget()
        setup_table(self.table, self.HEADERS, 2)
        self.table.doubleClicked.connect(self.open_selected)
        self.count = QLabel()

        buttons = QHBoxLayout()
        buttons.addWidget(self.count)
        buttons.addStretch()
        buttons.addWidget(button("Open / Edit", self.open_selected))
        buttons.addWidget(button("Receipts", self.receipts, "light"))
        buttons.addWidget(button("Delete", self.delete_selected, "danger"))
        buttons.addWidget(button("Close", self.reject, "light"))

        layout = QVBoxLayout(self)
        layout.addLayout(top)
        layout.addWidget(self.table)
        layout.addLayout(buttons)
        self.refresh()

    def refresh(self):
        dates = self.use_dates.isChecked()
        rows = self.db.search(
            self.text.text(), self.only_due.isChecked(),
            self.date_from.date().toString("yyyy-MM-dd") if dates else "",
            self.date_to.date().toString("yyyy-MM-dd") if dates else "")
        self.table.setRowCount(len(rows))
        for r, inv in enumerate(rows):
            cust = inv.get("customer", {})
            values = [(inv.get("invoice_no", ""), False), (show_date(inv.get("date", "")), False),
                      (cust.get("name", ""), False), (cust.get("mobile", ""), False),
                      (fmt_money(inv.get("grand_total", 0)), True),
                      (fmt_money(inv.get("received_amount", 0)), True),
                      (fmt_money(inv.get("outstanding_amount", 0)), True),
                      (inv.get("payment_status", ""), False)]
            for c, (text, right) in enumerate(values):
                self.table.setItem(r, c, cell(text, right, inv["id"]))
        total = sum(i.get("outstanding_amount", 0) for i in rows)
        self.count.setText(f"{len(rows)} invoice(s)  |  Outstanding: {fmt_money(total)}")
        if rows:
            self.table.selectRow(0)

    def _current_id(self):
        row = self.table.currentRow()
        if row < 0 or self.table.item(row, 0) is None:
            warn(self, "Select an invoice first.")
            return None
        return self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)

    def open_selected(self, *_):
        invoice_id = self._current_id()
        if invoice_id:
            self.selected_id = invoice_id
            self.accept()

    def receipts(self):
        invoice_id = self._current_id()
        if invoice_id:
            ReceiptDialog(self.db, self.db.get(invoice_id), self).exec()
            self.refresh()

    def delete_selected(self):
        invoice_id = self._current_id()
        if not invoice_id:
            return
        inv = self.db.get(invoice_id)
        if confirm(self, f"Delete invoice {inv['invoice_no']} of "
                         f"{inv['customer'].get('name', '')}?\nThis cannot be undone."):
            self.db.delete_invoice(invoice_id)
            self.deleted_ids.append(invoice_id)
            self.refresh()


# ---------- preview + printing ----------
def temp_pdf_path(name="preview"):
    folder = os.path.join(tempfile.gettempdir(), "SmartBillingManager")
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, f"{name}_{datetime.now():%H%M%S%f}.pdf")


def print_pdf(pdf_path, printer):
    """Draw every page of the PDF on the printer - print matches the PDF exactly."""
    from PyQt6.QtPdf import QPdfDocument
    doc = QPdfDocument(None)
    doc.load(pdf_path)
    if doc.pageCount() < 1:
        raise RuntimeError("The invoice PDF could not be loaded for printing.")
    painter = QPainter()
    if not painter.begin(printer):
        raise RuntimeError("Could not start the printer.")
    try:
        target = painter.viewport()
        for page in range(doc.pageCount()):
            if page:
                printer.newPage()
            size = doc.pagePointSize(page)
            scale = min(target.width() / size.width(), target.height() / size.height())
            image = doc.render(page, QSize(int(size.width() * scale), int(size.height() * scale)))
            x = (target.width() - image.width()) / 2
            painter.fillRect(target, Qt.GlobalColor.white)
            painter.drawImage(QPointF(x, 0), image)
    finally:
        painter.end()
        doc.close()


class PreviewDialog(QDialog):
    """Shows the real invoice PDF pages, so preview = PDF = print."""

    def __init__(self, pdf_path, parent=None, on_print=None, on_export=None):
        super().__init__(parent)
        from PyQt6.QtPdf import QPdfDocument
        self.setWindowTitle("Invoice Preview")
        self.resize(860, 900)
        pages = QWidget()
        pages.setStyleSheet("background:#8A94A6;")
        column = QVBoxLayout(pages)
        column.setSpacing(12)
        doc = QPdfDocument(self)
        doc.load(pdf_path)
        for number in range(doc.pageCount()):
            size = doc.pagePointSize(number)
            scale = 1560 / size.width()          # render sharp, show at half size
            image = doc.render(number, QSize(1560, int(size.height() * scale)))
            page = QLabel()
            page.setPixmap(QPixmap.fromImage(image).scaledToWidth(
                780, Qt.TransformationMode.SmoothTransformation))
            page.setStyleSheet("background:#FFFFFF;")
            column.addWidget(page, 0, Qt.AlignmentFlag.AlignHCenter)
        column.addStretch()
        doc.close()
        scroll = QScrollArea()
        scroll.setWidget(pages)
        scroll.setWidgetResizable(True)
        buttons = QHBoxLayout()
        buttons.addStretch()
        if on_print:
            buttons.addWidget(button("Print", on_print))
        if on_export:
            buttons.addWidget(button("Export PDF", on_export))
        buttons.addWidget(button("Close", self.accept, "light"))
        layout = QVBoxLayout(self)
        layout.addWidget(scroll)
        layout.addLayout(buttons)
