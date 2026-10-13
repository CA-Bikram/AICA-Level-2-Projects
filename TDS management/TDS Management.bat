@echo off
rem ===============================================================
rem  TDS Management - ONE-FILE launcher. Double-click to run.
rem  The whole app is stored inside this file; it is unpacked next to
rem  this .bat as tds_management.py each time (your data stays in
rem  tds_management.db in the same folder).
rem ===============================================================
cd /d "%~dp0"
title TDS Management

rem ---- find Python 3
set "PYEXE="
where py >nul 2>nul && py -3 -c "import sys" >nul 2>nul && set "PYEXE=py -3"
if not defined PYEXE (
    where python >nul 2>nul && python -c "import sys;sys.exit(sys.version_info[0]<3)" >nul 2>nul && set "PYEXE=python"
)
if not defined PYEXE (
    for /d %%D in ("%LocalAppData%\Programs\Python\Python3*" "%ProgramFiles%\Python3*") do (
        if exist "%%~D\python.exe" if not defined PYEXE set "PYEXE=%%~D\python.exe"
    )
)
if not defined PYEXE (
    echo Python 3 was not found on this computer.
    echo.
    echo 1. Download it from https://www.python.org/downloads/
    echo 2. During setup tick "Add python.exe to PATH"
    echo 3. Double-click this file again.
    echo.
    pause
    exit /b 1
)
%PYEXE% -c "import tkinter" >nul 2>nul
if errorlevel 1 (
    echo This Python has no Tkinter. Re-run the Python installer, choose Modify,
    echo and tick "tcl/tk and IDLE". Then double-click this file again.
    echo.
    pause
    exit /b 1
)

rem ---- unpack the app stored below the marker line at the end of this file
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0'); $m='#==PYTHON'+'-BEGIN=='; $i=$t.LastIndexOf($m); $i=$t.IndexOf([char]10,$i)+1; [IO.File]::WriteAllText('%~dp0tds_management.py',$t.Substring($i),(New-Object Text.UTF8Encoding($false)))"
if errorlevel 1 (
    echo Could not unpack the app.
    pause
    exit /b 1
)

start "TDS Management" /min cmd /c "%PYEXE% tds_management.py || (echo. & echo The app stopped with an error shown above. & pause)"
exit /b 0
#==PYTHON-BEGIN==
"""
TDS Management  -  desktop app for managing TDS compliance work in a CA practice.

Run:        python tds_management.py
Requires:   Python 3.8+ (Tkinter and SQLite ship with standard Python)
Data file:  tds_management.db (created next to the script on first run)

Tabs: Dashboard | Team Management | Task Management | Client Management |
      Unit Management | TDS Entries | Reports
"""
import calendar
import csv
import datetime as dt
import json
import re
import sqlite3
import tkinter as tk
import zipfile
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from tkinter import font as tkfont
from xml.sax.saxutils import escape as xesc

APP_NAME = "TDS Management"
DB_FILE = Path(__file__).with_name("tds_management.db")

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
TAN_RE = re.compile(r"^[A-Z]{4}[0-9]{5}[A-Z]$")

NUM_KINDS = ("number", "pct")

# Default TDS section master. Seeded once into the "TDS Sections" tab, where every value
# (rates, thresholds, new section, return code) can be edited to match the law in force.
# Columns: label, old section, new section (Income-tax Act 2025), return code, return form,
#          nature, rate %, rate % if no PAN, single-payment limit, cumulative limit,
#          cumulative basis, TDS only on excess over limit, notes
FY_, MO_ = "Financial Year", "Month"
SECTION_DEFAULTS = [
    ("192", "192", "392", "1001", "24Q / Form 138", "Salary", 0, None, None, None, "", "No",
     "Slab rates - enter the TDS amount manually."),
    ("192A", "192A", "392(7)", "1004", "26Q / Form 140", "Premature EPF withdrawal", 10, 20, 50000, None, "", "No", ""),
    ("193", "193", "393(1) Sl.5(i)", "1019", "26Q / Form 140", "Interest on securities", 10, 20, None, 10000, FY_, "No", ""),
    ("194", "194", "393(1) Sl.7", "1029", "26Q / Form 140", "Dividend", 10, 20, None, 10000, FY_, "No", ""),
    ("194A (Bank - Sr. Citizen)", "194A", "393(1) Sl.5(ii)", "1020", "26Q / Form 140",
     "Interest (bank / co-op / post office) - senior citizen", 10, 20, None, 100000, FY_, "No", ""),
    ("194A (Bank - Others)", "194A", "393(1) Sl.5(ii)", "1021", "26Q / Form 140",
     "Interest (bank / co-op / post office) - others", 10, 20, None, 50000, FY_, "No", ""),
    ("194A", "194A", "393(1) Sl.5(iii)", "1022", "26Q / Form 140",
     "Interest other than on securities (other payers)", 10, 20, None, 10000, FY_, "No", ""),
    ("194C (Ind/HUF)", "194C", "393(1) Sl.6(i)", "1023", "26Q / Form 140",
     "Contractor - payee Individual / HUF", 1, 20, 30000, 100000, FY_, "No",
     "TDS if a single payment exceeds 30,000 or the year's total exceeds 1,00,000."),
    ("194C (Others)", "194C", "393(1) Sl.6(i)", "1024", "26Q / Form 140",
     "Contractor - payee other than Individual / HUF", 2, 20, 30000, 100000, FY_, "No",
     "TDS if a single payment exceeds 30,000 or the year's total exceeds 1,00,000."),
    ("194D", "194D", "393(1) Sl.1(i)", "1005", "26Q / Form 140", "Insurance commission", 2, 20, None, 20000, FY_, "No", ""),
    ("194H", "194H", "393(1) Sl.1(ii)", "1006", "26Q / Form 140", "Commission / brokerage", 2, 20, None, 20000, FY_, "No", ""),
    ("194-IB", "194-IB", "393(1) Sl.2(i)", "N/A (Form 141)", "Form 141", "Rent by Individual / HUF (not liable to audit)",
     2, 20, None, 50000, MO_, "No", "Reported in Form 141; threshold 50,000 per month."),
    ("194I(a)", "194I", "393(1) Sl.2(ii)", "1008", "26Q / Form 140", "Rent - plant, machinery, equipment", 2, 20, None, 600000, FY_, "No", ""),
    ("194I(b)", "194I", "393(1) Sl.2(ii)", "1009", "26Q / Form 140", "Rent - land, building, furniture", 10, 20, None, 600000, FY_, "No", ""),
    ("194IA", "194IA", "393(1) Sl.3(i)", "N/A (Form 141)", "Form 141", "Transfer of immovable property (other than agricultural land)",
     1, 20, 5000000, None, "", "No", "Applies if consideration (or stamp value) is 50,00,000 or more."),
    ("194IC", "194IC", "393(1) Sl.3(ii)", "1011", "26Q / Form 140", "Joint development agreement", 10, 20, None, None, "", "No", ""),
    ("194LA", "194LA", "393(1) Sl.3(iii)", "1012", "26Q / Form 140", "Compensation on acquisition of immovable property",
     10, 20, None, 500000, FY_, "No", ""),
    ("194K", "194K", "393(1) Sl.4(i)", "1013", "26Q / Form 140", "Mutual fund income", 10, 20, None, 10000, FY_, "No", ""),
    ("194LBA", "194LBA", "393(1) Sl.4(ii)", "1014", "26Q / Form 140", "Business trust income", 10, 20, None, None, "", "No", ""),
    ("194LBB", "194LBB", "393(1) Sl.4(iii)", "1017", "26Q / Form 140", "Investment fund income", 10, 20, None, None, "", "No", ""),
    ("194LBC", "194LBC", "393(1) Sl.4(iv)", "1018", "26Q / Form 140", "Securitisation trust income", 25, 30, None, None, "", "No",
     "25% Individual / HUF, 30% others - verify and edit."),
    ("194J(a)", "194J", "393(1) Sl.6(iii)", "1026", "26Q / Form 140", "Fees - technical services, call centre, royalty (film)",
     2, 20, None, 50000, FY_, "No", ""),
    ("194J(b)", "194J", "393(1) Sl.6(iii)", "1027", "26Q / Form 140", "Fees - professional services, royalty, others",
     10, 20, None, 50000, FY_, "No", ""),
    ("194J (Director)", "194J", "393(1) Sl.6(iii)", "1028", "26Q / Form 140", "Director's remuneration (other than salary)",
     10, 20, None, None, "", "No", ""),
    ("194M", "194M", "393(1) Sl.6(ii)", "N/A (Form 141)", "Form 141", "Contract / commission / fees by Individual / HUF",
     2, 20, None, 5000000, FY_, "No", ""),
    ("194DA", "194DA", "393(1) Sl.8(i)", "1030", "26Q / Form 140", "Life insurance policy maturity", 2, 20, None, 100000, FY_, "No", ""),
    ("194Q", "194Q", "393(1) Sl.8(ii)", "1031", "26Q / Form 140", "Purchase of goods", 0.1, 5, None, 5000000, FY_, "Yes",
     "TDS only on the amount above 50 lakh."),
    ("194P", "194P", "393(1) Sl.8(iii)", "1032", "26Q / Form 140", "Senior citizen (75+) - specified bank", 0, None, None, None, "", "No",
     "Slab rates - enter the TDS amount manually."),
    ("194R", "194R", "393(1) Sl.8(iv)", "1033", "26Q / Form 140", "Benefit / perquisite in business or profession", 10, 20, None, 20000, FY_, "No", ""),
    ("194O", "194O", "393(1) Sl.8(v)", "1035", "26Q / Form 140", "E-commerce operator - payment to participant", 0.1, 5, None, None, "", "No",
     "Individual / HUF participants below 5 lakh gross sales are exempt - handle manually."),
    ("194S (Specified person)", "194S", "393(1) Sl.8(vi)", "1037", "26Q / Form 140", "Virtual digital asset transfer", 1, 20, None, 50000, FY_, "No", ""),
    ("194S (Others)", "194S", "393(1) Sl.8(vi)", "1038", "26Q / Form 140", "Virtual digital asset transfer", 1, 20, None, 10000, FY_, "No", ""),
    ("194B", "194B", "393(3) Sl.1", "1058", "26Q / Form 140", "Lottery, crossword, card game winnings", 30, 30, 10000, None, "", "No", ""),
    ("194BA", "194BA", "393(3) Sl.2", "1060", "26Q / Form 140", "Online games winnings", 30, 30, None, None, "", "No", ""),
    ("194BB", "194BB", "393(3) Sl.3", "1062", "26Q / Form 140", "Horse race winnings", 30, 30, 10000, None, "", "No", ""),
    ("194G", "194G", "393(3) Sl.4", "1063", "26Q / Form 140", "Lottery ticket commission", 2, 20, None, 20000, FY_, "No", ""),
    ("194N", "194N", "393(3) Sl.5", "1064", "26Q / Form 140", "Cash withdrawal", 2, 2, None, 10000000, FY_, "Yes",
     "TDS only on the amount above 1 crore (higher limits apply for non-filers)."),
    ("194T", "194T", "393(3) Sl.7", "1067", "26Q / Form 140", "Payment to partners of a firm", 10, 20, None, 20000, FY_, "No", ""),
    ("195", "195", "393(2) Sl.17", "1039-1057", "27Q / Form 144", "Payment to non-resident / foreign company", 0, None, None, None, "", "No",
     "Rate depends on nature and DTAA - enter rate / TDS amount manually."),
]

FORMS = ["24Q", "26Q", "27Q", "27EQ", "TDS Deposit", "Challan Correction",
         "Correction Return", "Form 16 / 16A", "Other"]
MONTHS = ["April", "May", "June", "July", "August", "September", "October",
          "November", "December", "January", "February", "March"]

# ---- Branding: shown at the top of the window and in the footer
FIRM_NAME = "CA Biswajit Karmakar, Chartered Accountant"
MONOGRAM = "CB"
TAGLINE = "Tax Compliance & Assurance Workspace"

# ---- Colour palette (deep navy + muted gold, white cards on a soft grey page)
NAVY, NAVY_2, GOLD = "#0B1F3A", "#17325C", "#B8923A"
BG, CARD, LINE = "#F3F5F8", "#FFFFFF", "#D5DCE5"
INK, MUTED, SOFT = "#1A2433", "#5F6F82", "#9DB0C8"
TRACK, ZEBRA, SEL = "#EAEEF3", "#F7F9FC", "#D6E2F3"
GREEN, RED, AMBER = "#1E7B4F", "#B3261E", "#B7791F"
FONT = "Segoe UI"

# ---- Firm logo (PNG, embedded so the app stays a single file)
LOGO_PNG_B64 = (
    "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"
)

ICON_PNG_B64 = (
    "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"
)


def load_logo(master, data):
    """Return a PhotoImage from embedded base64 PNG data, or None if Tk cannot read it."""
    try:
        return tk.PhotoImage(master=master, data=data)
    except tk.TclError:
        return None


def ft(size=10, bold=False):
    return (FONT, size, "bold") if bold else (FONT, size)


