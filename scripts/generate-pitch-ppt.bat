@echo off
title Generate EduOS pitch PowerPoint
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0generate-pitch-ppt.ps1"
if exist "..\docs\pitch\EduOS-Customer-Pitch.pptx" (
  start "" "..\docs\pitch\EduOS-Customer-Pitch.pptx"
)
pause
