@echo off
title EduOS local server
cd /d "%~dp0"
set PORT=8888
set URL=http://127.0.0.1:%PORT%/

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
    call npm install
  )
  if exist .env (
    echo Applying database schema...
    call npm run migrate
  )
  start "" "%URL%"
  call npm start
) else (
  echo Node.js not found. Using PowerShell server instead ^(localStorage only^).
  start "" "%URL%"
  powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
)

pause
