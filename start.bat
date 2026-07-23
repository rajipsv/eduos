@echo off
title EduOS local server
cd /d "%~dp0"
set PORT=8888
set URL=http://127.0.0.1:%PORT%/

rem Ensure Node/npm are on PATH when launched by double-click
if exist "%ProgramFiles%\nodejs\" set "PATH=%ProgramFiles%\nodejs;%PATH%"

echo.
echo  EduOS - local server
echo  ====================
echo  URL: %URL%
echo.
echo  Keep this window OPEN while using EduOS.
echo  Press Ctrl+C to stop the server.
echo.

where node >nul 2>&1
if %errorlevel%==0 (
  if not exist node_modules (
    echo Installing dependencies...
    call npm install --strict-ssl=false
  )
  if exist .env (
    echo Applying database schema...
    call npm run migrate
  ) else (
    echo WARNING: No .env file — data will stay in browser localStorage only.
  )
  start "" "%URL%"
  echo Starting API server ^(required for Neon PostgreSQL^)...
  call npm start
) else (
  echo Node.js not found. Install Node.js LTS, then run start.bat again.
  echo Falling back to PowerShell static server ^(localStorage only^).
  start "" "%URL%"
  powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
)

pause
