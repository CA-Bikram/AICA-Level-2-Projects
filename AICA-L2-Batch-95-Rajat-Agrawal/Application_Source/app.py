"""Form 35 Appeal Assistant - desktop app for Chartered Accountants.

Load the assessment order (plus computation sheet / demand notice / client
computation if available), review the auto-filled Form No. 35, and export it
as PDF.

Run:  python app.py
"""
import json
import os
import re
import sys
from datetime import timedelta

from PyQt6.QtCore import Qt, QTimer, QUrl
from PyQt6.QtGui import QAction, QColor, QDesktopServices, QFont, QKeySequence, QPalette
from PyQt6.QtWidgets import (QApplication, QComboBox, QFileDialog, QFormLayout, QFrame, QHBoxLayout,
                             QLabel, QLineEdit, QListWidget, QListWidgetItem, QMainWindow, QMessageBox,
                             QPlainTextEdit, QPushButton, QScrollArea, QSplitter, QTabWidget, QToolBar,
                             QVBoxLayout, QWidget)

import drafting
import extractor
from data_models import FIELDS, SECTIONS, AppealData
from pdf_export import export_form35
from ai_dialog import AIDraftDialog
from validation import validate_export
from document_export import export_narratives

APP_NAME = "Form 35 Appeal Assistant v2"
SRC_USER = "Edited by user"
AMOUNT_KEYS = {"income_assessed", "total_addition", "loss_disallowance", "disputed_addition", "disputed_demand",
               "penalty_amount", "penalty_disputed", "total_tax_paid", "returned_income", "tds_credit"}
WORD_LIMITS = {"statement_of_facts": 1000, "condonation_grounds": 500}

QSS = """
QMainWindow, QWidget#page { background: #f5f6f8; }
QToolBar { background: #ffffff; border-bottom: 1px solid #dde1e7; spacing: 6px; padding: 6px; }
QToolBar QToolButton { padding: 6px 12px; border-radius: 6px; color: #1f2937; }
QToolBar QToolButton:hover { background: #eef2f7; }
QToolBar QToolButton#primary { background: #1e3a8a; color: white; font-weight: 600; }
QToolBar QToolButton#primary:hover { background: #1d4ed8; }
QFrame#card { background: #ffffff; border: 1px solid #dde1e7; border-radius: 8px; }
QLabel#title { font-size: 16px; font-weight: 600; color: #111827; }
QLabel#muted { color: #6b7280; }
QLabel#kpiLabel { color: #6b7280; font-size: 11px; }
QLabel#kpiValue { color: #111827; font-size: 14px; font-weight: 600; }
QLabel#paneTitle { font-weight: 600; color: #374151; padding: 2px 0; }
QTabWidget::pane { border: 1px solid #dde1e7; background: #ffffff; border-radius: 6px; }
QTabBar::tab { padding: 7px 14px; color: #4b5563; }
QTabBar::tab:selected { color: #1e3a8a; font-weight: 600; border-bottom: 2px solid #1e3a8a; }
QLineEdit, QPlainTextEdit, QComboBox { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 5px;
    padding: 5px; color: #111827; selection-background-color: #bfdbfe; }
QLineEdit:focus, QPlainTextEdit:focus, QComboBox:focus { border: 1px solid #2563eb; }
*[state="extracted"] { background: #ecfdf3; border: 1px solid #86efac; }
*[state="drafted"] { background: #fffbeb; border: 1px solid #fcd34d; }
*[state="missing"] { background: #fef2f2; border: 1px solid #fca5a5; }
QListWidget { background: #ffffff; border: 1px solid #dde1e7; border-radius: 6px; }
QListWidget::item { padding: 6px; }
QListWidget::item:selected { background: #dbeafe; color: #111827; }
QPushButton { padding: 5px 12px; border: 1px solid #cbd5e1; border-radius: 5px; background: #ffffff; }
QPushButton:hover { background: #eef2f7; }
QLabel.legend { padding: 1px 6px; border-radius: 3px; }
"""


