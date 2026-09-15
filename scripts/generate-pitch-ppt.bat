@echo off
title Generate Tutorsala pitch PowerPoint
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0generate-pitch-ppt.ps1"
if exist "..\docs\pitch\Tutorsala-Customer-Pitch.pptx" (
  start "" "..\docs\pitch\Tutorsala-Customer-Pitch.pptx"
)
pause
