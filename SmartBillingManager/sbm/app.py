"""Application start-up."""
import sys
import traceback

from PyQt6.QtWidgets import QApplication, QMessageBox

from . import APP_NAME, config
from .database import Database
from .main_window import MainWindow
from .theme import STYLE


def _excepthook(exc_type, exc, tb):
    """Show unexpected errors instead of closing silently (important for .exe)."""
    text = "".join(traceback.format_exception(exc_type, exc, tb))
    try:
        with open(config.BASE_DIR / "error_log.txt", "a", encoding="utf-8") as fh:
            fh.write(text + "\n")
    except Exception:
        pass
    if QApplication.instance():
        QMessageBox.critical(None, APP_NAME, f"Unexpected error:\n\n{exc}\n\nDetails saved in error_log.txt")


def run():
    sys.excepthook = _excepthook
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setStyle("Fusion")
    app.setStyleSheet(STYLE)
    try:
        config.ensure_folders()
        db = Database()
    except Exception as exc:
        QMessageBox.critical(None, APP_NAME, f"Could not open the database folder:\n{exc}")
        return 1
    window = MainWindow(db)
    window.show()
    return app.exec()
