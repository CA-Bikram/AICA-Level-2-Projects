@echo off
setlocal
cd /d "%~dp0"
title BCM Finance Dashboard

rem ---- 1. Find Python -------------------------------------------------
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY ( where python >nul 2>nul && set "PY=python" )
if not defined PY (
    echo Python 3.9 or newer was not found.
    echo Install it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^) and run this file again.
    pause
    exit /b 1
)

rem ---- 2. Create virtual environment (first run only) ------------------
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    %PY% -m venv .venv
    if errorlevel 1 ( echo Failed to create virtual environment. & pause & exit /b 1 )
)

rem ---- 3. Install / update requirements --------------------------------
echo Installing requirements ^(first run may take a few minutes^)...
".venv\Scripts\python.exe" -m pip install --upgrade pip -q
".venv\Scripts\python.exe" -m pip install -r requirements.txt -q
if errorlevel 1 (
    echo Failed to install requirements. Check your internet connection.
    pause
    exit /b 1
)

rem ---- 4. Run the dashboard --------------------------------------------
echo Starting dashboard... your browser will open automatically.
echo Close this window to stop the application.
".venv\Scripts\python.exe" -m streamlit run app.py --browser.gatherUsageStats false
pause
