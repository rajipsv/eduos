@echo off
cd /d "%~dp0..\docs"
set HTML=%CD%\EduOS-Workflow.html
set PDF=%CD%\EduOS-Workflow.pdf
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe

if not exist "%HTML%" (
  echo Missing EduOS-Workflow.html
  pause
  exit /b 1
)

if not exist "%CHROME%" (
  echo Chrome not found. Open EduOS-Workflow.html and Print to PDF.
  pause
  exit /b 1
)

echo Generating EduOS-Workflow.pdf...
"%CHROME%" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="%PDF%" "file:///%HTML:\=/%"
timeout /t 2 /nobreak >nul
if exist "%PDF%" (
  echo Done: %PDF%
  start "" "%PDF%"
) else (
  echo Failed. Open %HTML% and use Print -^> Save as PDF.
)
pause