def word_count(s: str) -> int:
    return len(re.findall(r"\S+", s or ""))


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.resize(1400, 880)
        self.setAcceptDrops(True)

        self.docs = []            # list[extractor.ExtractedDoc]
        self.hints = {}
        self.data = AppealData()
        self.draft_path = None
        self.widgets = {}         # key -> QLineEdit | QComboBox | QPlainTextEdit
        self.counters = {}        # key -> QLabel word counter
        self._loading = False

        self._build_toolbar()
        self._build_body()
        self._refresh_all()
        self.statusBar().showMessage("Load one or more assessment PDFs to begin (or drag & drop them here).")

    # ------------------------------------------------------------------ UI

    def _build_toolbar(self):
        tb = QToolBar("Main")
        tb.setMovable(False)
        self.addToolBar(tb)

        def act(text, slot, shortcut=None, tip=""):
            a = QAction(text, self)
            a.triggered.connect(slot)
            if shortcut:
                a.setShortcut(QKeySequence(shortcut))
            a.setToolTip(tip or text)
            tb.addAction(a)
            return a

        act("New case", self.new_case, "Ctrl+N")
        act("Load PDFs…", self.load_pdfs_dialog, "Ctrl+O",
            "Load assessment order, computation sheet, demand notice, client computation")
        tb.addSeparator()
        act("Regenerate drafts", self.regenerate_drafts, "F5",
            "Rebuild facts, grounds, fee, delay and other derived fields (fields you edited are kept)")
        tb.addSeparator()
        act("AI draft (local)", self.generate_ai_draft)
        act("Export facts / grounds", self.export_narratives)
        act("Open draft…", self.open_draft)
        act("Save draft", self.save_draft, "Ctrl+S")
        tb.addSeparator()
        export = act("Export Form 35 PDF", self.export_pdf, "Ctrl+E")
        tb.widgetForAction(export).setObjectName("primary")

    def _build_body(self):
        page = QWidget(objectName="page")
        outer = QVBoxLayout(page)
        outer.setContentsMargins(12, 12, 12, 8)
        outer.setSpacing(10)
        outer.addWidget(self._build_summary_card())

        split = QSplitter(Qt.Orientation.Horizontal)
        split.addWidget(self._build_left_pane())
        split.addWidget(self._build_form_tabs())
        split.setStretchFactor(0, 0)
        split.setStretchFactor(1, 1)
        split.setSizes([400, 1000])
        outer.addWidget(split, 1)

        legend = QHBoxLayout()
        legend.addStretch(1)
        for text, bg, bd in (("Extracted from PDF", "#ecfdf3", "#86efac"),
                             ("Drafted / derived - review", "#fffbeb", "#fcd34d"),
                             ("Required - missing", "#fef2f2", "#fca5a5")):
            lb = QLabel(text)
            lb.setStyleSheet(f"background:{bg}; border:1px solid {bd}; border-radius:3px; padding:2px 8px;")
            legend.addWidget(lb)
        outer.addLayout(legend)
        self.setCentralWidget(page)

    def _build_summary_card(self):
        card = QFrame(objectName="card")
        lay = QHBoxLayout(card)
        lay.setContentsMargins(16, 12, 16, 12)
        left = QVBoxLayout()
        self.lbl_title = QLabel("No case loaded", objectName="title")
        self.lbl_sub = QLabel("", objectName="muted")
        left.addWidget(self.lbl_title)
        left.addWidget(self.lbl_sub)
        lay.addLayout(left, 1)
        self.kpis = {}
        for key, label in (("ay", "Assessment year"), ("assessed", "Income assessed"),
                           ("addition", "Addition disputed"), ("demand", "Disputed demand"),
                           ("due", "Appeal due by"), ("review", "Fields to review")):
            box = QVBoxLayout()
            box.setSpacing(0)
            l1 = QLabel(label, objectName="kpiLabel")
            l2 = QLabel("-", objectName="kpiValue")
            box.addWidget(l1)
            box.addWidget(l2)
            lay.addSpacing(18)
            lay.addLayout(box)
            self.kpis[key] = l2
        return card

    def _build_left_pane(self):
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(QLabel("Source documents", objectName="paneTitle"))
        self.doc_list = QListWidget()
        self.doc_list.setMaximumHeight(150)
        self.doc_list.currentRowChanged.connect(self._show_doc_text)
        lay.addWidget(self.doc_list)
        row = QHBoxLayout()
        b_add = QPushButton("Add PDFs…")
        b_add.clicked.connect(self.load_pdfs_dialog)
        b_rm = QPushButton("Remove selected")
        b_rm.clicked.connect(self.remove_selected_doc)
        row.addWidget(b_add)
        row.addWidget(b_rm)
        row.addStretch(1)
        lay.addLayout(row)

        self.left_tabs = QTabWidget()
        self.doc_text = QPlainTextEdit(readOnly=True)
        self.doc_text.setFont(QFont("Consolas", 9))
        self.doc_text.setPlaceholderText("Extracted text of the selected document appears here.")
        self.log_view = QPlainTextEdit(readOnly=True)
        self.log_view.setFont(QFont("Consolas", 9))
        self.left_tabs.addTab(self.doc_text, "Document text")
        self.left_tabs.addTab(self.log_view, "Extraction log")
        lay.addWidget(self.left_tabs, 1)
        return w

    def _build_form_tabs(self):
        self.tabs = QTabWidget()
        short = {
            SECTIONS[0]: "1. Personal", SECTIONS[1]: "2. Order", SECTIONS[2]: "3. Appeal details",
            SECTIONS[3]: "4. Taxes paid", SECTIONS[4]: "5. Facts && grounds", SECTIONS[5]: "6. Filing",
            SECTIONS[6]: "7. Verification", SECTIONS[7]: "Reference",
        }
        for section in SECTIONS:
            inner = QWidget()
            form = QFormLayout(inner)
            form.setContentsMargins(18, 16, 18, 16)
            form.setHorizontalSpacing(16)
            form.setVerticalSpacing(9)
            form.setLabelAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignTop)
            form.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.AllNonFixedFieldsGrow)
            head = QLabel(section, objectName="title")
            form.addRow(head)
            if section == SECTIONS[7]:
                form.addRow(QLabel("Figures read from the documents for cross-checking. Not printed on Form 35.",
                                   objectName="muted"))
            for f in (x for x in FIELDS if x.section == section):
                wdg = self._make_widget(f)
                label = QLabel((f"{f.row}.  " if f.row else "") + f.label + (" *" if f.required else ""))
                label.setWordWrap(True)
                label.setMinimumWidth(260)
                label.setMaximumWidth(340)
                if f.kind == "multiline":
                    box = QVBoxLayout()
                    box.addWidget(wdg)
                    cnt = QLabel("", objectName="muted")
                    self.counters[f.key] = cnt
                    box.addWidget(cnt)
                    form.addRow(label, box)
                else:
                    form.addRow(label, wdg)
            scroll = QScrollArea()
            scroll.setWidgetResizable(True)
            scroll.setFrameShape(QFrame.Shape.NoFrame)
            scroll.setWidget(inner)
            self.tabs.addTab(scroll, short[section])
        return self.tabs

    def _make_widget(self, f):
        if f.kind == "choice":
            w = QComboBox()
            w.addItems(f.choices or [])
            w.currentTextChanged.connect(lambda _t, k=f.key: self._on_edit(k))
        elif f.kind == "multiline":
            w = QPlainTextEdit()
            big = f.key in ("statement_of_facts", "grounds_of_appeal")
            w.setMinimumHeight(300 if big else 110)
            w.textChanged.connect(lambda k=f.key: self._on_edit(k))
        else:
            w = QLineEdit()
            w.textEdited.connect(lambda _t, k=f.key: self._on_edit(k))
            if f.key in AMOUNT_KEYS:
                w.editingFinished.connect(lambda k=f.key: self._format_amount(k))
        self.widgets[f.key] = w
        return w

    # ------------------------------------------------------- widget <-> data

    def _widget_value(self, key):
        w = self.widgets[key]
        if isinstance(w, QComboBox):
            return w.currentText()
        if isinstance(w, QPlainTextEdit):
            return w.toPlainText()
        return w.text()

    def _set_widget(self, key, value):
        w = self.widgets[key]
        if isinstance(w, QComboBox):
            if value and w.findText(value) < 0:
                w.addItem(value)
            w.setCurrentText(value or "")
        elif isinstance(w, QPlainTextEdit):
            w.setPlainText(value or "")
        else:
            w.setText(value or "")
            w.setCursorPosition(0)

    def _state_for(self, key):
        spec = next(f for f in FIELDS if f.key == key)
        val = self.data.get(key).strip()
        src = self.data.sources.get(key, "")
        if not val:
            return "missing" if spec.required else ""
        if src.startswith(("Derived", "Drafted", "Default")):
            return "drafted"
        if src and src != SRC_USER:
            return "extracted"
        return ""

    def _apply_style(self, key):
        w = self.widgets[key]
        w.setProperty("state", self._state_for(key))
        w.style().unpolish(w)
        w.style().polish(w)
        src = self.data.sources.get(key)
        w.setToolTip(f"Source: {src}" if src else "")

    def _refresh_all(self):
        self._loading = True
        try:
            for f in FIELDS:
                self._set_widget(f.key, self.data.get(f.key))
                self._apply_style(f.key)
        finally:
            self._loading = False
        for k in self.counters:
            self._update_counter(k)
        self._refresh_summary()

    def _on_edit(self, key):
        if self._loading:
            return
        self.data.set(key, self._widget_value(key), SRC_USER)
        if key not in {"drafts_reviewed", "service_confirmed", "ai_review_notes"}:
            self.data.set("drafts_reviewed", "No", SRC_USER)
            self._loading = True
            self._set_widget("drafts_reviewed", "No")
            self._loading = False
        if key == "service_date":
            self.data.set("service_confirmed", "No", SRC_USER)
            self._loading = True
            self._set_widget("service_confirmed", "No")
            self._loading = False
        if key in {"service_date", "verification_date"}:
            delay = drafting.compute_delay(self.data)
            self.data.set("delay", "Yes" if delay is not None and delay > 0 else "No" if delay is not None else "", "Derived - verify")
            if self.data.sources.get("condonation_grounds", "").startswith(("Drafted", "Derived")):
                self.data.set("condonation_grounds", drafting.draft_condonation(self.data) if delay is not None and delay > 0 else "", "Drafted - review & edit")
            self._refresh_all()
        self._apply_style(key)
        if key in self.counters:
            self._update_counter(key)
        self._refresh_summary()

    def _format_amount(self, key):
        val = self.data.get(key)
        n = extractor.to_int(val)
        if n is not None and re.fullmatch(r"-?[\d,\s]+", val.strip()):
            self._loading = True
            self.data.values[key] = extractor.indian_format(n)
            self._set_widget(key, self.data.get(key))
            self._loading = False

    def _update_counter(self, key):
        text = self.data.get(key)
        lbl = self.counters[key]
        if key == "grounds_of_appeal":
            grounds = [g for g in re.split(r"\n\s*\n", text) if g.strip()]
            over = [i + 1 for i, g in enumerate(grounds) if word_count(g) > 100]
            msg = f"{len(grounds)} grounds"
            if over:
                msg += f"  -  ground(s) {', '.join(map(str, over))} exceed 100 words"
            lbl.setText(msg)
            lbl.setStyleSheet("color:#b91c1c;" if over else "")
        elif key in WORD_LIMITS:
            n, lim = word_count(text), WORD_LIMITS[key]
            lbl.setText(f"{n} / {lim} words")
            lbl.setStyleSheet("color:#b91c1c;" if n > lim else "")
        else:
            lbl.setText("")

    def _refresh_summary(self):
        d = self.data
        name = d.assessee_name
        self.lbl_title.setText(name or "No case loaded")
        bits = [f"PAN {d.get('pan')}" if d.get("pan") else "",
                f"Order u/s {d.get('order_section')}" if d.get("order_section") else "",
                f"dated {d.get('order_date')}" if d.get("order_date") else "",
                f"Appeal u/s {d.get('appeal_section')}" if d.get("appeal_section") else ""]
        self.lbl_sub.setText("   ·   ".join(b for b in bits if b))
        self.kpis["ay"].setText(d.get("assessment_year") or "-")
        self.kpis["assessed"].setText(f"₹ {d.get('income_assessed')}" if d.get("income_assessed") else "-")
        self.kpis["addition"].setText(f"₹ {d.get('disputed_addition')}" if d.get("disputed_addition") else "-")
        self.kpis["demand"].setText(f"₹ {d.get('disputed_demand')}" if d.get("disputed_demand") else "-")

        served = drafting.parse_date(d.get("service_date"))
        due_lbl = self.kpis["due"]
        if served:
            due = served + timedelta(days=drafting.APPEAL_LIMIT_DAYS)
            delay = drafting.compute_delay(d)
            if delay and delay > 0:
                due_lbl.setText(f"{drafting.fmt_date(due)}  (late {delay}d)")
                due_lbl.setStyleSheet("color:#b91c1c;")
            else:
                due_lbl.setText(f"{drafting.fmt_date(due)}  ({-delay}d left)" if delay is not None
                                else drafting.fmt_date(due))
                due_lbl.setStyleSheet("color:#047857;")
        else:
            due_lbl.setText("-")
            due_lbl.setStyleSheet("")

        states = [self._state_for(f.key) for f in FIELDS if f.printed]
        n_draft, n_missing = states.count("drafted"), states.count("missing")
        self.kpis["review"].setText(f"{n_draft} drafted · {n_missing} missing")
        self.kpis["review"].setStyleSheet("color:#b91c1c;" if n_missing else "")

    # ------------------------------------------------------------- actions

    def new_case(self):
        if self.docs and QMessageBox.question(self, APP_NAME, "Discard the current case?") \
                != QMessageBox.StandardButton.Yes:
            return
        self.docs, self.hints, self.data, self.draft_path = [], {}, AppealData(), None
        self.doc_list.clear()
        self.doc_text.clear()
        self.log_view.clear()
        self._refresh_all()
        self.setWindowTitle(APP_NAME)

    def load_pdfs_dialog(self):
        paths, _ = QFileDialog.getOpenFileNames(self, "Select assessment order and related PDFs",
                                                os.getcwd(), "PDF files (*.pdf)")
        if paths:
            self.load_pdfs(paths)

    def load_pdfs(self, paths):
        known = {os.path.normcase(d.path) for d in self.docs}
        QApplication.setOverrideCursor(Qt.CursorShape.WaitCursor)
        errors = []
        try:
            for p in paths:
                if os.path.normcase(p) in known:
                    continue
                try:
                    self.docs.append(extractor.extract_document(p))
                except Exception as exc:  # corrupt / encrypted PDFs
                    errors.append(f"{os.path.basename(p)}: {exc}")
            self._rebuild_from_docs()
        finally:
            QApplication.restoreOverrideCursor()
        if errors:
            QMessageBox.warning(self, APP_NAME, "Could not read:\n\n" + "\n".join(errors))

    def remove_selected_doc(self):
        row = self.doc_list.currentRow()
        if 0 <= row < len(self.docs):
            del self.docs[row]
            self._rebuild_from_docs()

    def _rebuild_from_docs(self):
        """Re-merge all documents, keeping anything the user typed."""
        self.docs.sort(key=lambda d: extractor.DOC_PRIORITY.get(d.doc_type, 9))
        user_vals = {k: v for k, v in self.data.values.items() if self.data.sources.get(k) == SRC_USER}
        data, log, hints = extractor.merge(self.docs)
        for k, v in user_vals.items():
            data.set(k, v, SRC_USER)
        drafting.apply_drafts(data, hints, self.docs)
        data.set("drafts_reviewed", "No", SRC_USER)
        self.data, self.hints = data, hints

        self.doc_list.clear()
        for d in self.docs:
            it = QListWidgetItem(f"{d.doc_type}\n{d.name}")
            it.setToolTip(d.path)
            self.doc_list.addItem(it)
        if self.docs:
            self.doc_list.setCurrentRow(0)
        else:
            self.doc_text.clear()
        self.log_view.setPlainText("\n".join(log))
        self._refresh_all()

        if not any(d.doc_type == extractor.DOC_ORDER for d in self.docs) and self.docs:
            self.statusBar().showMessage("No assessment order recognised - order details may be incomplete.", 8000)
        else:
            n = sum(1 for k, s in self.data.sources.items() if s not in (SRC_USER,) and
                    not s.startswith(("Derived", "Drafted", "Default")) and self.data.get(k))
            self.statusBar().showMessage(f"{len(self.docs)} document(s) processed · {n} fields extracted. "
                                         "Review amber fields before export.", 8000)
        if any("differs" in l for l in log):
            QMessageBox.warning(self, APP_NAME, "\n".join(l for l in log if "differs" in l)
                                + "\n\nCheck that all PDFs belong to the same assessee and year.")

    def _show_doc_text(self, row):
        if 0 <= row < len(self.docs):
            self.doc_text.setPlainText(self.docs[row].text)

    def regenerate_drafts(self):
        if not self.docs and not self.data.get("pan"):
            return
        for k, s in list(self.data.sources.items()):
            if s.startswith(("Derived", "Drafted", "Default")):
                self.data.set(k, "")
        drafting.apply_drafts(self.data, self.hints, self.docs)
        self.data.set("drafts_reviewed", "No", SRC_USER)
        self._refresh_all()
        self.statusBar().showMessage("Drafted and derived fields regenerated (your edits were kept).", 5000)

    def generate_ai_draft(self):
        if not self.docs:
            QMessageBox.warning(self, APP_NAME, "Load readable source PDFs first.")
            return
        if any(len(d.text.strip()) < 50 for d in self.docs):
            QMessageBox.warning(self, APP_NAME, "A source has no readable text. OCR it before AI drafting.")
            return
        dialog = AIDraftDialog(self.data, self.docs, self)
        if dialog.exec() and dialog.result_data:
            for key in ("statement_of_facts", "grounds_of_appeal"):
                self.data.set(key, dialog.result_data[key], "Drafted - local AI; verify")
            self.data.set("ai_review_notes", dialog.result_data["review_notes"], "Drafted - local AI; verify")
            self.data.set("drafts_reviewed", "No", SRC_USER)
            self._refresh_all()

    def export_narratives(self):
        issues = validate_export(self.data, self.docs)
        if issues:
            QMessageBox.warning(self, APP_NAME, "Resolve these before exporting:\n\n" + "\n".join(issues))
            return
        folder = QFileDialog.getExistingDirectory(self, "Choose document output folder")
        if folder:
            try:
                paths = export_narratives(self.data, folder)
                QMessageBox.information(self, APP_NAME, "Saved:\n" + "\n".join(paths))
            except Exception as exc:
                QMessageBox.warning(self, APP_NAME, str(exc))

    def save_draft(self):
        path = self.draft_path
        if not path:
            default = f"Form35_{self.data.get('pan') or 'case'}_AY{self.data.get('assessment_year')}.f35.json"
            path, _ = QFileDialog.getSaveFileName(self, "Save draft", default, "Form 35 draft (*.f35.json *.json)")
            if not path:
                return
        payload = {"version": 1, "data": self.data.to_dict(), "hints": self.hints,
                   "documents": [d.path for d in self.docs]}
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
        self.draft_path = path
        self.setWindowTitle(f"{APP_NAME} - {os.path.basename(path)}")
        self.statusBar().showMessage(f"Draft saved: {path}", 5000)

    def open_draft(self, path=None):
        if not path:
            path, _ = QFileDialog.getOpenFileName(self, "Open draft", os.getcwd(), "Form 35 draft (*.json)")
            if not path:
                return
        try:
            with open(path, encoding="utf-8") as fh:
                payload = json.load(fh)
            self.data = AppealData.from_dict(payload["data"])
        except Exception as exc:
            QMessageBox.critical(self, APP_NAME, f"Could not open draft:\n{exc}")
            return
        self.hints = payload.get("hints", {})
        self.docs = []
        for p in payload.get("documents", []):
            if os.path.exists(p):
                try:
                    self.docs.append(extractor.extract_document(p))
                except Exception:
                    pass
        self.doc_list.clear()
        for d in self.docs:
            self.doc_list.addItem(QListWidgetItem(f"{d.doc_type}\n{d.name}"))
        if self.docs:
            self.doc_list.setCurrentRow(0)
        self.draft_path = path
        self.setWindowTitle(f"{APP_NAME} - {os.path.basename(path)}")
        self._refresh_all()

    def export_pdf(self):
        blockers = validate_export(self.data, self.docs)
        if blockers:
            QMessageBox.warning(self, APP_NAME, "Resolve these before exporting:\n\n" + "\n".join(blockers))
            return
        if not self.data.is_minimum_valid():
            QMessageBox.warning(self, APP_NAME, "Name, PAN and Assessment Year are needed before exporting.")
            return
        issues = []
        missing = self.data.missing_required()
        if missing:
            issues.append("Required fields empty:\n  - " + "\n  - ".join(f.label for f in missing))
        if not re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]|\d{12}", self.data.get("pan").strip()):
            issues.append("PAN / Aadhaar format looks invalid.")
        unreviewed = [f.label for f in FIELDS if f.printed and self._state_for(f.key) == "drafted"]
        if unreviewed:
            issues.append(f"{len(unreviewed)} drafted/derived field(s) not yet reviewed (amber).")
        if "[state the reason" in self.data.get("condonation_grounds"):
            issues.append("Condonation of delay still contains the placeholder reason.")
        if "_______" in self.data.get("appeal_fee"):
            issues.append("Appeal fee challan details (BSR code, date, serial no.) are not filled.")
        if issues:
            r = QMessageBox.question(self, APP_NAME, "\n\n".join(issues) + "\n\nExport anyway?")
            if r != QMessageBox.StandardButton.Yes:
                return

        ay = self.data.get("assessment_year").replace("/", "-")
        default = os.path.join(os.path.dirname(self.docs[0].path) if self.docs else os.getcwd(),
                               f"Form35_{self.data.get('pan')}_AY{ay}.pdf")
        path, _ = QFileDialog.getSaveFileName(self, "Export Form 35", default, "PDF (*.pdf)")
        if not path:
            return
        try:
            export_form35(self.data, path)
        except PermissionError:
            QMessageBox.critical(self, APP_NAME, "Cannot write the file - is it open in a PDF viewer?")
            return
        if QMessageBox.question(self, APP_NAME, f"Form 35 exported:\n{path}\n\nOpen it now?") \
                == QMessageBox.StandardButton.Yes:
            QDesktopServices.openUrl(QUrl.fromLocalFile(path))

    # ------------------------------------------------------------ drag/drop

    def dragEnterEvent(self, e):
        if e.mimeData().hasUrls():
            e.acceptProposedAction()

    def dropEvent(self, e):
        paths = [u.toLocalFile() for u in e.mimeData().urls()]
        drafts = [p for p in paths if p.lower().endswith(".json")]
        pdfs = [p for p in paths if p.lower().endswith(".pdf")]
        if drafts:
            self.open_draft(drafts[0])
        elif pdfs:
            self.load_pdfs(pdfs)


def apply_theme(app: QApplication) -> None:
    """Force a light palette so Windows dark mode doesn't give white-on-white text."""
    app.setStyle("Fusion")
    app.setFont(QFont("Segoe UI", 10))
    pal = QPalette()
    R = QPalette.ColorRole
    for role, color in ((R.Window, "#f5f6f8"), (R.WindowText, "#1f2937"), (R.Base, "#ffffff"),
                        (R.AlternateBase, "#f3f4f6"), (R.Text, "#111827"), (R.Button, "#ffffff"),
                        (R.ButtonText, "#1f2937"), (R.ToolTipBase, "#ffffff"), (R.ToolTipText, "#111827"),
                        (R.Highlight, "#bfdbfe"), (R.HighlightedText, "#111827"),
                        (R.PlaceholderText, "#9ca3af")):
        pal.setColor(role, QColor(color))
    app.setPalette(pal)
    app.setStyleSheet(QSS)


def main():
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    apply_theme(app)
    win = MainWindow()
    win.show()
    pdfs = [a for a in sys.argv[1:] if a.lower().endswith(".pdf")]
    if pdfs:
        QTimer.singleShot(0, lambda: win.load_pdfs(pdfs))
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
