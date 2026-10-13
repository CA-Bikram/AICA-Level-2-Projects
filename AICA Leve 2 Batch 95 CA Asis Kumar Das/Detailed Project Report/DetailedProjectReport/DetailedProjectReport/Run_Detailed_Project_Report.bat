@echo off
setlocal
title Detailed Project Report - Setup and Launch
cd /d "%~dp0"

echo ==========================================================
echo    DETAILED PROJECT REPORT - Setup and Launch
echo ==========================================================
echo.

rem ---- 1. Find Python -------------------------------------------------
set "PY="
python --version >nul 2>nul && set "PY=python"
if not defined PY (
    py --version >nul 2>nul && set "PY=py"
)
if not defined PY (
    echo [ERROR] Python was not found on this computer.
    echo         Please install Python 3.8 or newer from https://www.python.org/downloads/
    echo         and tick the box "Add python.exe to PATH" during installation.
    echo.
    pause
    exit /b 1
)
echo Using Python launcher: %PY%
%PY% --version
echo.

rem ---- 2. Make sure the program file is next to this bat file ---------
if not exist "DetailedProjectReport.py" (
    echo [ERROR] DetailedProjectReport.py was not found in this folder:
    echo         %~dp0
    echo         Keep the .py file and this .bat file together.
    echo.
    pause
    exit /b 1
)

rem ---- 3. Install dependencies (Tkinter is built into Python) ---------
echo Installing required libraries - openpyxl and reportlab - for Excel and PDF export ...
%PY% -m pip install openpyxl reportlab --disable-pip-version-check
if errorlevel 1 (
    echo.
    echo [WARNING] Could not install openpyxl or reportlab. Check your internet connection.
    echo           The application will still run, but Excel / PDF export may not work.
    echo.
    pause
)
echo.

rem ---- 4. Run the application -----------------------------------------
echo Starting Detailed Project Report ...
%PY% "DetailedProjectReport.py"
if errorlevel 1 (
    echo.
    echo [ERROR] The application closed with an error. See the message above.
    echo         If it says No module named tkinter, re-run the Python installer,
    echo         choose Modify and tick tcl/tk and IDLE.
    echo.
    pause
)
endlocal