def apply_theme(root):
    """Professional look: navy / gold, flat white cards, clean tables."""
    global FONT
    families = set(tkfont.families(root))
    for cand in ("Segoe UI", "Calibri", "Helvetica Neue", "Arial", "DejaVu Sans"):
        if cand in families:
            FONT = cand
            break
    root.configure(bg=BG)
    root.option_add("*TCombobox*Listbox.font", f"{{{FONT}}} 10")
    root.option_add("*TCombobox*Listbox.selectBackground", NAVY_2)
    root.option_add("*TCombobox*Listbox.selectForeground", "white")
    st = ttk.Style(root)
    try:
        st.theme_use("clam")
    except tk.TclError:
        pass
    st.configure(".", background=BG, foreground=INK, font=ft(10), bordercolor=LINE)
    st.configure("TFrame", background=BG)
    st.configure("Card.TFrame", background=CARD)
    st.configure("TLabel", background=BG, foreground=INK)
    st.configure("Card.TLabel", background=CARD, foreground=INK)
    st.configure("CardMuted.TLabel", background=CARD, foreground=MUTED, font=ft(9))
    st.configure("Muted.TLabel", background=BG, foreground=MUTED)
    st.configure("Title.TLabel", background=BG, foreground=NAVY, font=ft(15, True))
    st.configure("Card.TLabelframe", background=CARD, bordercolor=LINE, relief="solid", borderwidth=1)
    st.configure("Card.TLabelframe.Label", background=CARD, foreground=NAVY, font=ft(10, True))

    for w in ("TEntry", "TCombobox", "TSpinbox"):
        st.configure(w, fieldbackground="#FFFFFF", background="#FFFFFF", bordercolor=LINE,
                     lightcolor=LINE, darkcolor=LINE, padding=5, arrowcolor=NAVY)
    st.configure("TCombobox", background="#E8EDF3")
    st.map("TCombobox", fieldbackground=[("readonly", "#FFFFFF")],
           selectbackground=[("readonly", "#FFFFFF")], selectforeground=[("readonly", INK)])
    st.map("TEntry", bordercolor=[("focus", NAVY_2)], lightcolor=[("focus", NAVY_2)])

    st.configure("TButton", background="#E8EDF3", foreground=NAVY, bordercolor=LINE,
                 padding=(12, 6), relief="flat", focusthickness=0, font=ft(10))
    st.map("TButton", background=[("active", "#D5DDE8"), ("pressed", "#C6D1DF")])
    st.configure("Primary.TButton", background=NAVY_2, foreground="white", bordercolor=NAVY_2,
                 padding=(14, 6), font=ft(10, True))
    st.map("Primary.TButton", background=[("active", NAVY), ("pressed", NAVY)],
           foreground=[("active", "white")])
    st.configure("Danger.TButton", background="#FBEAEA", foreground=RED, bordercolor="#F1C6C3")
    st.map("Danger.TButton", background=[("active", "#F6D5D3"), ("pressed", "#F0C2BF")])
    st.configure("Icon.TButton", padding=(5, 4))

    st.configure("TNotebook", background=BG, borderwidth=0, tabmargins=(0, 8, 0, 0))
    st.configure("TNotebook.Tab", background="#DDE3EB", foreground=MUTED, padding=(20, 10),
                 font=ft(10, True), borderwidth=0, bordercolor=LINE, lightcolor="#DDE3EB")
    st.map("TNotebook.Tab", background=[("selected", BG), ("active", "#E9EEF4")],
           foreground=[("selected", NAVY)], lightcolor=[("selected", GOLD)],
           expand=[("selected", (0, 0, 0, 0))])

    st.configure("Treeview", background=CARD, fieldbackground=CARD, foreground=INK,
                 rowheight=27, borderwidth=0, font=ft(10))
    st.configure("Treeview.Heading", background=NAVY_2, foreground="white", font=ft(10, True),
                 relief="flat", padding=(8, 7), borderwidth=0)
    st.map("Treeview.Heading", background=[("active", NAVY)])

    def fixed(option):          # work-around for a Tk tag-colour bug in some versions
        return [e for e in st.map("Treeview", query_opt=option) if e[:2] != ("!disabled", "!selected")]
    st.map("Treeview", foreground=fixed("foreground") + [("selected", NAVY)],
           background=fixed("background") + [("selected", SEL)])

    for s in ("Vertical.TScrollbar", "Horizontal.TScrollbar"):
        st.configure(s, background="#C3CCD8", troughcolor=BG, bordercolor=BG, arrowcolor=NAVY)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def to_iso(text):
    """DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD  ->  YYYY-MM-DD ('' stays '')."""
    text = (text or "").strip()
    if not text:
        return ""
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    raise ValueError(f"Invalid date '{text}'. Use DD-MM-YYYY.")


def to_dmy(iso):
    if not iso:
        return ""
    try:
        return dt.datetime.strptime(iso, "%Y-%m-%d").strftime("%d-%m-%Y")
    except ValueError:
        return iso


def inr(x):
    """Format a number with Indian digit grouping, e.g. 1234567.5 -> 12,34,567.50"""
    x = float(x or 0)
    neg, x = x < 0, abs(x)
    whole, frac = f"{x:.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return f"{'-' if neg else ''}{whole}.{frac}"


def fy_list(n=6):
    today = dt.date.today()
    start = today.year if today.month >= 4 else today.year - 1
    return [f"{y}-{str(y + 1)[2:]}" for y in range(start, start - n, -1)]


def fy_bounds(fy):
    y = int(fy[:4])
    return f"{y}-04-01", f"{y + 1}-03-31"


def deposit_due(d):
    """Due date for depositing TDS deducted on date d (non-government deductor)."""
    if d.month == 3:
        return dt.date(d.year, 4, 30)
    if d.month == 12:
        return dt.date(d.year + 1, 1, 7)
    return dt.date(d.year, d.month + 1, 7)


def months_part(d1, d2):
    """Months or part of a month from d1 to d2 (for interest u/s 201(1A))."""
    m = (d2.year - d1.year) * 12 + d2.month - d1.month
    if d2.day > d1.day:
        m += 1
    return max(m, 0)


# --------------------------------------------------------------------------- #
# Export  (pure standard library - no extra packages needed)
# --------------------------------------------------------------------------- #
def _is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _raw(v):
    """Plain text for machine-readable files (no thousand separators)."""
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:.2f}"
    return str(v)


def _disp(v):
    """Human-friendly text for PDF / Word / HTML (Indian digit grouping)."""
    if isinstance(v, float):
        return inr(v)
    return _raw(v)


def _tag(name):
    t = re.sub(r"\W+", "_", str(name)).strip("_") or "Col"
    return t if not t[0].isdigit() else "_" + t


def write_delimited(path, columns, rows, delim, bom=False):
    def clean(v):
        return _raw(v).replace(delim, " ").replace("\r", " ").replace("\n", " ")
    with open(path, "w", newline="", encoding="utf-8-sig" if bom else "utf-8") as fh:
        fh.write(delim.join(clean(c) for c in columns) + "\r\n")
        for r in rows:
            fh.write(delim.join(clean(v) for v in r) + "\r\n")


def write_csv(path, columns, rows, title=""):
    with open(path, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(columns)
        for r in rows:
            w.writerow([_raw(v) for v in r])


def write_tsv(path, columns, rows, title=""):
    write_delimited(path, columns, rows, "\t")


def write_caret(path, columns, rows, title=""):
    write_delimited(path, columns, rows, "^")


def write_json(path, columns, rows, title=""):
    data = {"title": title, "generated": dt.datetime.now().isoformat(timespec="seconds"),
            "rows": [dict(zip(columns, r)) for r in rows]}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)


def write_xml(path, columns, rows, title=""):
    tags = [_tag(c) for c in columns]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        safe_title = xesc(title, {'"': "&quot;"})
        fh.write('<TDSExport title="%s">\n' % safe_title)
        for r in rows:
            fh.write("  <Row>\n")
            for t, v in zip(tags, r):
                fh.write(f"    <{t}>{xesc(_raw(v))}</{t}>\n")
            fh.write("  </Row>\n")
        fh.write("</TDSExport>\n")


def write_html(path, columns, rows, title=""):
    head = "".join(f"<th>{xesc(str(c))}</th>" for c in columns)
    body = "".join(
        "<tr>" + "".join(
            f'<td class="{"n" if _is_num(v) else ""}">{xesc(_disp(v))}</td>' for v in r) + "</tr>"
        for r in rows)
    page = (f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{xesc(title)}</title>"
            "<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px}"
            "table{border-collapse:collapse;font-size:13px}"
            "th,td{border:1px solid #cbd5e1;padding:5px 9px}"
            "th{background:#e2e8f0;text-align:left}td.n{text-align:right}</style></head>"
            f"<body><h2>{xesc(title)}</h2><table><tr>{head}</tr>{body}</table>"
            f"<p style='color:#64748b'>Generated {dt.datetime.now():%d-%m-%Y %H:%M}</p></body></html>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(page)


def _col_name(i):
    s, i = "", i + 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def write_xlsx(path, columns, rows, title=""):
    sheet = re.sub(r'[\[\]:*?/\\"]', " ", title)[:31].strip() or "Report"
    ncol = len(columns)

    def cell(ref, v, style=0):
        if v is None or v == "":
            return ""
        if _is_num(v):
            st = ' s="2"' if isinstance(v, float) else ""
            return f'<c r="{ref}"{st}><v>{v!r}</v></c>'
        st = f' s="{style}"' if style else ""
        return (f'<c r="{ref}"{st} t="inlineStr"><is><t xml:space="preserve">'
                f'{xesc(str(v))}</t></is></c>')

    widths = [min(60, max([len(str(c))] + [len(_raw(r[i])) for r in rows]) + 2) for i, c in enumerate(columns)]
    cols_xml = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>'
                       for i, w in enumerate(widths))
    sheet_rows = ['<row r="1">' + "".join(cell(f"{_col_name(i)}1", c, 1) for i, c in enumerate(columns)) + "</row>"]
    for n, r in enumerate(rows, start=2):
        sheet_rows.append(f'<row r="{n}">' + "".join(cell(f"{_col_name(i)}{n}", v) for i, v in enumerate(r)) + "</row>")
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    sheet_xml = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="{ns}">'
                 '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
                 'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
                 f"<cols>{cols_xml}</cols><sheetData>{''.join(sheet_rows)}</sheetData></worksheet>")
    styles = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="{ns}">'
              '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
              '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
              '<fills count="3"><fill><patternFill patternType="none"/></fill>'
              '<fill><patternFill patternType="gray125"/></fill>'
              '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill></fills>'
              '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
              '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
              '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
              '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
              '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
              '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
    workbook = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="{ns}" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                f'<sheets><sheet name="{xesc(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>')
    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    wb_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
               '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
               f'<Relationship Id="rId1" Type="{rel}/worksheet" Target="worksheets/sheet1.xml"/>'
               f'<Relationship Id="rId2" Type="{rel}/styles" Target="styles.xml"/></Relationships>')
    root_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                 f'<Relationship Id="rId1" Type="{rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    ctypes = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="xml" ContentType="application/xml"/>'
              '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
              '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
              '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
              '</Types>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ctypes)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("xl/workbook.xml", workbook)
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        z.writestr("xl/styles.xml", styles)
        z.writestr("xl/worksheets/sheet1.xml", sheet_xml)


def write_docx(path, columns, rows, title=""):
    ncol = max(1, len(columns))
    gw = 15398 // ncol
    sz = 16 if ncol <= 8 else 13 if ncol <= 11 else 11

    def run(text, bold=False, size=sz):
        b = "<w:b/>" if bold else ""
        return (f'<w:r><w:rPr>{b}<w:sz w:val="{size}"/></w:rPr>'
                f'<w:t xml:space="preserve">{xesc(text)}</w:t></w:r>')

    def tc(text, bold=False, right=False, shade=False):
        shd = '<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>' if shade else ""
        jc = '<w:jc w:val="right"/>' if right else ""
        return (f'<w:tc><w:tcPr><w:tcW w:w="{gw}" w:type="dxa"/>{shd}</w:tcPr>'
                f'<w:p><w:pPr><w:spacing w:after="0"/>{jc}</w:pPr>{run(text, bold)}</w:p></w:tc>')

    trs = ['<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
           "".join(tc(str(c), True, False, True) for c in columns) + "</w:tr>"]
    for r in rows:
        trs.append("<w:tr>" + "".join(tc(_disp(v), False, _is_num(v)) for v in r) + "</w:tr>")
    borders = "".join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>'
                      for s in ("top", "left", "bottom", "right", "insideH", "insideV"))
    table = (f'<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>{borders}</w:tblBorders>'
             '<w:tblLayout w:type="autofit"/></w:tblPr><w:tblGrid>' +
             "".join(f'<w:gridCol w:w="{gw}"/>' for _ in range(ncol)) + "</w:tblGrid>" + "".join(trs) + "</w:tbl>")
    body = (f'<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>{run(title, True, 28)}</w:p>' + table +
            f'<w:p><w:pPr><w:spacing w:before="120"/></w:pPr>{run("Generated " + dt.datetime.now().strftime("%d-%m-%Y %H:%M"), False, 16)}</w:p>'
            '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
            '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>')
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
           f"<w:body>{body}</w:body></w:document>")
    ctypes = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="xml" ContentType="application/xml"/>'
              '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
              '</Types>')
    root_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
                 '</Relationships>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ctypes)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("word/document.xml", doc)


