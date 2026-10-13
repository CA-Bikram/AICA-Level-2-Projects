"""Paths and folder setup. Works both as a script and as a PyInstaller .exe."""
import os
import subprocess
import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_DIR = BASE_DIR / "database"
PDF_DIR = BASE_DIR / "invoices_pdf"
EXPORT_DIR = BASE_DIR / "excel_registers"

INVOICE_DB = DATABASE_DIR / "invoices.json"
SETTINGS_DB = DATABASE_DIR / "settings.json"


def ensure_folders():
    """Create the data folders if they do not exist."""
    for folder in (DATABASE_DIR, PDF_DIR, EXPORT_DIR):
        folder.mkdir(parents=True, exist_ok=True)


def safe_filename(text):
    keep = "".join(c if c.isalnum() or c in "-_ " else "_" for c in str(text))
    return keep.strip().replace(" ", "_") or "invoice"


def open_file(path):
    """Open a file with the default application of the OS."""
    path = str(path)
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
        return True
    except Exception:
        return False
