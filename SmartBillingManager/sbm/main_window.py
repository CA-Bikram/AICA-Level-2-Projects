"""Main window: invoice entry form, item grid, totals and all actions."""
import os

from PyQt6.QtCore import QDate, Qt
from PyQt6.QtGui import QDoubleValidator, QKeySequence, QPageLayout, QPageSize, QShortcut
from PyQt6.QtWidgets import (QCheckBox, QComboBox, QDoubleSpinBox, QFileDialog,
                             QFrame, QGridLayout, QGroupBox, QHBoxLayout, QLabel,
                             QLineEdit, QMainWindow, QPlainTextEdit, QTableWidget,
                             QVBoxLayout, QWidget)

from . import APP_NAME, config
from .calculations import compute_item, compute_totals, fmt_money, fmt_qty, payment_status
from .dialogs import (GSTIN_RE, MOBILE_RE, PreviewDialog, ReceiptDialog,
                      SearchDialog, SellerDialog, button, cell, confirm,
                      date_edit, info, print_pdf, setup_table, temp_pdf_path, warn)
from .excel_export import export_bill_register, export_outstanding_register
from .pdf_generator import build_invoice_pdf

ITEM_HEADERS = ["#", "Item Name", "HSN/SAC", "Qty", "Rate", "GST %", "Amount", "GST", "Total"]


