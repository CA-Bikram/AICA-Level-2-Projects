@echo off
title Smart Billing Manager
cd /d "%~dp0"

rem ---- find Python ----
set "PY="
python --version >nul 2>nul && set "PY=python"
if not defined PY (
    py -3 --version >nul 2>nul && set "PY=py -3"
)
if not defined PY (
    echo.
    echo  Python was not found on this computer.
    echo  Install Python 3.9 or newer from https://www.python.org/downloads/
    echo  and tick "Add Python to PATH" during installation. Then run this file again.
    echo.
    pause
    exit /b 1
)

rem ---- install libraries (first run only) ----
if not exist ".libraries_installed" (
    echo  First run: installing required libraries. Internet is needed only this one time...
    %PY% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo  Library installation failed. Check your internet connection and run this file again.
        pause
        exit /b 1
    )
    echo installed> ".libraries_installed"
)

rem ---- start the application ----
echo  Starting Smart Billing Manager...
%PY% main.py
if errorlevel 1 (
    echo.
    echo  The application closed with an error. See the message above or error_log.txt
    pause
)
