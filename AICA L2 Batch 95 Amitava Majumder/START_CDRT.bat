@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys,sqlite3; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
if not errorlevel 1 (
  py -3 app.py
  goto end
)
python -c "import sys,sqlite3; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
if not errorlevel 1 (
  python app.py
  goto end
)
set "CDRT_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%CDRT_PYTHON%" (
  "%CDRT_PYTHON%" app.py
  goto end
)
echo Python 3.10 or later is required. Install Python, then reopen this file.
echo No additional Python packages are needed. See README.md for instructions.
:end
pause
