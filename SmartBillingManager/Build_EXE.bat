@echo off
title Build Smart Billing Manager EXE
cd /d "%~dp0"
set "PY="
python --version >nul 2>nul && set "PY=python"
if not defined PY (
    py -3 --version >nul 2>nul && set "PY=py -3"
)
if not defined PY (
    echo  Python was not found. Install it from https://www.python.org/downloads/
    pause
    exit /b 1
)
%PY% -m pip install -r requirements.txt pyinstaller
%PY% -m PyInstaller --noconfirm --clean --onefile --windowed --name "SmartBillingManager" main.py
echo.
echo  Done. Your program is:  dist\SmartBillingManager.exe
echo  Copy the .exe to any folder - it creates its own database and invoices_pdf folders there.
pause
