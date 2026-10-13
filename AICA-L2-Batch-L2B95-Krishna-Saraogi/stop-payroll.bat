@echo off
setlocal enabledelayedexpansion

:: Automatically switch to project directory
cd /d "%~dp0"

title OneHR Payroll Manager - Stop Server

echo ===================================================
echo         OneHR Payroll Manager - STOP SERVER
echo ===================================================
echo.

:: Check if server is running on port 3000
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] OneHR Payroll Manager server is not currently running on port 3000.
    echo.
    ping 127.0.0.1 -n 2 >nul
    exit /b 0
)

echo [INFO] Stopping OneHR Payroll Manager server process on port 3000...

:: Terminate process listening on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
    echo [INFO] Terminating PID: %%a
    taskkill /PID %%a /F >nul 2>nul
)

:: Terminate any window titled "OneHR Payroll Manager - Server"
taskkill /FI "WINDOWTITLE eq OneHR Payroll Manager - Server*" /T /F >nul 2>nul

:: Brief pause and verification
ping 127.0.0.1 -n 2 >nul
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] The process could not be completely terminated.
    pause
    exit /b 1
) else (
    echo.
    echo [SUCCESS] OneHR Payroll Manager server has been stopped cleanly.
    ping 127.0.0.1 -n 2 >nul
    exit /b 0
)
