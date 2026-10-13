@echo off
setlocal enabledelayedexpansion

:: 1. Automatically switch to project directory
cd /d "%~dp0"

title OneHR Payroll Manager - Server

echo ===================================================
echo           OneHR Payroll Manager - OFFICE SERVER
echo    Indian Payroll, Attendance ^& Statutory System
echo ===================================================
echo.

:: 2. Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 3. Avoid starting duplicate server processes
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] OneHR Payroll Manager server is already running on port 3000.
    echo [INFO] Opening default browser at http://localhost:3000/ ...
    start http://localhost:3000/
    echo.
    ping 127.0.0.1 -n 2 >nul
    exit /b 0
)

:: 4. Install dependencies if missing, then rebuild so the server always matches the source code
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
    echo [ERROR] Build failed. If this follows an update, run "npm install" in this folder and try again.
    pause
    exit /b 1
)

:: 5. Detect host LAN IPv4 address for office network access
set "LAN_IP="
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| find " 0.0.0.0 "') do (
    set "LAN_IP=%%a"
    goto :ip_found
)
:ip_found

echo [INFO] Starting production server on 0.0.0.0:3000...
echo [INFO] Local Access URL:      http://localhost:3000/
if defined LAN_IP (
    echo [INFO] Office LAN Access URL: http://%LAN_IP%:3000/
) else (
    echo [INFO] Office LAN Access URL: http://^<HOST-IP^>:3000/
)
echo.

:: 6. Launch browser after a brief 2-second background initialization delay
start "" cmd /c "ping 127.0.0.1 -n 3 >nul && start http://localhost:3000/"

:: 7. Run production server
node dist\server.mjs

pause
