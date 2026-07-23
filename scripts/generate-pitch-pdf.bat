@echo off
cd /d "%~dp0..\docs\pitch"
set HTML=%CD%\EduOS-Customer-Pitch.html
set PDF=%CD%\EduOS-Customer-Pitch.pdf
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME%" (
  echo Chrome not found. Open EduOS-Customer-Pitch.html in your browser and Print to PDF.
  pause
  exit /b 1
)

echo Generating customer pitch PDF...
"%CHROME%" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="%PDF%" "file:///%HTML:\=/%"
if exist "%PDF%" (
  echo.
  echo Done: %PDF%
  start "" "%PDF%"
) else (
  echo Failed. Open %HTML% and use Print -^> Save as PDF.
)
pause
