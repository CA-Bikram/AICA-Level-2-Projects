"""White / Blue / Red application theme."""
BLUE = "#1556B0"
BLUE_DARK = "#0E3F85"
RED = "#C62828"

STYLE = f"""
* {{ font-family: "Segoe UI", Arial, sans-serif; font-size: 10pt; }}
QMainWindow, QDialog, QWidget {{ background: #FFFFFF; color: #1B1B1B; }}
#banner {{ background: {BLUE}; }}
#banner QLabel {{ background: transparent; color: #FFFFFF; }}
#appTitle {{ font-size: 17pt; font-weight: 700; }}
#sellerTitle {{ font-size: 10pt; }}
QGroupBox {{
    border: 1px solid #C9D6EA; border-radius: 6px; margin-top: 12px;
    padding: 10px 8px 8px 8px; font-weight: 600; color: {BLUE};
}}
QGroupBox::title {{ subcontrol-origin: margin; left: 10px; padding: 0 5px; }}
QLabel {{ color: #1B1B1B; font-weight: 400; background: transparent; }}
QLineEdit, QPlainTextEdit, QDateEdit, QDoubleSpinBox, QComboBox {{
    border: 1px solid #B8C7DE; border-radius: 4px; padding: 4px 6px;
    background: #FFFFFF; color: #1B1B1B; selection-background-color: {BLUE};
    font-weight: 400;
}}
QLineEdit:focus, QPlainTextEdit:focus, QDateEdit:focus, QDoubleSpinBox:focus,
QComboBox:focus {{ border: 1.5px solid {BLUE}; }}
QLineEdit:read-only {{ background: #F1F5FB; }}
QPushButton {{
    background: {BLUE}; color: #FFFFFF; border: none; border-radius: 4px;
    padding: 7px 13px; font-weight: 600;
}}
QPushButton:hover {{ background: {BLUE_DARK}; }}
QPushButton:disabled {{ background: #A9B8D0; }}
QPushButton[kind="danger"] {{ background: {RED}; }}
QPushButton[kind="danger"]:hover {{ background: #9B1C1C; }}
QPushButton[kind="light"] {{
    background: #FFFFFF; color: {BLUE}; border: 1px solid {BLUE};
}}
QPushButton[kind="light"]:hover {{ background: #EAF1FB; }}
QTableWidget {{
    border: 1px solid #C9D6EA; gridline-color: #DCE5F3;
    alternate-background-color: #F6F9FE; background: #FFFFFF;
    selection-background-color: #CFE0F8; selection-color: #1B1B1B;
    font-weight: 400;
}}
QHeaderView::section {{
    background: {BLUE}; color: #FFFFFF; padding: 6px; border: none;
    border-right: 1px solid #3F78C8; font-weight: 600;
}}
QCheckBox {{ font-weight: 400; color: #1B1B1B; }}
#totalsBox QLabel {{ font-size: 10.5pt; }}
#grandLabel, #grandValue {{ font-size: 15pt; font-weight: 700; color: {BLUE}; }}
#dueValue {{ font-weight: 700; color: {RED}; }}
QStatusBar {{ background: #F1F5FB; color: #333333; }}
"""
