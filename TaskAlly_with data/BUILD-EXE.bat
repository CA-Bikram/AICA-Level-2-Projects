@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required to build the EXE. Get it from https://nodejs.org & pause & exit /b)
call npm install -g @yao-pkg/pkg
call pkg . --targets node20-win-x64 --output TaskAlly.exe
echo.
echo Done. Double-click TaskAlly.exe to start the server.
pause
