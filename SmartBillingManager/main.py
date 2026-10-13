"""
Smart Billing Manager - entry point.

Run:  python main.py      (or double-click Run_Smart_Billing_Manager.bat)

On first run (when not packaged as .exe) any missing library is installed
once with pip; later runs start immediately.
"""
import importlib.util
import subprocess
import sys

REQUIRED = {"PyQt6": "PyQt6", "reportlab": "reportlab", "openpyxl": "openpyxl"}


def ensure_dependencies():
    """Install missing libraries once. Skipped inside a packaged .exe."""
    if getattr(sys, "frozen", False):
        return
    missing = [pkg for mod, pkg in REQUIRED.items()
               if importlib.util.find_spec(mod) is None]
    if not missing:
        return
    print("First run: installing required libraries:", ", ".join(missing))
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])
    except Exception as exc:  # no internet / pip missing
        print("\nCould not install libraries automatically:", exc)
        print("Please run:  pip install " + " ".join(missing))
        input("Press Enter to exit...")
        sys.exit(1)
    importlib.invalidate_caches()


def main():
    ensure_dependencies()
    from sbm.app import run
    sys.exit(run())


if __name__ == "__main__":
    main()
