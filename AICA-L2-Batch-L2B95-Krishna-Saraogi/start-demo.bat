@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title OneHR Payroll Manager - Demo Mode

echo ==========================================================
echo     OneHR Payroll Manager - DEMO MODE (FY 2026-27)
echo ----------------------------------------------------------
echo   Fictional employees only. Your real data in the "data"
echo   folder is not touched.
echo   April to August 2026 : attendance and payroll completed
echo   September 2026       : open - upload files and process
echo ==========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found. Install it from https://nodejs.org/
    pause
    exit /b 1
)

:: Stop here if a demo is already running
netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] The demo is already running. Opening http://localhost:3001/
    echo [INFO] To start again from clean data, close the other demo window first.
    start http://localhost:3001/
    pause
    exit /b 0
)

:: Start from a clean demo database every time
if exist "demo-data" rmdir /s /q "demo-data"

set "DATA_DIR=%~dp0demo-data"
set "SEED_DEMO=true"
set "PORT=3001"
set "NODE_ENV=production"

:: Optional: Gemini key for the AI commentary and payslip questions
if "%GEMINI_API_KEY%"=="" (
    echo To show the AI commentary, paste your Gemini API key and press Enter.
    echo To skip it, just press Enter.
    set /p GEMINI_API_KEY="Gemini API key: "
)
echo.

:: Install when dependencies are missing or a newly added library is not yet present
set "NEED_INSTALL="
if not exist "node_modules" set "NEED_INSTALL=1"
if not exist "node_modules\exceljs" set "NEED_INSTALL=1"
if defined NEED_INSTALL (
    echo [INFO] Installing dependencies. This needs internet and takes a few minutes...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Building the application...
call npm run build
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Build failed. Run "npm install" in this folder and try again.
    pause
    exit /b 1
)

echo.
echo [INFO] Demo running at http://localhost:3001/
echo [INFO] Sign-ins: maker / Maker@2026    checker / Checker@2026    admin / Admin@2026
echo.
echo [INFO] Files to upload for September 2026 are in the "demo-files" folder:
echo          1_New_Joiners_Sep-2026.xlsx   (Employees - Import from Excel)
echo          2_Attendance_Sep-2026.xlsx    (Attendance - Import Attendance Excel)
echo.
echo [INFO] Close this window to stop the demo.
echo.

start "" explorer "%~dp0demo-files"
start "" cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:3001/"
node dist\server.mjs

pause