class MainWindow(QMainWindow):
    def __init__(self, db):
        super().__init__()
        self.db = db
        self.current_id = None      # id of the saved invoice being edited
        self.created_at = None
        self.items = []             # calculated line items
        self.receipts = []
        self.edit_index = None      # row being edited, None = adding
        self.dirty = False
        self._loading = False
        self.setWindowTitle(APP_NAME)
        self.resize(1220, 800)
        self._build_ui()
        self.new_invoice(ask=False)
        for message in db.warnings:
            warn(self, message, "Database notice")

    # ================= UI =================
    def _build_ui(self):
        root = QWidget()
        self.setCentralWidget(root)
        outer = QVBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        banner = QFrame()
        banner.setObjectName("banner")
        bl = QHBoxLayout(banner)
        bl.setContentsMargins(16, 9, 16, 9)
        title = QLabel(APP_NAME)
        title.setObjectName("appTitle")
        self.seller_title = QLabel()
        self.seller_title.setObjectName("sellerTitle")
        self.seller_title.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        bl.addWidget(title)
        bl.addWidget(self.seller_title, 1)
        outer.addWidget(banner)

        body = QVBoxLayout()
        body.setContentsMargins(12, 10, 12, 8)
        body.setSpacing(8)
        outer.addLayout(body, 1)

        # ---- action buttons ----
        bar = QHBoxLayout()
        bar.setSpacing(6)
        for text, slot, kind, tip in (
                ("New", self.new_invoice, None, "New invoice (Ctrl+N)"),
                ("Save", self.save_invoice, None, "Save invoice (Ctrl+S)"),
                ("Preview", self.preview_invoice, None, "Preview invoice"),
                ("Print", self.print_invoice, None, "Print invoice (Ctrl+P)"),
                ("Export PDF", self.export_pdf, None, "Save invoice as PDF in /invoices_pdf"),
                ("Search", self.search_invoices, None, "Search / open saved invoices (Ctrl+F)"),
                ("Receipts", self.open_receipts, "light", "Record full or part payment received"),
                ("Clear", self.clear_form, "light", "Clear the form"),
                ("Delete", self.delete_invoice, "danger", "Delete this saved invoice")):
            bar.addWidget(button(text, slot, kind, tip))
        bar.addStretch()
        bar.addWidget(button("Bill Register (Excel)", self.export_register, "light"))
        bar.addWidget(button("Outstanding Register (Excel)", self.export_outstanding, "light"))
        bar.addWidget(button("Seller Details", self.edit_seller, "light"))
        body.addLayout(bar)
        for keys, slot in (("Ctrl+N", self.new_invoice), ("Ctrl+S", self.save_invoice),
                           ("Ctrl+P", self.print_invoice), ("Ctrl+F", self.search_invoices)):
            QShortcut(QKeySequence(keys), self, activated=slot)

        # ---- invoice + customer ----
        top = QHBoxLayout()
        inv_box = QGroupBox("Invoice Details")
        g = QGridLayout(inv_box)
        self.invoice_no = QLineEdit()
        self.date = date_edit()
        self.interstate = QCheckBox("Inter-State supply (IGST)")
        self.round_off = QCheckBox("Round off grand total")
        self.round_off.setChecked(True)
        g.addWidget(QLabel("Invoice No *"), 0, 0)
        g.addWidget(self.invoice_no, 0, 1)
        g.addWidget(QLabel("Invoice Date *"), 1, 0)
        g.addWidget(self.date, 1, 1)
        g.addWidget(self.interstate, 2, 0, 1, 2)
        g.addWidget(self.round_off, 3, 0, 1, 2)
        top.addWidget(inv_box, 1)

        cust_box = QGroupBox("Customer Details")
        c = QGridLayout(cust_box)
        self.cust_name = QLineEdit()
        self.cust_mobile = QLineEdit()
        self.cust_mobile.setMaxLength(14)
        self.cust_gstin = QLineEdit()
        self.cust_gstin.setMaxLength(15)
        self.cust_gstin.setPlaceholderText("Optional")
        self.cust_address = QPlainTextEdit()
        self.cust_address.setFixedHeight(64)
        self.cust_address.setTabChangesFocus(True)
        c.addWidget(QLabel("Customer Name *"), 0, 0)
        c.addWidget(self.cust_name, 0, 1)
        c.addWidget(QLabel("Mobile"), 0, 2)
        c.addWidget(self.cust_mobile, 0, 3)
        c.addWidget(QLabel("Address"), 1, 0, Qt.AlignmentFlag.AlignTop)
        c.addWidget(self.cust_address, 1, 1, 2, 1)
        c.addWidget(QLabel("GSTIN"), 1, 2)
        c.addWidget(self.cust_gstin, 1, 3)
        c.setColumnStretch(1, 3)
        c.setColumnStretch(3, 2)
        top.addWidget(cust_box, 3)
        body.addLayout(top)

        # ---- items ----
        items_box = QGroupBox("Items")
        il = QVBoxLayout(items_box)
        entry = QHBoxLayout()
        self.item_name = QLineEdit()
        self.item_name.setPlaceholderText("Item name")
        self.item_hsn = QLineEdit()
        self.item_hsn.setPlaceholderText("HSN/SAC")
        self.item_hsn.setFixedWidth(95)
        self.item_qty = QDoubleSpinBox()
        self.item_qty.setRange(0, 9999999)
        self.item_qty.setDecimals(3)
        self.item_qty.setValue(1)
        self.item_rate = QDoubleSpinBox()
        self.item_rate.setRange(0, 999999999.99)
        self.item_rate.setDecimals(2)
        self.item_rate.setFixedWidth(120)
        self.item_gst = QComboBox()
        self.item_gst.setEditable(True)
        self.item_gst.addItems(["0", "5", "12", "18", "28", "40"])
        self.item_gst.setCurrentText("18")
        self.item_gst.setValidator(QDoubleValidator(0, 100, 2))
        self.item_gst.setFixedWidth(75)
        self.add_btn = button("Add Item", self.add_or_update_item)
        entry.addWidget(self.item_name, 1)
        entry.addWidget(self.item_hsn)
        for label, widget in (("Qty", self.item_qty), ("Rate", self.item_rate),
                              ("GST %", self.item_gst)):
            entry.addWidget(QLabel(label))
            entry.addWidget(widget)
        entry.addWidget(self.add_btn)
        self.cancel_edit_btn = button("Cancel Edit", self.reset_item_entry, "light")
        self.cancel_edit_btn.hide()
        entry.addWidget(self.cancel_edit_btn)
        il.addLayout(entry)
        self.item_name.returnPressed.connect(self.add_or_update_item)
        self.item_hsn.returnPressed.connect(self.add_or_update_item)

        self.table = QTableWidget()
        setup_table(self.table, ITEM_HEADERS, 1)
        self.table.doubleClicked.connect(lambda *_: self.edit_item())
        il.addWidget(self.table, 1)
        row_btns = QHBoxLayout()
        row_btns.addWidget(button("Edit Selected Item", self.edit_item, "light"))
        row_btns.addWidget(button("Delete Selected Item", self.delete_item, "danger"))
        row_btns.addStretch()
        self.item_count = QLabel()
        row_btns.addWidget(self.item_count)
        il.addLayout(row_btns)
        body.addWidget(items_box, 1)

        # ---- totals ----
        bottom = QHBoxLayout()
        pay_box = QGroupBox("Payment Status")
        pl = QGridLayout(pay_box)
        self.lbl_status = QLabel("-")
        self.lbl_received = QLabel("0.00")
        self.lbl_due = QLabel("0.00")
        self.lbl_due.setObjectName("dueValue")
        self.lbl_last = QLabel("-")
        for r, (text, widget) in enumerate((("Status", self.lbl_status),
                                            ("Received", self.lbl_received),
                                            ("Outstanding", self.lbl_due),
                                            ("Last Receipt Date", self.lbl_last))):
            pl.addWidget(QLabel(text), r, 0)
            widget.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            pl.addWidget(widget, r, 1)
        pl.setColumnMinimumWidth(1, 150)
        bottom.addWidget(pay_box, 1)
        bottom.addStretch(2)

        tot_box = QGroupBox("Invoice Totals")
        tot_box.setObjectName("totalsBox")
        tl = QGridLayout(tot_box)
        self.tot = {}
        rows = (("subtotal", "Subtotal"), ("cgst", "CGST"), ("sgst", "SGST"),
                ("igst", "IGST"), ("total_gst", "Total GST"), ("round_off", "Round Off"))
        for r, (key, text) in enumerate(rows):
            self.tot[key] = QLabel("0.00")
            tl.addWidget(QLabel(text), r, 0)
            self.tot[key].setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            tl.addWidget(self.tot[key], r, 1)
        grand_label = QLabel("Grand Total")
        grand_label.setObjectName("grandLabel")
        self.tot["grand_total"] = QLabel("0.00")
        self.tot["grand_total"].setObjectName("grandValue")
        tl.addWidget(grand_label, len(rows), 0)
        self.tot["grand_total"].setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        tl.addWidget(self.tot["grand_total"], len(rows), 1)
        tl.setColumnMinimumWidth(1, 170)
        bottom.addWidget(tot_box, 2)
        body.addLayout(bottom)

        # change tracking
        for w in (self.invoice_no, self.cust_name, self.cust_mobile, self.cust_gstin):
            w.textChanged.connect(self._mark_dirty)
        self.cust_address.textChanged.connect(self._mark_dirty)
        self.date.dateChanged.connect(self._mark_dirty)
        self.interstate.toggled.connect(self._on_tax_option)
        self.round_off.toggled.connect(self._on_tax_option)
        self._refresh_seller_title()
        self.statusBar().showMessage("Ready")

    # ================= helpers =================
    def _mark_dirty(self, *_):
        if not self._loading:
            self.dirty = True

    def _on_tax_option(self, *_):
        self._mark_dirty()
        self.refresh_totals()

    def _refresh_seller_title(self):
        name = self.db.seller.get("trade_name")
        self.seller_title.setText(name or "Seller details not set - click 'Seller Details'")

    def _totals(self):
        return compute_totals(self.items, self.round_off.isChecked(), self.interstate.isChecked())

    def refresh_items(self):
        self.table.setRowCount(len(self.items))
        for r, it in enumerate(self.items):
            values = [(r + 1, False), (it["name"], False), (it.get("hsn", ""), False),
                      (fmt_qty(it["qty"]), True), (fmt_money(it["rate"]), True),
                      (f"{it['gst_pct']:g}", True), (fmt_money(it["amount"]), True),
                      (fmt_money(it["gst_amount"]), True), (fmt_money(it["total"]), True)]
            for c, (text, right) in enumerate(values):
                self.table.setItem(r, c, cell(text, right))
        self.item_count.setText(f"{len(self.items)} item(s)")
        self.refresh_totals()

    def refresh_totals(self):
        totals = self._totals()
        for key in ("subtotal", "cgst", "sgst", "igst", "total_gst", "grand_total"):
            self.tot[key].setText(fmt_money(totals[key]))
        self.tot["round_off"].setText(f"{totals['round_off']:+.2f}")
        received, due, status = payment_status(totals["grand_total"], self.receipts)
        self.lbl_status.setText(status if self.current_id else "Not saved yet")
        self.lbl_received.setText(fmt_money(received))
        self.lbl_due.setText(fmt_money(due))
        dates = [r.get("date", "") for r in self.receipts]
        self.lbl_last.setText(
            QDate.fromString(max(dates), "yyyy-MM-dd").toString("dd-MM-yyyy") if dates else "-")

    def _confirm_discard(self):
        return (not self.dirty) or confirm(
            self, "You have unsaved changes. Discard them?", "Unsaved changes")

    # ================= item actions =================
    def reset_item_entry(self):
        self.edit_index = None
        self.item_name.clear()
        self.item_hsn.clear()
        self.item_qty.setValue(1)
        self.item_rate.setValue(0)
        self.add_btn.setText("Add Item")
        self.cancel_edit_btn.hide()
        self.item_name.setFocus()

    def add_or_update_item(self):
        name = self.item_name.text().strip()
        gst_text = self.item_gst.currentText().strip() or "0"
        try:
            gst = float(gst_text)
        except ValueError:
            gst = -1
        if not name:
            warn(self, "Item Name is required.")
            self.item_name.setFocus()
            return
        if self.item_qty.value() <= 0:
            warn(self, "Quantity must be greater than zero.")
            self.item_qty.setFocus()
            return
        if self.item_rate.value() <= 0:
            warn(self, "Rate must be greater than zero.")
            self.item_rate.setFocus()
            return
        if not 0 <= gst <= 100:
            warn(self, "GST % must be between 0 and 100.")
            self.item_gst.setFocus()
            return
        item = compute_item(name, self.item_hsn.text(), self.item_qty.value(),
                            self.item_rate.value(), gst)
        if self.edit_index is None:
            self.items.append(item)
        else:
            self.items[self.edit_index] = item
        self._mark_dirty()
        self.reset_item_entry()
        self.refresh_items()
        self.table.scrollToBottom()

    def edit_item(self):
        row = self.table.currentRow()
        if row < 0 or row >= len(self.items):
            warn(self, "Select an item to edit.")
            return
        it = self.items[row]
        self.edit_index = row
        self.item_name.setText(it["name"])
        self.item_hsn.setText(it.get("hsn", ""))
        self.item_qty.setValue(it["qty"])
        self.item_rate.setValue(it["rate"])
        self.item_gst.setCurrentText(f"{it['gst_pct']:g}")
        self.add_btn.setText("Update Item")
        self.cancel_edit_btn.show()
        self.item_name.setFocus()

    def delete_item(self):
        row = self.table.currentRow()
        if row < 0 or row >= len(self.items):
            warn(self, "Select an item to delete.")
            return
        if confirm(self, f"Delete item '{self.items[row]['name']}'?"):
            del self.items[row]
            self._mark_dirty()
            self.reset_item_entry()
            self.refresh_items()

    # ================= form <-> invoice =================
    def _reset_form(self, invoice_no):
        self._loading = True
        self.current_id = None
        self.created_at = None
        self.items, self.receipts = [], []
        self.invoice_no.setText(invoice_no)
        self.date.setDate(QDate.currentDate())
        self.cust_name.clear()
        self.cust_mobile.clear()
        self.cust_gstin.clear()
        self.cust_address.clear()
        self.interstate.setChecked(False)
        self.round_off.setChecked(True)
        self._loading = False
        self.dirty = False
        self.reset_item_entry()
        self.refresh_items()
        self.cust_name.setFocus()

    def new_invoice(self, *_, ask=True):
        if ask and not self._confirm_discard():
            return
        self._reset_form(self.db.next_invoice_no())
        self.statusBar().showMessage("New invoice")

    def clear_form(self):
        """Clear all entries but stay on the same invoice (number is kept)."""
        if not confirm(self, "Clear all details entered in this form?"):
            return
        keep_id, keep_no = self.current_id, self.invoice_no.text()
        keep_created, keep_receipts = self.created_at, self.receipts
        self._reset_form(keep_no)
        self.current_id, self.created_at, self.receipts = keep_id, keep_created, keep_receipts
        self.dirty = bool(keep_id)
        self.refresh_totals()
        self.statusBar().showMessage("Form cleared")

    def load_invoice(self, inv):
        self._loading = True
        self.current_id = inv["id"]
        self.created_at = inv.get("created_at")
        self.items = [dict(i) for i in inv.get("items", [])]
        self.receipts = [dict(r) for r in inv.get("receipts", [])]
        cust = inv.get("customer", {})
        self.invoice_no.setText(str(inv.get("invoice_no", "")))
        self.date.setDate(QDate.fromString(inv.get("date", ""), "yyyy-MM-dd"))
        self.cust_name.setText(cust.get("name", ""))
        self.cust_mobile.setText(cust.get("mobile", ""))
        self.cust_gstin.setText(cust.get("gstin", ""))
        self.cust_address.setPlainText(cust.get("address", ""))
        self.interstate.setChecked(bool(inv.get("interstate")))
        self.round_off.setChecked(bool(inv.get("round_off_enabled", True)))
        self._loading = False
        self.dirty = False
        self.reset_item_entry()
        self.refresh_items()
        self.statusBar().showMessage(f"Opened invoice {inv.get('invoice_no', '')}")

    def build_invoice(self):
        """Validate the form. Returns the invoice dict or None."""
        number = self.invoice_no.text().strip()
        name = self.cust_name.text().strip()
        mobile = self.cust_mobile.text().strip().replace(" ", "")
        gstin = self.cust_gstin.text().strip().upper()
        problem = focus = None
        if not number:
            problem, focus = "Invoice No is required.", self.invoice_no
        elif self.db.number_exists(number, self.current_id):
            problem, focus = f"Invoice No '{number}' is already used.", self.invoice_no
        elif not self.date.date().isValid():
            problem, focus = "Invoice Date is not valid.", self.date
        elif not name:
            problem, focus = "Customer Name is required.", self.cust_name
        elif mobile and not MOBILE_RE.match(mobile):
            problem, focus = "Mobile number must have 10 digits.", self.cust_mobile
        elif gstin and not GSTIN_RE.match(gstin):
            problem, focus = ("Customer GSTIN is not valid. It must be 15 characters, "
                              "e.g. 27ABCDE1234F1Z5 (or leave it blank)."), self.cust_gstin
        elif not self.items:
            problem, focus = "Add at least one item.", self.item_name
        if problem:
            warn(self, problem)
            focus.setFocus()
            return None
        invoice = {
            "id": self.current_id,
            "invoice_no": number,
            "date": self.date.date().toString("yyyy-MM-dd"),
            "customer": {"name": name, "address": self.cust_address.toPlainText().strip(),
                         "mobile": mobile, "gstin": gstin},
            "interstate": self.interstate.isChecked(),
            "round_off_enabled": self.round_off.isChecked(),
            "items": [dict(i) for i in self.items],
            "receipts": [dict(r) for r in self.receipts],
        }
        invoice.update(self._totals())
        received, due, status = payment_status(invoice["grand_total"], invoice["receipts"])
        invoice.update(received_amount=received, outstanding_amount=due, payment_status=status)
        if self.created_at:
            invoice["created_at"] = self.created_at
        return invoice

    # ================= main actions =================
    def save_invoice(self, *_):
        invoice = self.build_invoice()
        if not invoice:
            return None
        if invoice["outstanding_amount"] < -0.004 and not confirm(
                self, "Amount already received is more than the new invoice total. Save anyway?"):
            return None
        try:
            saved = self.db.save_invoice(invoice)
        except Exception as exc:
            warn(self, f"Could not save the invoice:\n{exc}", "Error")
            return None
        self.current_id = saved["id"]
        self.created_at = saved.get("created_at")
        self._loading = True
        self.cust_gstin.setText(saved["customer"]["gstin"])
        self.cust_mobile.setText(saved["customer"]["mobile"])
        self._loading = False
        self.dirty = False
        self.refresh_totals()
        self.statusBar().showMessage(f"Invoice {saved['invoice_no']} saved", 6000)
        return saved

    def _saved_invoice(self):
        """Return the saved invoice, saving first when there are changes."""
        if self.current_id and not self.dirty:
            return self.db.get(self.current_id)
        return self.save_invoice()

    def _check_seller(self):
        if not self.db.seller.get("trade_name"):
            info(self, "Please enter your business (seller) details first. "
                       "They are printed on the invoice header.")
            self.edit_seller()
        return True

    def _make_pdf(self, invoice, path):
        return build_invoice_pdf(invoice, self.db.seller, path, self.db.logo_path())

    def preview_invoice(self):
        invoice = self.build_invoice()
        if not invoice:
            return
        try:
            path = self._make_pdf(invoice, temp_pdf_path())
            dialog = PreviewDialog(path, self, on_print=self.print_invoice,
                                   on_export=self.export_pdf)
        except Exception as exc:
            warn(self, f"Could not create the preview:\n{exc}", "Error")
            return
        dialog.exec()

    def export_pdf(self, *_):
        self._check_seller()
        invoice = self._saved_invoice()
        if not invoice:
            return None
        name = (f"{config.safe_filename(invoice['invoice_no'])}_"
                f"{config.safe_filename(invoice['customer']['name'])[:40]}.pdf")
        path = str(config.PDF_DIR / name)
        try:
            config.ensure_folders()
            self._make_pdf(invoice, path)
        except PermissionError:
            warn(self, f"Could not write the PDF. Close it if it is open in another program:\n{path}")
            return None
        except Exception as exc:
            warn(self, f"Could not create the PDF:\n{exc}", "Error")
            return None
        self.statusBar().showMessage(f"PDF saved: {path}", 8000)
        if confirm(self, f"PDF saved to:\n{path}\n\nOpen it now?", "PDF exported"):
            config.open_file(path)
        return path

    def print_invoice(self, *_):
        self._check_seller()
        invoice = self._saved_invoice()
        if not invoice:
            return
        try:
            from PyQt6.QtPrintSupport import QPrintDialog, QPrinter
            path = self._make_pdf(invoice, temp_pdf_path("print"))
            printer = QPrinter(QPrinter.PrinterMode.HighResolution)
            printer.setPageSize(QPageSize(QPageSize.PageSizeId.A4))
            printer.setPageOrientation(QPageLayout.Orientation.Portrait)
            printer.setFullPage(True)
            printer.setDocName(f"Invoice {invoice['invoice_no']}")
            dialog = QPrintDialog(printer, self)
            if dialog.exec() != QPrintDialog.DialogCode.Accepted:
                return
            print_pdf(path, printer)
            self.statusBar().showMessage(f"Invoice {invoice['invoice_no']} sent to printer", 6000)
        except Exception as exc:
            warn(self, f"Printing failed:\n{exc}\n\nYou can use Export PDF and print the PDF.", "Error")

    def search_invoices(self, *_):
        dialog = SearchDialog(self.db, self)
        accepted = dialog.exec()
        if self.current_id and self.current_id in dialog.deleted_ids:
            self.new_invoice(ask=False)
        elif self.current_id:                      # receipts may have changed
            fresh = self.db.get(self.current_id)
            if fresh:
                self.receipts = fresh.get("receipts", [])
                self.refresh_totals()
        if accepted and dialog.selected_id:
            if dialog.selected_id != self.current_id and not self._confirm_discard():
                return
            invoice = self.db.get(dialog.selected_id)
            if invoice:
                self.load_invoice(invoice)

    def open_receipts(self):
        invoice = self._saved_invoice()
        if not invoice:
            return
        ReceiptDialog(self.db, invoice, self).exec()
        fresh = self.db.get(invoice["id"])
        if fresh:
            self.receipts = fresh.get("receipts", [])
            self.refresh_totals()

    def delete_invoice(self):
        if not self.current_id:
            warn(self, "This invoice is not saved yet. Use Search to pick a saved "
                       "invoice, or Clear to empty the form.")
            return
        if confirm(self, f"Delete invoice {self.invoice_no.text()} permanently?\n"
                         "This cannot be undone."):
            try:
                self.db.delete_invoice(self.current_id)
            except Exception as exc:
                warn(self, f"Could not delete the invoice:\n{exc}", "Error")
                return
            self.new_invoice(ask=False)
            self.statusBar().showMessage("Invoice deleted", 6000)

    def edit_seller(self):
        if SellerDialog(self.db, self).exec():
            self._refresh_seller_title()
            if not self.current_id and not self.items and not self.dirty:
                self._reset_form(self.db.next_invoice_no())
            self.statusBar().showMessage("Seller details saved", 6000)

    def _export_excel(self, title, default_name, exporter, invoices):
        if not invoices:
            info(self, "There are no invoices to export.")
            return None
        config.ensure_folders()
        stamp = QDate.currentDate().toString("yyyy-MM-dd")
        path, _ = QFileDialog.getSaveFileName(
            self, title, str(config.EXPORT_DIR / f"{default_name}_{stamp}.xlsx"),
            "Excel Workbook (*.xlsx)")
        if not path:
            return None
        if not path.lower().endswith(".xlsx"):
            path += ".xlsx"
        try:
            exporter(invoices, path, self.db.seller.get("trade_name", ""))
        except PermissionError:
            warn(self, "Could not write the file. Close it in Excel and try again.")
            return None
        except Exception as exc:
            warn(self, f"Export failed:\n{exc}", "Error")
            return None
        if confirm(self, f"Saved to:\n{path}\n\nOpen it now?", "Excel exported"):
            config.open_file(path)
        return path

    def export_register(self):
        return self._export_excel("Save Bill Register", "Bill_Register",
                                  export_bill_register, self.db.search())

    def export_outstanding(self):
        return self._export_excel("Save Outstanding Register", "Outstanding_Register",
                                  export_outstanding_register, self.db.outstanding_invoices())

    def closeEvent(self, event):
        if self._confirm_discard():
            event.accept()
        else:
            event.ignore()