def _pdf_text(s):
    b = s.encode("cp1252", "replace")
    return b.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def write_pdf(path, columns, rows, title=""):
    """Landscape A4 table PDF using the built-in Helvetica fonts."""
    PW, PH, M, K, PAD = 842.0, 595.0, 28.0, 0.52, 10
    avail = PW - 2 * M
    ncol = len(columns)
    cells = [[_disp(v) for v in r] for r in rows]
    chars = [min(40, max([len(str(c))] + [len(r[i]) for r in cells])) for i, c in enumerate(columns)]
    fs = 9.0
    while fs > 5.0 and sum(chars) * fs * K + ncol * PAD > avail:
        fs -= 0.5
    natural = sum(chars) * fs * K + ncol * PAD
    scale = avail / natural if natural > avail else 1.0
    widths = [(c * fs * K + PAD) * scale for c in chars]
    xs = [M]
    for w in widths[:-1]:
        xs.append(xs[-1] + w)
    rh, hh = fs + 5, fs + 8
    top_block = 38.0
    per_page = max(1, int((PH - 2 * M - top_block - hh - 14) // rh))
    pages = [cells[i:i + per_page] for i in range(0, len(cells), per_page)] or [[]]
    numeric = [any(_is_num(r[i]) for r in rows) for i in range(ncol)]

    def fit(text, w):
        maxc = max(1, int((w - PAD) / (fs * K)))
        return text if len(text) <= maxc else text[:max(1, maxc - 2)] + ".."

    def num_w(s):
        return sum(0.556 if ch.isdigit() else 0.3 for ch in s) * fs

    objs = []   # object bodies (bytes), ids start at 5 for pages
    page_ids = []
    base = 5
    for pi, page in enumerate(pages):
        out = []
        y = PH - M
        out.append(b"BT /F2 13 Tf %.1f %.1f Td (" % (M, y - 12) + _pdf_text(title[:150]) + b") Tj ET")
        out.append(b"BT /F1 7.5 Tf 0.4 g %.1f %.1f Td (" % (M, y - 25) +
                   _pdf_text(f"Generated {dt.datetime.now():%d-%m-%Y %H:%M}   |   {len(rows)} row(s)") + b") Tj ET 0 g")
        y -= top_block
        out.append(b"0.89 0.91 0.94 rg %.1f %.1f %.1f %.1f re f 0 g" % (M, y - hh, avail, hh))
        for i, c in enumerate(columns):
            out.append(b"BT /F2 %.1f Tf %.1f %.1f Td (" % (fs, xs[i] + 3, y - hh + 4) +
                       _pdf_text(fit(str(c), widths[i])) + b") Tj ET")
        y -= hh
        for ri, r in enumerate(page):
            if ri % 2:
                out.append(b"0.97 0.98 0.99 rg %.1f %.1f %.1f %.1f re f 0 g" % (M, y - rh, avail, rh))
            for i, txt in enumerate(r):
                t = fit(txt, widths[i])
                x = xs[i] + 3
                if numeric[i] and txt and (txt[0].isdigit() or txt[0] == "-"):
                    x = xs[i] + widths[i] - 3 - num_w(t)
                out.append(b"BT /F1 %.1f Tf %.1f %.1f Td (" % (fs, x, y - rh + 4) + _pdf_text(t) + b") Tj ET")
            y -= rh
        out.append(b"0.6 G 0.5 w %.1f %.1f m %.1f %.1f l S 0 G" % (M, y, M + avail, y))
        out.append(b"BT /F1 7.5 Tf 0.4 g %.1f %.1f Td (" % (PW - M - 60, M - 12) +
                   _pdf_text(f"Page {pi + 1} of {len(pages)}") + b") Tj ET 0 g")
        stream = b"\n".join(out)
        cid, pid = base + 2 * pi, base + 2 * pi + 1
        objs.append((cid, b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"))
        objs.append((pid, b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Contents %d 0 R "
                          b"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>" % (PW, PH, cid)))
        page_ids.append(pid)
    fixed = [
        (1, b"<< /Type /Catalog /Pages 2 0 R >>"),
        (2, b"<< /Type /Pages /Kids [" + b" ".join(b"%d 0 R" % p for p in page_ids) +
            b"] /Count %d >>" % len(page_ids)),
        (3, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
        (4, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
    ]
    allobjs = fixed + objs
    buf = bytearray(b"%PDF-1.4\n")
    offsets = {}
    for oid, body in allobjs:
        offsets[oid] = len(buf)
        buf += b"%d 0 obj\n" % oid + body + b"\nendobj\n"
    xref = len(buf)
    n = len(allobjs) + 1
    buf += b"xref\n0 %d\n0000000000 65535 f \n" % n
    for oid in range(1, n):
        buf += b"%010d 00000 n \n" % offsets[oid]
    buf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (n, xref)
    with open(path, "wb") as fh:
        fh.write(bytes(buf))


EXPORT_FORMATS = [
    ("Excel workbook (.xlsx)", ".xlsx", write_xlsx),
    ("CSV - comma separated (.csv)", ".csv", write_csv),
    ("PDF document (.pdf)", ".pdf", write_pdf),
    ("Word document (.docx)", ".docx", write_docx),
    ("Text, caret ^ delimited (.txt)", ".txt", write_caret),
    ("Tab separated (.tsv)", ".tsv", write_tsv),
    ("JSON (.json)", ".json", write_json),
    ("XML (.xml)", ".xml", write_xml),
    ("Web page (.html)", ".html", write_html),
]


def export_data(parent, columns, rows, base_name, title):
    """Ask for a format, then a file name, then write the file."""
    if not rows:
        return messagebox.showinfo(APP_NAME, "Nothing to export - the list is empty.")
    dlg = tk.Toplevel(parent)
    dlg.title("Export")
    dlg.transient(parent.winfo_toplevel())
    dlg.resizable(False, False)
    dlg.configure(bg=BG)
    frm = ttk.Frame(dlg, padding=14)
    frm.pack()
    ttk.Label(frm, text=f"Export {len(rows)} row(s) as:").grid(row=0, column=0, sticky="w")
    var = tk.StringVar(value=EXPORT_FORMATS[0][0])
    ttk.Combobox(frm, textvariable=var, values=[f[0] for f in EXPORT_FORMATS],
                 state="readonly", width=34).grid(row=1, column=0, pady=8)
    ttk.Label(frm, foreground="#666", wraplength=300, justify="left",
              text="Excel, CSV, ^-delimited text, JSON and XML keep numbers plain "
                   "(no commas) so they can be imported into other software.").grid(row=2, column=0, sticky="w")

    def go():
        label, ext, writer = next(f for f in EXPORT_FORMATS if f[0] == var.get())
        path = filedialog.asksaveasfilename(parent=dlg, defaultextension=ext,
                                            initialfile=base_name + ext,
                                            filetypes=[(label, "*" + ext)])
        if not path:
            return
        try:
            writer(path, columns, rows, title)
        except Exception as e:  # keep the app alive on any file error
            return messagebox.showerror(APP_NAME, f"Could not export:\n{e}", parent=dlg)
        dlg.destroy()
        messagebox.showinfo(APP_NAME, f"Exported to:\n{path}")

    bar = ttk.Frame(frm)
    bar.grid(row=3, column=0, pady=(12, 0), sticky="e")
    ttk.Button(bar, text="Export", style="Primary.TButton", command=go).pack(side="left", padx=4)
    ttk.Button(bar, text="Cancel", command=dlg.destroy).pack(side="left")
    dlg.grab_set()


# --------------------------------------------------------------------------- #
# Calendar date picker (pure Tkinter - no extra packages needed)
# --------------------------------------------------------------------------- #
class CalendarPopup(tk.Toplevel):
    """Pop-up month calendar. Calls on_pick('DD-MM-YYYY') or on_pick('') for Clear."""
    MONTHS = list(calendar.month_name)[1:]

    def __init__(self, anchor, start, on_pick):
        super().__init__(anchor)
        self.on_pick = on_pick
        self.sel = start
        self.year, self.month = start.year, start.month
        self.title("Select date")
        self.resizable(False, False)
        self.transient(anchor.winfo_toplevel())
        self.bind("<Escape>", lambda e: self.destroy())

        # place just below the anchor widget
        self.update_idletasks()
        x = anchor.winfo_rootx()
        y = anchor.winfo_rooty() + anchor.winfo_height() + 2
        self.geometry(f"+{x}+{y}")

        self.configure(bg=CARD)
        body = ttk.Frame(self, padding=10, style="Card.TFrame")
        body.pack()

        nav = ttk.Frame(body, style="Card.TFrame")
        nav.pack(fill="x", pady=(0, 6))
        ttk.Button(nav, text="<<", width=3, command=lambda: self.shift(-12)).pack(side="left")
        ttk.Button(nav, text="<", width=3, command=lambda: self.shift(-1)).pack(side="left", padx=(2, 4))
        self.month_var = tk.StringVar(value=self.MONTHS[self.month - 1])
        mcb = ttk.Combobox(nav, textvariable=self.month_var, values=self.MONTHS,
                           width=10, state="readonly")
        mcb.pack(side="left")
        mcb.bind("<<ComboboxSelected>>", self.on_month_year)
        self.year_var = tk.StringVar(value=str(self.year))
        ycb = ttk.Spinbox(nav, textvariable=self.year_var, from_=1990, to=2100,
                          width=6, command=self.on_month_year)
        ycb.pack(side="left", padx=4)
        ycb.bind("<Return>", self.on_month_year)
        ttk.Button(nav, text=">", width=3, command=lambda: self.shift(1)).pack(side="left", padx=(4, 2))
        ttk.Button(nav, text=">>", width=3, command=lambda: self.shift(12)).pack(side="left")

        self.grid_frame = ttk.Frame(body, style="Card.TFrame")
        self.grid_frame.pack()

        foot = ttk.Frame(body, style="Card.TFrame")
        foot.pack(fill="x", pady=(8, 0))
        ttk.Button(foot, text="Today", command=lambda: self.pick(dt.date.today())).pack(side="left")
        ttk.Button(foot, text="Clear", command=self.clear).pack(side="left", padx=6)
        ttk.Button(foot, text="Close", command=self.destroy).pack(side="right")

        self.draw()
        self.grab_set()
        self.focus_set()

    def on_month_year(self, _e=None):
        try:
            self.year = max(1900, min(2200, int(self.year_var.get())))
        except ValueError:
            pass
        self.month = self.MONTHS.index(self.month_var.get()) + 1
        self.draw()

    def shift(self, months):
        idx = self.year * 12 + (self.month - 1) + months
        self.year, self.month = idx // 12, idx % 12 + 1
        self.month_var.set(self.MONTHS[self.month - 1])
        self.year_var.set(str(self.year))
        self.draw()

    def draw(self):
        for w in self.grid_frame.winfo_children():
            w.destroy()
        for c, name in enumerate(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]):
            tk.Label(self.grid_frame, text=name, width=4, fg=MUTED, bg=CARD,
                     font=ft(9, True)).grid(row=0, column=c)
        today = dt.date.today()
        weeks = calendar.Calendar(firstweekday=0).monthdayscalendar(self.year, self.month)
        for r, week in enumerate(weeks, start=1):
            for c, day in enumerate(week):
                if not day:
                    continue
                d = dt.date(self.year, self.month, day)
                is_sel, is_today = d == self.sel, d == today
                bg = NAVY_2 if is_sel else ("#E6EBF2" if is_today else CARD)
                fg = "#ffffff" if is_sel else (RED if c == 6 else INK)
                tk.Button(self.grid_frame, text=str(day), width=4, relief="flat",
                          bg=bg, fg=fg, activebackground=SEL, bd=0, highlightthickness=0, pady=3, font=ft(9),
                          command=lambda d=d: self.pick(d)).grid(row=r, column=c, padx=1, pady=1)

    def pick(self, d):
        self.on_pick(d.strftime("%d-%m-%Y"))
        self.destroy()

    def clear(self):
        self.on_pick("")
        self.destroy()


def make_calendar_icon(master):
    """18x18 calendar glyph drawn pixel by pixel, so it never depends on fonts."""
    img = tk.PhotoImage(master=master, width=18, height=18)
    img.put(NAVY_2, to=(1, 3, 17, 17))
    img.put("#FFFFFF", to=(2, 7, 16, 16))
    img.put(GOLD, to=(4, 1, 6, 4))
    img.put(GOLD, to=(12, 1, 14, 4))
    for y in (9, 12):
        for x in (4, 7, 10, 13):
            img.put(NAVY_2, to=(x, y, x + 2, y + 2))
    return img


class DateEntry(ttk.Frame):
    """Entry box (DD-MM-YYYY) with a calendar button. Bind it to a StringVar."""

    def __init__(self, parent, textvariable, width=14):
        super().__init__(parent, style="Card.TFrame")
        self.var = textvariable
        self.entry = ttk.Entry(self, textvariable=self.var, width=width)
        self.entry.pack(side="left")
        self.icon = make_calendar_icon(self)
        self.btn = ttk.Button(self, image=self.icon, style="Icon.TButton", command=self.open)
        self.btn.pack(side="left", padx=(3, 0))
        self.entry.bind("<Down>", lambda e: self.open())

    def open(self):
        try:
            start = dt.date.fromisoformat(to_iso(self.var.get())) if self.var.get().strip() \
                else dt.date.today()
        except ValueError:
            start = dt.date.today()
        CalendarPopup(self.btn, start, self.var.set)


# --------------------------------------------------------------------------- #
# Table definitions
# --------------------------------------------------------------------------- #
def F(key, label, kind="text", options=None, req=False, editable=False, auto=False):
    return dict(key=key, label=label, kind=kind, options=options,
                required=req, editable=editable, auto=auto)


def lookup(table, col):
    return lambda db: [r[0] for r in db.q(
        f"SELECT DISTINCT {col} FROM {table} WHERE COALESCE({col},'')<>'' ORDER BY {col}")]


def section_labels(db):
    return [r[0] for r in db.q("SELECT label FROM tds_sections ORDER BY id")]


TABLES = {
    "team": [
        F("name", "Name", req=True),
        F("role", "Role", options=["Partner", "Manager", "Senior Executive",
                                   "Executive", "Article", "Staff"]),
        F("email", "Email"),
        F("phone", "Phone"),
        F("joining_date", "Joining Date", "date"),
        F("status", "Status", options=["Active", "Inactive"]),
    ],
    "clients": [
        F("name", "Client Name", req=True),
        F("pan", "PAN", "pan"),
        F("tan", "TAN", "tan"),
        F("contact_person", "Contact Person"),
        F("email", "Email"),
        F("phone", "Phone"),
        F("address", "Address"),
        F("client_since", "Client Since", "date"),
        F("status", "Status", options=["Active", "Inactive"]),
    ],
    "units": [
        F("unit_name", "Unit / Branch Name", req=True),
        F("client", "Client", options=lookup("clients", "name")),
        F("tan", "Unit TAN", "tan"),
        F("location", "Location"),
        F("deductor_type", "Deductor Type",
          options=["Company", "Firm / LLP", "Individual / HUF", "Trust / AOP",
                   "Government", "Other"]),
        F("in_charge", "Team In-charge", options=lookup("team", "name")),
        F("start_date", "Unit Start Date", "date"),
        F("status", "Status", options=["Active", "Inactive"]),
    ],
    "deductees": [
        F("name", "Deductee Name", req=True),
        F("pan", "PAN", "pan"),
        F("deductee_type", "Deductee Type",
          options=["Individual", "HUF", "Company", "Firm / LLP", "AOP / BOI", "Trust",
                   "Government", "Co-operative Society", "Other"]),
        F("residency", "Residential Status", options=["Resident", "Non-Resident"]),
        F("client", "Linked Client (Deductor)", options=lookup("clients", "name")),
        F("address", "Address"),
        F("city", "City"),
        F("state", "State"),
        F("pincode", "PIN Code"),
        F("email", "Email"),
        F("phone", "Phone"),
        F("status", "Status", options=["Active", "Inactive"]),
    ],
    "tasks": [
        F("title", "Task", req=True),
        F("client", "Client", options=lookup("clients", "name")),
        F("unit", "Unit / Branch Name", options=lookup("units", "unit_name")),
        F("form", "Form / Type", options=FORMS),
        F("fy", "Financial Year", options=fy_list()),
        F("month", "Month", options=MONTHS),
        F("assigned_to", "Assigned To", options=lookup("team", "name")),
        F("priority", "Priority", options=["High", "Medium", "Low"]),
        F("due_date", "Due Date", "date"),
        F("status", "Status", options=["Pending", "In Progress", "Completed"]),
        F("completed_on", "Completed On", "date"),
        F("remarks", "Remarks"),
    ],
    "tds_sections": [
        F("label", "Section (as used in entries)", req=True),
        F("old_section", "Old Section (Income-tax Act 1961)"),
        F("new_section", "New Section (Income-tax Act 2025)"),
        F("return_code", "Return Code (new)"),
        F("return_form", "Return Form"),
        F("nature", "Nature of Payment"),
        F("rate", "TDS Rate (%)", "pct"),
        F("rate_no_pan", "Rate if No PAN (%)", "pct"),
        F("single_limit", "Single Payment Limit", "number"),
        F("cum_limit", "Cumulative Limit", "number"),
        F("cum_basis", "Cumulative Basis", options=[FY_, MO_]),
        F("on_excess", "TDS Only on Excess", options=["No", "Yes"]),
        F("notes", "Notes"),
    ],
    "tds_entries": [
        F("client", "Client", options=lookup("clients", "name")),
        F("unit", "Unit / Branch Name", options=lookup("units", "unit_name")),
        F("section", "Section (old)", options=section_labels, editable=True),
        F("new_section", "New Section (2025 Act)", options=lookup("tds_sections", "new_section"),
          editable=True),
        F("return_code", "Return Code", options=lookup("tds_sections", "return_code"), editable=True),
        F("purpose", "Purpose of Payment"),
        F("deductee_name", "Deductee Name (from Deductee Details)", options=lookup("deductees", "name"),
          req=True, editable=True),
        F("deductee_pan", "Deductee PAN", "pan", options=lookup("deductees", "pan"), editable=True),
        F("payment_date", "Payment / Deduction Date", "date", req=True),
        F("amount_paid", "Gross Amount Paid / Credited", "number"),
        F("taxes_amount", "GST / Taxes shown separately", "number"),
        F("base_amount", "Amount for TDS (excl. taxes)", "number", auto=True),
        F("cum_amount", "Cumulative (excl. taxes)", "number", auto=True),
        F("rate", "TDS Rate (%) (blank = auto)", "pct"),
        F("tds_amount", "TDS Amount (blank = auto)", "number"),
        F("tax_status", "Threshold Status", auto=True),
        F("deposit_date", "Deposit Date", "date"),
        F("deposited_amount", "Amount Deposited", "number"),
        F("challan_no", "Challan Serial No."),
        F("bsr_code", "BSR Code (7 digits)", "bsr"),
    ],
}


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
class DB:
    def __init__(self, path=DB_FILE):
        self.con = sqlite3.connect(str(path))
        self.con.row_factory = sqlite3.Row
        for table, spec in TABLES.items():
            cols = ", ".join(
                f'"{f["key"]}" {"REAL" if f["kind"] in NUM_KINDS else "TEXT"}' for f in spec)
            self.con.execute(
                f"CREATE TABLE IF NOT EXISTS {table} "
                f"(id INTEGER PRIMARY KEY AUTOINCREMENT, {cols})")
            # upgrade databases created by an older version of the app
            have = {r["name"] for r in self.con.execute(f"PRAGMA table_info({table})")}
            for f in spec:
                if f["key"] not in have:
                    typ = "REAL" if f["kind"] in NUM_KINDS else "TEXT"
                    self.con.execute(f'ALTER TABLE {table} ADD COLUMN "{f["key"]}" {typ}')
        self.con.commit()
        if not self.q("SELECT 1 FROM deductees LIMIT 1"):      # carry over deductees already used
            self.con.execute(
                "INSERT INTO deductees (name, pan, status) SELECT deductee_name, MAX(COALESCE(deductee_pan,'')), "
                "'Active' FROM tds_entries WHERE COALESCE(deductee_name,'')<>'' GROUP BY deductee_name COLLATE NOCASE")
            self.con.commit()
        if not self.q("SELECT 1 FROM tds_sections LIMIT 1"):
            self.add_default_sections()

    def add_default_sections(self):
        """Insert every default section that is not in the table yet; returns how many."""
        keys = [f["key"] for f in TABLES["tds_sections"]]
        have = {r[0].lower() for r in self.q("SELECT label FROM tds_sections")}
        n = 0
        for row in SECTION_DEFAULTS:
            if row[0].lower() in have:
                continue
            self.con.execute(f"INSERT INTO tds_sections ({','.join(keys)}) "
                             f"VALUES ({','.join('?' * len(keys))})", row)
            n += 1
        self.con.commit()
        return n

    def q(self, sql, args=()):
        return self.con.execute(sql, args).fetchall()

    def x(self, sql, args=()):
        cur = self.con.execute(sql, args)
        self.con.commit()
        return cur


# --------------------------------------------------------------------------- #
# Generic CRUD tab (used for Team, Clients, Units, Tasks, TDS Entries)
# --------------------------------------------------------------------------- #
class CrudTab(ttk.Frame):
    CASCADE_TABLES = ("tasks", "tds_entries")   # client -> unit / branch filtering

    def __init__(self, parent, db, table, title, before_save=None, row_tag=None,
                 info_fn=None, on_section=None, banner=None, extra_buttons=(), links=None,
                 order_by="id DESC", after_save=None, keep_on_add=()):
        super().__init__(parent, padding=(14, 12))
        self.db, self.table, self.spec = db, table, TABLES[table]
        self.before_save, self.row_tag = before_save, row_tag
        self.info_fn, self.on_section, self.links = info_fn, on_section, links or {}
        self.loading = False
        self.order_by, self.after_save, self.keep_on_add = order_by, after_save, keep_on_add
        self.selected_id = None
        self.saving_id = None          # id of the record being saved (None while adding)
        self.vars, self.widgets = {}, {}

        # ---- left: form card
        form = ttk.LabelFrame(self, text=f"  {title} Details  ", style="Card.TLabelframe", padding=14)
        form.pack(side="left", fill="y", padx=(0, 14))
        two = len(self.spec) > 12                       # long forms use two columns
        per_col = (len(self.spec) + 1) // 2 if two else len(self.spec)
        cw, ew = (22, 24) if two else (28, 31)
        for i, f in enumerate(self.spec):
            r, c = (i % per_col, (i // per_col) * 2) if two else (i, 0)
            label = f["label"] + (" *" if f["required"] else "")
            ttk.Label(form, text=label, style="Card.TLabel").grid(
                row=r, column=c, sticky="w", pady=4, padx=(0 if c == 0 else 18, 0))
            var = tk.StringVar()
            self.vars[f["key"]] = var
            if f["auto"]:
                w = ttk.Entry(form, textvariable=var, width=ew, state="readonly")
            elif f["options"] is not None:
                w = ttk.Combobox(form, textvariable=var, width=cw,
                                 state="normal" if f["editable"] else "readonly")
            elif f["kind"] == "date":
                w = DateEntry(form, var, width=cw - 6)
            else:
                w = ttk.Entry(form, textvariable=var, width=ew)
            w.grid(row=r, column=c + 1, padx=(10, 0), pady=4, sticky="w")
            self.widgets[f["key"]] = w
        span = 4 if two else 2
        nxt = per_col
        if banner:
            ttk.Label(form, text=banner, style="CardMuted.TLabel", wraplength=640 if two else 380,
                      justify="left").grid(row=nxt, column=0, columnspan=span, sticky="w", pady=(8, 2))
            nxt += 1
        self.info_var = tk.StringVar()
        if info_fn:
            ttk.Label(form, textvariable=self.info_var, style="Card.TLabel", wraplength=640,
                      justify="left", foreground=NAVY_2).grid(
                row=nxt, column=0, columnspan=span, sticky="w", pady=(6, 2))
            nxt += 1
        self.note_var = tk.StringVar()
        ttk.Label(form, textvariable=self.note_var, style="Card.TLabel", foreground=GREEN,
                  wraplength=640 if two else 380, justify="left").grid(
            row=nxt, column=0, columnspan=span, sticky="w", pady=(2, 2))
        nxt += 1
        ttk.Label(form, text="Dates: use the calendar button or type DD-MM-YYYY.   * required",
                  style="CardMuted.TLabel").grid(row=nxt, column=0, columnspan=span,
                                                 sticky="w", pady=(8, 2))
        bar = ttk.Frame(form, style="Card.TFrame")
        bar.grid(row=nxt + 1, column=0, columnspan=span, pady=(10, 0), sticky="w")
        for text, cmd, sty in (("Add", self.add, "Primary.TButton"), ("Update", self.update, "TButton"),
                               ("Delete", self.delete, "Danger.TButton"), ("Clear", self.clear, "TButton")):
            ttk.Button(bar, text=text, width=8, style=sty, command=cmd).pack(side="left", padx=(0, 6))
        for text, cmd in extra_buttons:
            ttk.Button(bar, text=text, command=lambda c=cmd: c(self)).pack(side="left", padx=(6, 0))
        if on_section and "section" in self.widgets:
            self.widgets["section"].bind("<<ComboboxSelected>>", lambda e: self.section_picked())
            self.widgets["section"].bind("<FocusOut>", lambda e: self.section_picked())
            self.vars["section"].trace_add("write", lambda *_: self.section_picked())
        for key, fn in self.links.items():          # linked dropdowns
            self.widgets[key].bind("<<ComboboxSelected>>",
                                   lambda e, fn=fn: None if self.loading else fn(self))

        # unit / branch list follows the selected client (Task Management, TDS Entries)
        self.cascade = table in self.CASCADE_TABLES and "client" in self.vars and "unit" in self.vars
        if self.cascade:
            self.widgets["client"].bind("<<ComboboxSelected>>", self.client_picked)
            self.widgets["unit"].bind("<<ComboboxSelected>>", self.unit_picked)

        # ---- right: search + table
        right = ttk.Frame(self)
        right.pack(side="left", fill="both", expand=True)
        top = ttk.Frame(right)
        top.pack(fill="x", pady=(0, 8))
        ttk.Label(top, text="Search").pack(side="left")
        self.search = tk.StringVar()
        self.search.trace_add("write", lambda *_: self.load())
        ttk.Entry(top, textvariable=self.search, width=32).pack(side="left", padx=8)
        ttk.Button(top, text="Export...", command=self.export).pack(side="right")
        self.count_lbl = ttk.Label(top, text="", style="Muted.TLabel")
        self.count_lbl.pack(side="right", padx=12)

        cols = ["id"] + [f["key"] for f in self.spec]
        wrap = ttk.Frame(right)
        wrap.pack(fill="both", expand=True)
        self.tree = ttk.Treeview(wrap, columns=cols, show="headings", selectmode="browse")
        for c, name in zip(cols, ["ID"] + [f["label"].split(" (")[0] for f in self.spec]):
            self.tree.heading(c, text=name)
            self.tree.column(c, width=48 if c == "id" else 135, minwidth=48, anchor="w")
        ys = ttk.Scrollbar(wrap, orient="vertical", command=self.tree.yview)
        xs = ttk.Scrollbar(wrap, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=ys.set, xscrollcommand=xs.set)
        ys.pack(side="right", fill="y")
        xs.pack(side="bottom", fill="x")
        self.tree.pack(fill="both", expand=True)
        self.tree.tag_configure("odd", background=ZEBRA)
        self.tree.tag_configure("overdue", foreground=RED)
        self.tree.tag_configure("done", foreground=GREEN)
        self.tree.bind("<<TreeviewSelect>>", self.on_select)
        self.refresh()

    # -- client -> unit / branch cascade
    def refresh_units(self):
        if not self.cascade:
            return
        client = self.vars["client"].get().strip()
        if client:
            rows = self.db.q("SELECT DISTINCT unit_name FROM units WHERE client=? "
                             "AND COALESCE(unit_name,'')<>'' ORDER BY unit_name", (client,))
        else:
            rows = self.db.q("SELECT DISTINCT unit_name FROM units "
                             "WHERE COALESCE(unit_name,'')<>'' ORDER BY unit_name")
        self.widgets["unit"]["values"] = [""] + [r[0] for r in rows]

    def client_picked(self, _e=None):
        self.refresh_units()
        if self.vars["unit"].get() not in self.widgets["unit"]["values"]:
            self.vars["unit"].set("")

    def unit_picked(self, _e=None):
        unit = self.vars["unit"].get().strip()
        if unit and not self.vars["client"].get().strip():
            r = self.db.q("SELECT client FROM units WHERE unit_name=? AND COALESCE(client,'')<>'' "
                          "ORDER BY id LIMIT 1", (unit,))
            if r:
                self.vars["client"].set(r[0][0])
                self.refresh_units()

    # -- data plumbing
    def reload_options(self):
        for f in self.spec:
            if f["options"] is not None:
                opts = f["options"](self.db) if callable(f["options"]) else f["options"]
                self.widgets[f["key"]]["values"] = [""] + list(opts)

    def refresh(self):
        self.reload_options()
        self.refresh_units()
        self.load()

    def section_picked(self):
        if self.loading:
            return
        if self.on_section:
            self.on_section(self)
        self.update_info()

    def update_info(self):
        if self.info_fn:
            self.info_var.set(self.info_fn(self))

    def set_auto(self, key, value):
        self.vars[key].set("" if value is None else value)

    def display(self, f, value):
        if value is None:
            return ""
        if f["kind"] == "date":
            return to_dmy(value)
        if f["kind"] == "pct":
            return f"{value:g}"
        if f["kind"] == "number":
            return inr(value)
        return value

    def load(self):
        self.tree.delete(*self.tree.get_children())
        needle = self.search.get().strip().lower()
        shown = 0
        for r in self.db.q(f"SELECT * FROM {self.table} ORDER BY {self.order_by}"):
            row = dict(r)
            vals = [row["id"]] + [self.display(f, row[f["key"]]) for f in self.spec]
            if needle and needle not in " ".join(str(v) for v in vals).lower():
                continue
            tags = ["odd"] if shown % 2 else []
            if self.row_tag and self.row_tag(row):
                tags.append(self.row_tag(row))
            self.tree.insert("", "end", iid=str(row["id"]), values=vals, tags=tuple(tags))
            shown += 1
        self.count_lbl.config(text=f"{shown} record(s)")

    def on_select(self, _event=None):
        sel = self.tree.selection()
        if not sel:
            return
        self.selected_id = int(sel[0])
        row = dict(self.db.q(f"SELECT * FROM {self.table} WHERE id=?", (self.selected_id,))[0])
        self.loading = True
        for f in self.spec:
            self.vars[f["key"]].set(self.display(f, row[f["key"]]))
        self.loading = False
        self.update_info()

    def collect(self):
        data = {}
        for f in self.spec:
            raw = self.vars[f["key"]].get().strip()
            if f["required"] and not raw:
                raise ValueError(f"{f['label']} is required.")
            if f["kind"] == "date":
                raw = to_iso(raw)
            elif f["kind"] == "pan":
                raw = raw.upper()
                if raw and not PAN_RE.match(raw):
                    raise ValueError(f"Invalid PAN format: {raw}")
            elif f["kind"] == "tan":
                raw = raw.upper()
                if raw and not TAN_RE.match(raw):
                    raise ValueError(f"Invalid TAN format: {raw}")
            elif f["kind"] == "bsr":
                if raw and not re.fullmatch(r"[0-9]{7}", raw):
                    raise ValueError("BSR Code must be exactly 7 digits.")
            elif f["kind"] in NUM_KINDS:
                try:
                    raw = float(raw.replace(",", "")) if raw else None
                except ValueError:
                    raise ValueError(f"{f['label']} must be a number.")
            data[f["key"]] = raw
        if self.before_save:
            self.before_save(data, self)
        return data

    # -- actions
    def add(self):
        self.saving_id = None
        try:
            data = self.collect()
        except ValueError as e:
            return messagebox.showerror(APP_NAME, str(e))
        keys = list(data)
        cur = self.db.x(f"INSERT INTO {self.table} ({','.join(keys)}) "
                        f"VALUES ({','.join('?' * len(keys))})", [data[k] for k in keys])
        msg = self.after_save(data, self, cur.lastrowid) if self.after_save else None
        kept = {k: self.vars[k].get() for k in self.keep_on_add}
        self.clear()
        for k, v in kept.items():                      # same deductor: next entry starts fresh
            self.vars[k].set(v)
        self.refresh()
        if self.tree.exists(str(cur.lastrowid)):
            self.tree.see(str(cur.lastrowid))
        self.note_var.set(msg or "")
        if self.keep_on_add and "deductee_name" in self.widgets:
            self.widgets["deductee_name"].focus_set()

    def update(self):
        if not self.selected_id:
            return messagebox.showinfo(APP_NAME, "Select a record from the list first.")
        self.saving_id = self.selected_id
        try:
            data = self.collect()
        except ValueError as e:
            return messagebox.showerror(APP_NAME, str(e))
        sets = ",".join(f"{k}=?" for k in data)
        self.db.x(f"UPDATE {self.table} SET {sets} WHERE id=?",
                  [*data.values(), self.selected_id])
        msg = self.after_save(data, self, self.selected_id) if self.after_save else None
        self.refresh()
        self.note_var.set(msg or "")
        if self.tree.exists(str(self.selected_id)):
            self.tree.selection_set(str(self.selected_id))

    def delete(self):
        if not self.selected_id:
            return messagebox.showinfo(APP_NAME, "Select a record from the list first.")
        if messagebox.askyesno(APP_NAME, "Delete the selected record permanently?"):
            self.db.x(f"DELETE FROM {self.table} WHERE id=?", (self.selected_id,))
            self.clear()
            self.refresh()

    def clear(self):
        self.selected_id = None
        self.loading = True
        for v in self.vars.values():
            v.set("")
        self.loading = False
        self.tree.selection_remove(self.tree.selection())
        self.reload_options()
        self.refresh_units()
        self.update_info()
        self.note_var.set("")

    def export(self):
        """Export the rows currently shown (respects the search box)."""
        rows = []
        for iid in self.tree.get_children():
            r = self.db.q(f"SELECT * FROM {self.table} WHERE id=?", (int(iid),))[0]
            row = [r["id"]]
            for f in self.spec:
                v = r[f["key"]]
                if f["kind"] == "date":
                    v = to_dmy(v)
                row.append("" if v is None else v)
            rows.append(row)
        export_data(self, ["ID"] + [f["label"].split(" (")[0] for f in self.spec], rows,
                    self.table, self.table.replace("_", " ").title())


# --------------------------------------------------------------------------- #
# Hooks for individual tabs
# --------------------------------------------------------------------------- #
def task_before_save(data, tab=None):
    if data["status"] == "Completed" and not data["completed_on"]:
        data["completed_on"] = dt.date.today().isoformat()
    if data["status"] != "Completed":
        data["completed_on"] = ""


def task_row_tag(row):
    if row["status"] == "Completed":
        return "done"
    if row["due_date"] and row["due_date"] < dt.date.today().isoformat():
        return "overdue"
    return ""


def find_section(db, label):
    if not (label or "").strip():
        return None
    r = db.q("SELECT * FROM tds_sections WHERE label=? COLLATE NOCASE ORDER BY id LIMIT 1",
             (label.strip(),))
    return dict(r[0]) if r else None


def fy_of(iso):
    d = dt.date.fromisoformat(iso)
    y = d.year if d.month >= 4 else d.year - 1
    return f"{y}-{str(y + 1)[2:]}"


def period_bounds(iso, basis):
    """First and last date (ISO) of the cumulative period that contains iso."""
    d = dt.date.fromisoformat(iso)
    if basis == MO_:
        nxt = dt.date(d.year + (d.month == 12), d.month % 12 + 1, 1)
        return d.replace(day=1).isoformat(), (nxt - dt.timedelta(days=1)).isoformat()
    return fy_bounds(fy_of(iso))


def same_deductee_sql(data):
    """SQL filter + args that match earlier entries of the same deductor and deductee."""
    sql, args = "COALESCE(client,'')=?", [data.get("client") or ""]
    if (data.get("deductee_pan") or "").strip():
        sql += " AND deductee_pan=?"
        args.append(data["deductee_pan"])
    else:
        sql += " AND deductee_name=? COLLATE NOCASE"
        args.append(data["deductee_name"])
    return sql, args


def cur_key(name):
    return (name or "").lower() if name is not None else None


def fmt_pct(x):
    return f"{x:g}%"


def compute_tds(db, data, exclude_id=None):
    """Fill base / cumulative / rate / TDS / status in data (a dict of one TDS entry).

    * Payments are taken excluding GST / other taxes shown separately in the invoice.
    * The threshold is tested on the cumulative payments to the same deductee, same section,
      for the financial year (or month) of the payment.  Once it is crossed, TDS is due on the
      whole cumulative amount (or only on the excess, for 194Q / 194N) and the amount not yet
      deducted on earlier payments is caught up on this entry.
    """
    sec = find_section(db, data["section"])
    gross = data["amount_paid"] or 0.0
    taxes = data["taxes_amount"] or 0.0
    base = max(gross - taxes, 0.0) if data["amount_paid"] is not None else None
    data["base_amount"] = base
    data["cum_amount"] = None
    data["tax_status"] = ""
    if sec:
        data["new_section"] = sec["new_section"] or ""
        data["return_code"] = sec["return_code"] or ""
    if base is None or not data["payment_date"]:
        return

    # rate
    rate_note = ""
    if data["rate"] is None and sec and sec["rate"] is not None:
        rate = sec["rate"]
        if not (data["deductee_pan"] or "").strip() and rate > 0:
            nopan = sec["rate_no_pan"] if sec["rate_no_pan"] is not None else 20
            if nopan > rate:
                rate, rate_note = nopan, " (no PAN: higher rate u/s 206AA)"
        data["rate"] = rate
    rate = data["rate"]

    # cumulative payments so far
    basis = sec["cum_basis"] if sec else ""
    prior_base = prior_tds = 0.0
    if sec and basis:
        lo, hi = period_bounds(data["payment_date"], basis)
        flt, args = same_deductee_sql(data)
        q = ("SELECT COALESCE(SUM(COALESCE(base_amount, amount_paid-COALESCE(taxes_amount,0), 0)),0) b, "
             "COALESCE(SUM(COALESCE(tds_amount,0)),0) t FROM tds_entries WHERE " + flt +
             " AND section=? COLLATE NOCASE AND payment_date BETWEEN ? AND ?"
             " AND (payment_date<? OR (payment_date=? AND id<?))")      # earlier entries only
        args += [data["section"], lo, hi, data["payment_date"], data["payment_date"],
                 exclude_id if exclude_id else 1 << 60]
        r = db.q(q, args)[0]
        prior_base, prior_tds = float(r["b"]), float(r["t"])
    cum = prior_base + base
    data["cum_amount"] = cum

    if rate is None:
        data["tax_status"] = "No rate - enter rate or TDS manually"
        return
    single, limit = (sec["single_limit"], sec["cum_limit"]) if sec else (None, None)
    excess_only = bool(sec) and sec["on_excess"] == "Yes"
    over_single = bool(single) and base > single
    over_cum = bool(limit) and basis and cum > limit
    per = "month" if basis == MO_ else "year"

    if not sec or (not single and not limit):
        auto_tds, status = round(base * rate / 100), "Liable - no threshold" + rate_note
    elif excess_only and over_cum:
        due = round(max(cum - limit, 0) * rate / 100) - round(prior_tds)
        auto_tds = max(due, 0)
        status = f"Excess over {inr(limit)} - TDS on the excess only" + rate_note
    elif over_cum:
        due = round(cum * rate / 100) - round(prior_tds)
        auto_tds = max(due, 0)
        if prior_base > 0 and prior_base <= limit:
            status = (f"Threshold {inr(limit)} crossed this {per} - TDS on cumulative "
                      f"{inr(cum)} (catch-up on earlier payments)")
        else:
            status = f"Above threshold {inr(limit)} - liable" + rate_note
    elif over_single:
        auto_tds, status = round(base * rate / 100), f"Single payment above {inr(single)} - liable" + rate_note
    else:
        auto_tds = 0
        lim = limit if limit else single
        status = f"Below threshold ({inr(cum)} of {inr(lim)}) - no TDS"
    if data["tds_amount"] is None:
        data["tds_amount"] = float(auto_tds)
    else:
        status += " | TDS entered manually"
    data["tax_status"] = status


def recalc_entries(db, where="", args=()):
    """Re-run the threshold / cumulative logic in date order (earlier entries first).
    Manually typed TDS amounts are kept; auto amounts are recomputed."""
    n = 0
    for r in db.q("SELECT * FROM tds_entries " + where + " ORDER BY payment_date, id", args):
        d = dict(r)
        rid = d.pop("id")
        if d["amount_paid"] is None or not d["payment_date"]:
            continue
        manual = (not d["tax_status"]) or "TDS entered manually" in d["tax_status"]
        if not manual:
            d["tds_amount"] = None
        compute_tds(db, d, rid)
        db.x("UPDATE tds_entries SET base_amount=?, cum_amount=?, rate=?, tds_amount=?, tax_status=? "
             "WHERE id=?", (d["base_amount"], d["cum_amount"], d["rate"], d["tds_amount"],
                            d["tax_status"], rid))
        n += 1
    return n


def tds_after_save(data, tab, rid):
    """Later entries of the same deductee / section depend on this one, so refresh them too."""
    flt, args = same_deductee_sql(data)
    recalc_entries(tab.db, "WHERE " + flt + " AND section=? COLLATE NOCASE", args + [data["section"]])
    r = tab.db.q("SELECT tds_amount, tax_status FROM tds_entries WHERE id=?", (rid,))[0]
    return (f"Entry #{rid} saved - TDS {inr(r['tds_amount'] or 0)}  ({r['tax_status'] or 'no status'}).  "
            "Form is ready for a fresh entry.")


def recalc_all(tab):
    if messagebox.askyesno(APP_NAME, "Recalculate base amount, cumulative payments, rate and TDS for ALL "
                                     "entries in date order?\nTDS amounts you typed manually are kept."):
        n = recalc_entries(tab.db)
        tab.refresh()
        messagebox.showinfo(APP_NAME, f"{n} entr{'y' if n == 1 else 'ies'} recalculated.")


def tds_before_save(data, tab):
    compute_tds(tab.db, data, tab.saving_id)
    if data["deposit_date"] and data["deposited_amount"] is None:
        data["deposited_amount"] = data["tds_amount"]


def _set_values(tab, key, values):
    tab.widgets[key]["values"] = [""] + list(values)


def _reset_code_lists(tab):
    for key, col in (("new_section", "new_section"), ("return_code", "return_code")):
        _set_values(tab, key, lookup("tds_sections", col)(tab.db))


def tds_on_section(tab):
    """Section picked / typed: bring in new section, return code and a purpose suggestion."""
    sec = find_section(tab.db, tab.vars["section"].get())
    if not sec:
        return
    tab.vars["new_section"].set(sec["new_section"] or "")
    tab.vars["return_code"].set(sec["return_code"] or "")
    _reset_code_lists(tab)
    if sec["nature"] and not tab.vars["purpose"].get().strip():
        tab.vars["purpose"].set(sec["nature"])      # editable suggestion


def tds_pick_new_section(tab):
    """New section picked: narrow the return codes; a single match sets section and code."""
    ns = tab.vars["new_section"].get().strip()
    rows = tab.db.q("SELECT * FROM tds_sections WHERE new_section=? ORDER BY id", (ns,))
    codes = []
    for r in rows:
        if r["return_code"] and r["return_code"] not in codes:
            codes.append(r["return_code"])
    _set_values(tab, "return_code", codes)
    sec_names = [r["label"] for r in rows]
    _set_values(tab, "section", sec_names or section_labels(tab.db))
    if len(rows) == 1:
        tab.vars["section"].set(rows[0]["label"])
        tab.vars["return_code"].set(rows[0]["return_code"] or "")
    elif len(codes) == 1:
        tab.vars["return_code"].set(codes[0])
    else:
        tab.vars["return_code"].set("")
    tab.update_info()


def tds_pick_code(tab):
    """Return code picked: set the matching section (and new section)."""
    code, ns = tab.vars["return_code"].get().strip(), tab.vars["new_section"].get().strip()
    rows = tab.db.q("SELECT * FROM tds_sections WHERE return_code=? ORDER BY id", (code,))
    if ns:
        rows = [r for r in rows if r["new_section"] == ns] or rows
    if rows:
        _set_values(tab, "section", [r["label"] for r in rows])
        tab.vars["new_section"].set(rows[0]["new_section"] or "")
        if len(rows) == 1:
            tab.vars["section"].set(rows[0]["label"])
    tab.update_info()


def tds_pick_name(tab):
    """Deductee picked from Deductee Details: bring in the PAN."""
    name = tab.vars["deductee_name"].get().strip()
    r = tab.db.q("SELECT pan FROM deductees WHERE name=? COLLATE NOCASE ORDER BY id LIMIT 1", (name,))
    if r and r[0][0]:
        tab.vars["deductee_pan"].set(r[0][0])


def tds_pick_pan(tab):
    """PAN picked from Deductee Details: bring in the deductee name."""
    pan = tab.vars["deductee_pan"].get().strip().upper()
    r = tab.db.q("SELECT name FROM deductees WHERE pan=? ORDER BY id LIMIT 1", (pan,))
    if r:
        tab.vars["deductee_name"].set(r[0][0])


def tds_info(tab):
    label = tab.vars["section"].get().strip()
    sec = find_section(tab.db, label)
    if not label:
        return "Pick a section to see its new section, return code, rate and threshold."
    if not sec:
        return "Section not found in the TDS Sections tab - enter rate and TDS manually."
    parts = [f"{sec['nature'] or label}", f"Old s.{sec['old_section'] or '-'}  ->  New s.{sec['new_section'] or '-'}",
             f"Return code {sec['return_code'] or '-'} ({sec['return_form'] or '-'})"]
    r = sec["rate"]
    rate = "Rate: manual" if not r else f"Rate {fmt_pct(r)}"
    if sec["rate_no_pan"] and r and sec["rate_no_pan"] > r:
        rate += f" (no PAN {fmt_pct(sec['rate_no_pan'])})"
    parts.append(rate)
    lim = []
    if sec["single_limit"]:
        lim.append(f"single payment > {inr(sec['single_limit'])}")
    if sec["cum_limit"]:
        lim.append(f"cumulative > {inr(sec['cum_limit'])} per "
                   f"{'month' if sec['cum_basis'] == MO_ else 'financial year'}"
                   + (" (TDS on excess only)" if sec["on_excess"] == "Yes" else ""))
    parts.append("Threshold: " + (" or ".join(lim) if lim else "none"))
    if tab.vars["tax_status"].get():
        parts.append("Status: " + tab.vars["tax_status"].get())
    return "   |   ".join(parts)


def sections_before_save(data, tab):
    r = tab.db.q("SELECT id FROM tds_sections WHERE label=? COLLATE NOCASE", (data["label"],))
    if any(x["id"] != tab.saving_id for x in r):
        raise ValueError(f"Section '{data['label']}' already exists. Edit that row instead.")


def restore_sections(tab):
    if messagebox.askyesno(APP_NAME, "Re-add any default sections that are missing?\n"
                                     "Rows you have edited or added are not changed."):
        n = tab.db.add_default_sections()
        tab.refresh()
        messagebox.showinfo(APP_NAME, f"{n} default section(s) added.")


SECTIONS_BANNER = ("Master used by TDS Entries for the new section, return code, rate and thresholds. "
                   "Rates, limits and return codes follow the Income-tax Act, 2025 as understood at the "
                   "time of writing - verify against the law and the return utility in force, and edit here.")


# --------------------------------------------------------------------------- #
# Dashboard
# --------------------------------------------------------------------------- #
class HBars(tk.Canvas):
    """Small horizontal bar chart: items = [(label, value, colour, value_text)]."""

    def __init__(self, parent, height=130):
        super().__init__(parent, height=height, bg=CARD, highlightthickness=0)
        self.items = []
        self.bind("<Configure>", lambda e: self.redraw())

    def set(self, items):
        self.items = items
        self.redraw()

    def redraw(self):
        self.delete("all")
        w = self.winfo_width()
        x0, x1 = 112, w - 150
        if w < 60 or x1 <= x0:
            return
        top = max([v for _, v, _, _ in self.items] + [1])
        for n, (label, val, color, text) in enumerate(self.items):
            y = 8 + n * 30
            self.create_text(0, y + 10, anchor="w", text=label, fill=INK, font=ft(10))
            self.create_rectangle(x0, y + 3, x1, y + 17, fill=TRACK, outline="")
            if val > 0:
                self.create_rectangle(x0, y + 3, x0 + (x1 - x0) * val / top, y + 17,
                                      fill=color, outline="")
            self.create_text(w, y + 10, anchor="e", text=text, fill=NAVY, font=ft(10, True))


class Dashboard(ttk.Frame):
    CARDS = [
        ("clients", "Clients", NAVY_2, "Active clients"),
        ("units", "Units / Branches", NAVY_2, "Active units"),
        ("team", "Team Members", NAVY_2, "Active members"),
        ("open", "Open Tasks", AMBER, "Not yet completed"),
        ("overdue", "Overdue Tasks", RED, "Past their due date"),
        ("deducted", "TDS Deducted (Rs)", NAVY_2, ""),
        ("deposited", "TDS Deposited (Rs)", GREEN, ""),
        ("balance", "Balance Payable (Rs)", AMBER, ""),
    ]

    def __init__(self, parent, db):
        super().__init__(parent, padding=(14, 12))
        self.db = db
        top = ttk.Frame(self)
        top.pack(fill="x")
        ttk.Label(top, text="Practice Overview", style="Title.TLabel").pack(side="left")
        self.fy = tk.StringVar(value=fy_list()[0])
        cb = ttk.Combobox(top, textvariable=self.fy, values=fy_list(), width=10, state="readonly")
        cb.pack(side="right")
        ttk.Label(top, text="Financial Year", style="Muted.TLabel").pack(side="right", padx=8)
        cb.bind("<<ComboboxSelected>>", lambda e: self.refresh())

        grid = ttk.Frame(self)
        grid.pack(fill="x", pady=(10, 4))
        self.vals, self.subs = {}, {}
        for i, (key, title, accent, sub) in enumerate(self.CARDS):
            card = tk.Frame(grid, bg=CARD, highlightthickness=1, highlightbackground=LINE)
            card.grid(row=i // 4, column=i % 4, padx=6, pady=6, sticky="nsew")
            grid.columnconfigure(i % 4, weight=1, uniform="kpi")
            tk.Frame(card, bg=accent, width=5).pack(side="left", fill="y")
            inner = tk.Frame(card, bg=CARD, padx=14, pady=10)
            inner.pack(side="left", fill="both", expand=True)
            tk.Label(inner, text=title.upper(), bg=CARD, fg=MUTED, font=ft(8, True)).pack(anchor="w")
            v = tk.Label(inner, text="0", bg=CARD, fg=NAVY, font=ft(21, True))
            v.pack(anchor="w")
            s = tk.Label(inner, text=sub, bg=CARD, fg=MUTED, font=ft(8))
            s.pack(anchor="w")
            self.vals[key], self.subs[key] = v, s

        mid = ttk.Frame(self)
        mid.pack(fill="x", pady=(6, 8))
        mid.columnconfigure(0, weight=1, uniform="p")
        mid.columnconfigure(1, weight=1, uniform="p")
        p1 = ttk.LabelFrame(mid, text="  Task status  ", style="Card.TLabelframe", padding=12)
        p1.grid(row=0, column=0, sticky="nsew", padx=6)
        self.task_bars = HBars(p1, 130)
        self.task_bars.pack(fill="x", expand=True)
        p2 = ttk.LabelFrame(mid, text="  TDS position for the financial year  ",
                            style="Card.TLabelframe", padding=12)
        p2.grid(row=0, column=1, sticky="nsew", padx=6)
        self.tds_bars = HBars(p2, 130)
        self.tds_bars.pack(fill="x", expand=True)

        tbl = ttk.LabelFrame(self, text="  Upcoming & overdue tasks  ", style="Card.TLabelframe", padding=8)
        tbl.pack(fill="both", expand=True, padx=6)
        cols = ("due", "task", "client", "unit", "form", "month", "assigned", "status", "days")
        self.tree = ttk.Treeview(tbl, columns=cols, show="headings", height=7)
        heads = ["Due Date", "Task", "Client", "Unit / Branch", "Form", "Month", "Assigned To", "Status", "Days Left"]
        widths = [90, 230, 170, 150, 80, 90, 130, 100, 80]
        for c, t, w in zip(cols, heads, widths):
            self.tree.heading(c, text=t)
            self.tree.column(c, width=w, minwidth=60, anchor="w")
        ys = ttk.Scrollbar(tbl, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=ys.set)
        ys.pack(side="right", fill="y")
        self.tree.pack(fill="both", expand=True)
        self.tree.tag_configure("odd", background=ZEBRA)
        self.tree.tag_configure("overdue", foreground=RED)
        self.refresh()

    def one(self, sql, args=()):
        return self.db.q(sql, args)[0][0] or 0

    def refresh(self):
        today = dt.date.today().isoformat()
        fy = self.fy.get()
        start, end = fy_bounds(fy)
        db = self.db
        live = "COALESCE(status,'')<>'Inactive'"
        self.vals["clients"].config(text=str(self.one(f"SELECT COUNT(*) FROM clients WHERE {live}")))
        self.vals["units"].config(text=str(self.one(f"SELECT COUNT(*) FROM units WHERE {live}")))
        self.vals["team"].config(text=str(self.one(f"SELECT COUNT(*) FROM team WHERE {live}")))
        open_n = self.one("SELECT COUNT(*) FROM tasks WHERE status<>'Completed'")
        late_n = self.one("SELECT COUNT(*) FROM tasks WHERE status<>'Completed' AND due_date<>'' AND due_date<?", (today,))
        self.vals["open"].config(text=str(open_n))
        self.vals["overdue"].config(text=str(late_n))
        ded = self.one("SELECT SUM(tds_amount) FROM tds_entries WHERE payment_date BETWEEN ? AND ?", (start, end))
        dep = self.one("SELECT SUM(deposited_amount) FROM tds_entries WHERE payment_date BETWEEN ? AND ?", (start, end))
        self.vals["deducted"].config(text=inr(ded))
        self.vals["deposited"].config(text=inr(dep))
        self.vals["balance"].config(text=inr(ded - dep))
        pct = f"{dep / ded * 100:.0f}% of deducted" if ded else "No entries yet"
        self.subs["deducted"].config(text=f"FY {fy}")
        self.subs["deposited"].config(text=pct)
        self.subs["balance"].config(text="Deducted less deposited")

        n = lambda s: self.one("SELECT COUNT(*) FROM tasks WHERE status=?", (s,))
        self.task_bars.set([
            ("Pending", n("Pending"), AMBER, str(n("Pending"))),
            ("In progress", n("In Progress"), NAVY_2, str(n("In Progress"))),
            ("Completed", n("Completed"), GREEN, str(n("Completed"))),
            ("Overdue", late_n, RED, str(late_n)),
        ])
        self.tds_bars.set([
            ("Deducted", ded, NAVY_2, inr(ded)),
            ("Deposited", dep, GREEN, inr(dep)),
            ("Balance", max(ded - dep, 0), AMBER, inr(ded - dep)),
        ])

        self.tree.delete(*self.tree.get_children())
        rows = db.q("SELECT * FROM tasks WHERE status<>'Completed' "
                    "ORDER BY CASE WHEN due_date='' THEN 1 ELSE 0 END, due_date LIMIT 25")
        for n_, r in enumerate(rows):
            days, tags = "", ["odd"] if n_ % 2 else []
            if r["due_date"]:
                d = (dt.date.fromisoformat(r["due_date"]) - dt.date.today()).days
                days = d
                if d < 0:
                    tags.append("overdue")
            self.tree.insert("", "end", tags=tuple(tags), values=(
                to_dmy(r["due_date"]), r["title"], r["client"] or "", r["unit"] or "",
                r["form"] or "", r["month"] or "", r["assigned_to"] or "", r["status"], days))


# --------------------------------------------------------------------------- #
# Reports
# --------------------------------------------------------------------------- #
class Reports(ttk.Frame):
    NAMES = [
        "Client-wise TDS Summary", "Unit / Branch-wise TDS Summary", "Section-wise TDS Summary",
        "Deductee-wise Full Report", "Threshold Monitor (cumulative, excl. taxes)",
        "Pending Tasks", "Overdue Tasks", "Team Workload", "Late TDS Deposits (est. interest)",
    ]
    NOTES = {
        "Deductee-wise Full Report":
            "Every entry of each deductee in date order with GST / taxes excluded, running cumulative, "
            "TDS, deposit and balance, and a total per deductee. Use the Deductee box to pick one.",
        "Threshold Monitor (cumulative, excl. taxes)":
            "Cumulative payments per deductee and section (GST / taxes shown separately are excluded) "
            "against the limits in the TDS Sections tab.",
        "Pending Tasks": "Open tasks whose due date falls within the selected From - To dates.",
        "Overdue Tasks": "All open tasks past their due date as of today (date range not applied).",
        "Team Workload": "All tasks, grouped by assignee (date range not applied).",
    }
    MONEY = {"Gross Amount", "GST / Taxes", "Amount excl. Taxes", "Cumulative excl. Taxes",
             "Payments excl. Taxes", "Threshold Limit", "Balance to Limit", "Amount Paid", "TDS Deducted", "TDS Deposited", "Balance", "TDS", "Est. Interest @1.5%"}

    def __init__(self, parent, db):
        super().__init__(parent, padding=(14, 12))
        self.db = db
        ttk.Label(self, text="Reports", style="Title.TLabel").pack(anchor="w", pady=(0, 8))
        top = ttk.Frame(self, style="Card.TFrame", padding=12)
        top.pack(fill="x")
        ttk.Label(top, text="Report", style="Card.TLabel").pack(side="left")
        self.rep = tk.StringVar(value=self.NAMES[0])
        ttk.Combobox(top, textvariable=self.rep, values=self.NAMES, width=34,
                     state="readonly").pack(side="left", padx=(8, 4))

        ttk.Label(top, text="From", style="Card.TLabel").pack(side="left", padx=(16, 0))
        self.d_from = tk.StringVar()
        DateEntry(top, self.d_from, width=12).pack(side="left", padx=6)
        ttk.Label(top, text="To", style="Card.TLabel").pack(side="left", padx=(8, 0))
        self.d_to = tk.StringVar()
        DateEntry(top, self.d_to, width=12).pack(side="left", padx=6)

        ttk.Label(top, text="FY shortcut", style="Card.TLabel").pack(side="left", padx=(16, 0))
        self.fy = tk.StringVar(value=fy_list()[0])
        fy_cb = ttk.Combobox(top, textvariable=self.fy, values=fy_list(), width=9, state="readonly")
        fy_cb.pack(side="left", padx=6)
        fy_cb.bind("<<ComboboxSelected>>", lambda e: self.apply_fy())
        self.apply_fy()

        ttk.Button(top, text="Run Report", style="Primary.TButton", command=self.run).pack(side="left", padx=(16, 6))
        ttk.Button(top, text="Export...", command=self.export).pack(side="left")
        top2 = ttk.Frame(self, style="Card.TFrame", padding=(12, 0, 12, 10))
        top2.pack(fill="x")
        ttk.Label(top2, text="Deductee (for the Deductee-wise report)", style="Card.TLabel").pack(side="left")
        self.ded = tk.StringVar(value="All deductees")
        self.ded_cb = ttk.Combobox(top2, textvariable=self.ded, width=34, state="readonly",
                                   values=["All deductees"])
        self.ded_cb.pack(side="left", padx=8)
        self.note = ttk.Label(self, text="", style="Muted.TLabel", wraplength=1150, justify="left")
        self.note.pack(anchor="w", pady=(8, 6))
        wrap = ttk.Frame(self)
        wrap.pack(fill="both", expand=True)
        self.tree = ttk.Treeview(wrap, show="headings")
        ys = ttk.Scrollbar(wrap, orient="vertical", command=self.tree.yview)
        xs = ttk.Scrollbar(wrap, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=ys.set, xscrollcommand=xs.set)
        ys.pack(side="right", fill="y")
        xs.pack(side="bottom", fill="x")
        self.tree.pack(fill="both", expand=True)
        self.tree.tag_configure("odd", background=ZEBRA)
        self.tree.tag_configure("total", font=ft(10, True))
        self.columns, self.rows, self.title = [], [], ""

    def refresh(self):
        names = {r[0] for r in self.db.q("SELECT name FROM deductees WHERE COALESCE(name,'')<>''")}
        names |= {r[0] for r in self.db.q(
            "SELECT DISTINCT deductee_name FROM tds_entries WHERE COALESCE(deductee_name,'')<>''")}
        self.ded_cb["values"] = ["All deductees"] + sorted(names, key=str.lower)
        if self.ded.get() not in self.ded_cb["values"]:
            self.ded.set("All deductees")

    def apply_fy(self):
        start, end = fy_bounds(self.fy.get())
        self.d_from.set(to_dmy(start))
        self.d_to.set(to_dmy(end))

    def date_range(self):
        """(from_iso, to_iso); a blank box means no limit on that side."""
        lo = to_iso(self.d_from.get()) or "0001-01-01"
        hi = to_iso(self.d_to.get()) or "9999-12-31"
        if lo > hi:
            raise ValueError("'From' date is after 'To' date.")
        return lo, hi

    # -- report builders return (columns, rows); rows hold RAW numbers
    #    (formatting for the screen is applied later, exports stay plain)
    def summary(self, group_col, label, lo, hi):
        rows = self.db.q(
            f"SELECT COALESCE(NULLIF({group_col},''),'(blank)') g, COUNT(*) n, "
            "SUM(COALESCE(amount_paid,0)) paid, SUM(COALESCE(tds_amount,0)) ded, "
            "SUM(COALESCE(deposited_amount,0)) dep FROM tds_entries "
            "WHERE payment_date BETWEEN ? AND ? GROUP BY g ORDER BY g", (lo, hi))
        out = [(r["g"], r["n"], float(r["paid"]), float(r["ded"]), float(r["dep"]),
                float(r["ded"] - r["dep"])) for r in rows]
        if rows:
            t = [sum(r[k] for r in rows) for k in ("n", "paid", "ded", "dep")]
            out.append(("TOTAL", t[0], float(t[1]), float(t[2]), float(t[3]), float(t[2] - t[3])))
        return [label, "Entries", "Amount Paid", "TDS Deducted", "TDS Deposited", "Balance"], out

    def deductee_full(self, lo, hi):
        sql = "SELECT * FROM tds_entries WHERE payment_date BETWEEN ? AND ?"
        args = [lo, hi]
        if self.ded.get() != "All deductees":
            sql += " AND deductee_name=? COLLATE NOCASE"
            args.append(self.ded.get())
        sql += " ORDER BY deductee_name COLLATE NOCASE, payment_date, id"
        cols = ["Deductee", "PAN", "Payment Date", "Section", "New Section", "Return Code", "Purpose",
                "Client", "Unit / Branch", "Gross Amount", "GST / Taxes", "Amount excl. Taxes",
                "Cumulative excl. Taxes", "Rate %", "TDS Deducted", "Deposit Date", "TDS Deposited",
                "Challan Serial No.", "BSR Code", "Balance", "Status"]
        out, cur, sub, grand = [], None, None, [0.0] * 6

        def close():
            if sub is not None:
                out.append(("TOTAL - " + cur,) + ("",) * 8 + tuple(sub[:3]) + ("", "", sub[3], "", sub[4],
                           "", "", sub[3] - sub[4], ""))
        for r in self.db.q(sql, args):
            key = (r["deductee_name"] or "").lower()
            if key != cur_key(cur):
                close()
                cur, sub = r["deductee_name"], [0.0] * 5
            base = r["base_amount"]
            if base is None:
                base = max((r["amount_paid"] or 0) - (r["taxes_amount"] or 0), 0)
            ded, dep = float(r["tds_amount"] or 0), float(r["deposited_amount"] or 0)
            gross, tax = float(r["amount_paid"] or 0), float(r["taxes_amount"] or 0)
            for i, v in enumerate((gross, tax, base, ded, dep)):
                sub[i] += v
                grand[i] += v
            out.append((r["deductee_name"], r["deductee_pan"] or "", to_dmy(r["payment_date"]),
                        r["section"] or "", r["new_section"] or "", r["return_code"] or "",
                        r["purpose"] or "", r["client"] or "", r["unit"] or "", gross, tax, float(base),
                        float(r["cum_amount"]) if r["cum_amount"] is not None else "",
                        r["rate"] if r["rate"] is not None else "", ded, to_dmy(r["deposit_date"]), dep,
                        r["challan_no"] or "", r["bsr_code"] or "", ded - dep, r["tax_status"] or ""))
        close()
        if out:
            out.append(("TOTAL - ALL DEDUCTEES",) + ("",) * 8 + tuple(grand[:3]) + ("", "", grand[3], "",
                        grand[4], "", "", grand[3] - grand[4], ""))
        return cols, out

    def threshold(self, lo, hi):
        secs = {r["label"].lower(): r for r in self.db.q("SELECT * FROM tds_sections")}
        groups = {}
        for r in self.db.q("SELECT * FROM tds_entries WHERE payment_date BETWEEN ? AND ? "
                           "ORDER BY payment_date", (lo, hi)):
            sec = secs.get((r["section"] or "").lower())
            monthly = bool(sec) and sec["cum_basis"] == MO_
            who = r["deductee_pan"] or (r["deductee_name"] or "").lower()
            key = (r["client"] or "", who, (r["section"] or "").lower(),
                   r["payment_date"][:7] if monthly else "")
            g = groups.setdefault(key, dict(r=r, n=0, base=0.0, tds=0.0, sec=sec, monthly=monthly))
            base = r["base_amount"]
            if base is None:
                base = max((r["amount_paid"] or 0) - (r["taxes_amount"] or 0), 0)
            g["n"] += 1
            g["base"] += base
            g["tds"] += r["tds_amount"] or 0
        out = []
        for g in groups.values():
            r, sec = g["r"], g["sec"]
            limit = sec["cum_limit"] if sec and sec["cum_limit"] else (sec["single_limit"] if sec else None)
            if limit:
                left = limit - g["base"]
                status = "Threshold crossed" if left < 0 else f"Within limit ({g['base'] / limit:.0%} used)"
            else:
                left, status = None, "No threshold"
            out.append((r["client"] or "", r["deductee_name"], r["deductee_pan"] or "", r["section"] or "",
                        (sec["new_section"] if sec else "") or "", (sec["return_code"] if sec else "") or "",
                        (MONTHS[(int(r["payment_date"][5:7]) - 4) % 12] if g["monthly"] else "FY"),
                        g["n"], g["base"], float(limit) if limit else "", left if left is not None else "",
                        g["tds"], status))
        out.sort(key=lambda x: (x[0], x[1], x[3], str(x[6])))
        return ["Client", "Deductee", "PAN", "Section", "New Section", "Return Code", "Period", "Entries",
                "Payments excl. Taxes", "Threshold Limit", "Balance to Limit", "TDS", "Status"], out

    def tasks(self, overdue, lo, hi):
        today = dt.date.today().isoformat()
        sql = "SELECT * FROM tasks WHERE status<>'Completed'"
        if overdue:
            sql += " AND due_date<>'' AND due_date<?"
            args = (today,)
        else:
            sql += " AND due_date BETWEEN ? AND ?"
            args = (lo, hi)
        sql += " ORDER BY due_date"
        rows = [(to_dmy(r["due_date"]), r["title"], r["client"] or "", r["unit"] or "",
                 r["form"] or "", r["fy"] or "", r["month"] or "", r["assigned_to"] or "",
                 r["priority"] or "", r["status"] or "")
                for r in self.db.q(sql, args)]
        return ["Due Date", "Task", "Client", "Unit / Branch", "Form", "FY", "Month", "Assigned To",
                "Priority", "Status"], rows

    def workload(self):
        today = dt.date.today().isoformat()
        rows = self.db.q(
            "SELECT COALESCE(NULLIF(assigned_to,''),'(unassigned)') who, COUNT(*) total, "
            "SUM(status='Completed') done, SUM(status<>'Completed') open, "
            "SUM(status<>'Completed' AND due_date<>'' AND due_date<?) late "
            "FROM tasks GROUP BY who ORDER BY who", (today,))
        return ["Team Member", "Total Tasks", "Completed", "Open", "Overdue"], [
            (r["who"], r["total"], r["done"], r["open"], r["late"]) for r in rows]

    def late_deposits(self, lo, hi):
        today = dt.date.today()
        out = []
        for r in self.db.q("SELECT * FROM tds_entries WHERE payment_date BETWEEN ? AND ? "
                           "AND COALESCE(tds_amount,0)>0 ORDER BY payment_date", (lo, hi)):
            ded_date = dt.date.fromisoformat(r["payment_date"])
            due = deposit_due(ded_date)
            if r["deposit_date"]:
                paid_on, status = dt.date.fromisoformat(r["deposit_date"]), "Deposited late"
            else:
                paid_on, status = today, "Not deposited"
            if paid_on <= due:
                continue
            months = months_part(ded_date, paid_on)
            interest = float(round(r["tds_amount"] * 0.015 * months))
            out.append((r["client"] or "", r["unit"] or "", r["deductee_name"], r["section"] or "",
                        to_dmy(r["payment_date"]), float(r["tds_amount"]), to_dmy(due.isoformat()),
                        to_dmy(r["deposit_date"]), (paid_on - due).days, months, interest, status))
        return ["Client", "Unit / Branch", "Deductee", "Section", "Deducted On", "TDS", "Due Date",
                "Deposited On", "Days Late", "Months", "Est. Interest @1.5%", "Status"], out

    def run(self):
        try:
            lo, hi = self.date_range()
        except ValueError as e:
            return messagebox.showerror(APP_NAME, str(e))
        name = self.rep.get()
        self.note.config(text=self.NOTES.get(
            name, "TDS entries are filtered on the Payment / Deduction Date between From and To."))
        uses_range = True
        if name.startswith("Client-wise"):
            cols, rows = self.summary("client", "Client", lo, hi)
        elif name.startswith("Unit"):
            cols, rows = self.summary("unit", "Unit / Branch", lo, hi)
        elif name.startswith("Section-wise"):
            cols, rows = self.summary("section", "Section", lo, hi)
        elif name.startswith("Deductee-wise"):
            cols, rows = self.deductee_full(lo, hi)
        elif name.startswith("Threshold"):
            cols, rows = self.threshold(lo, hi)
        elif name == "Pending Tasks":
            cols, rows = self.tasks(False, lo, hi)
        elif name == "Overdue Tasks":
            cols, rows = self.tasks(True, lo, hi)
            uses_range = False
        elif name == "Team Workload":
            cols, rows = self.workload()
            uses_range = False
        else:
            cols, rows = self.late_deposits(lo, hi)
            self.note.config(text="Estimate only: due date = 7th of next month (30 April for March); "
                                  "interest = 1.5% per month or part of month from deduction to deposit. "
                                  "Check the exceptions (e.g. government deductors) before relying on it.")
        title = name
        if uses_range:
            title += f"  ({self.d_from.get() or 'start'} to {self.d_to.get() or 'latest'})"
        else:
            title += f"  (as on {dt.date.today():%d-%m-%Y})"
        self.columns, self.rows, self.title = cols, rows, title

        self.tree.delete(*self.tree.get_children())
        self.tree["columns"] = cols
        for c in cols:
            self.tree.heading(c, text=c)
            wide = 210 if c in ("Deductee", "Purpose", "Status") else 0
            self.tree.column(c, width=max(100, len(c) * 9 + 34, wide), anchor="w")
        money_idx = {i for i, c in enumerate(cols) if c in self.MONEY}
        for n_, r in enumerate(rows):
            tags = ["odd"] if n_ % 2 else []
            if r and str(r[0]).startswith("TOTAL"):
                tags.append("total")
            self.tree.insert("", "end", tags=tuple(tags),
                             values=[inr(v) if i in money_idx and v != "" else v for i, v in enumerate(r)])

    def export(self):
        if not self.rows:
            return messagebox.showinfo(APP_NAME, "Run a report first, then export it.")
        base = re.sub(r"\W+", "_", self.rep.get().split(" (")[0]).strip("_")
        export_data(self, self.columns, self.rows, base, self.title)


# --------------------------------------------------------------------------- #
# Main window
# --------------------------------------------------------------------------- #
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_NAME}  -  {FIRM_NAME}")
        self.geometry("1380x800")
        self.minsize(1180, 680)
        apply_theme(self)
        self.db = DB()

        # ---- branded header
        header = tk.Frame(self, bg=NAVY, padx=22, pady=10)
        header.pack(fill="x")
        self.logo = load_logo(self, LOGO_PNG_B64)
        if self.logo:
            badge = tk.Frame(header, bg=CARD, highlightthickness=2, highlightbackground=GOLD)
            tk.Label(badge, image=self.logo, bg=CARD, padx=8, pady=4).pack()
            badge.pack(side="left")
            icon = load_logo(self, ICON_PNG_B64)
            if icon:
                self.iconphoto(True, icon)      # same logo as the window / taskbar icon
                self._icon = icon
        else:
            mark = tk.Canvas(header, width=46, height=46, bg=NAVY, highlightthickness=0)
            mark.create_rectangle(2, 2, 44, 44, outline=GOLD, width=2)
            mark.create_text(23, 23, text=MONOGRAM, fill=GOLD, font=ft(15, True))
            mark.pack(side="left")
        titles = tk.Frame(header, bg=NAVY)
        titles.pack(side="left", padx=14)
        tk.Label(titles, text=FIRM_NAME, bg=NAVY, fg="white", font=ft(19, True)).pack(anchor="w")
        tk.Label(titles, text=f"{APP_NAME}   |   {TAGLINE}", bg=NAVY, fg=GOLD,
                 font=ft(10, True)).pack(anchor="w")
        right = tk.Frame(header, bg=NAVY)
        right.pack(side="right")
        tk.Label(right, text=dt.date.today().strftime("%A, %d %B %Y"), bg=NAVY, fg="white",
                 font=ft(10, True)).pack(anchor="e")
        tk.Label(right, text=f"Financial Year {fy_list()[0]}", bg=NAVY, fg=SOFT,
                 font=ft(9)).pack(anchor="e")
        tk.Frame(self, bg=GOLD, height=3).pack(fill="x")

        # ---- footer
        footer = tk.Frame(self, bg="#E8EDF3", padx=16, pady=5)
        footer.pack(side="bottom", fill="x")
        tk.Label(footer, text=f"{FIRM_NAME}   |   Confidential - for professional use only",
                 bg="#E8EDF3", fg=MUTED, font=ft(8)).pack(side="left")
        tk.Label(footer, text=f"Data file: {DB_FILE.name}", bg="#E8EDF3", fg=MUTED,
                 font=ft(8)).pack(side="right")

        # ---- tabs
        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=10, pady=(4, 6))
        tabs = [
            ("Dashboard", Dashboard(self.nb, self.db)),
            ("Team Management", CrudTab(self.nb, self.db, "team", "Team Member")),
            ("Task Management", CrudTab(self.nb, self.db, "tasks", "Task",
                                        before_save=task_before_save, row_tag=task_row_tag)),
            ("Client Management", CrudTab(self.nb, self.db, "clients", "Client")),
            ("Unit Management", CrudTab(self.nb, self.db, "units", "Unit / Branch")),
            ("Deductee Details", CrudTab(self.nb, self.db, "deductees", "Deductee")),
            ("TDS Sections", CrudTab(self.nb, self.db, "tds_sections", "TDS Section",
                                     before_save=sections_before_save, banner=SECTIONS_BANNER,
                                     extra_buttons=[("Restore Defaults", restore_sections)])),
            ("TDS Entries", CrudTab(self.nb, self.db, "tds_entries", "TDS Entry",
                                    before_save=tds_before_save, info_fn=tds_info,
                                    order_by="payment_date, id", after_save=tds_after_save,
                                    keep_on_add=("client", "unit"),
                                    extra_buttons=[("Recalculate All", recalc_all)],
                                    on_section=tds_on_section,
                                    links={"new_section": tds_pick_new_section,
                                           "return_code": tds_pick_code,
                                           "deductee_name": tds_pick_name,
                                           "deductee_pan": tds_pick_pan})),
            ("Reports", Reports(self.nb, self.db)),
        ]
        for name, frame in tabs:
            self.nb.add(frame, text=name)
        self.nb.bind("<<NotebookTabChanged>>", self.on_tab)

    def on_tab(self, _event):
        frame = self.nametowidget(self.nb.select())
        if hasattr(frame, "refresh"):
            frame.refresh()


if __name__ == "__main__":
    App().mainloop()
