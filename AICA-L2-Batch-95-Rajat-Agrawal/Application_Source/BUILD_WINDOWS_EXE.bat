@echo off
cd /d "%~dp0"
py -m pip install -r requirements.txt pyinstaller
if errorlevel 1 exit /b 1
py -m PyInstaller --noconfirm --onefile --windowed --name Form35AppealAssistant_v2 --collect-all tzdata app.py
if errorlevel 1 pause
