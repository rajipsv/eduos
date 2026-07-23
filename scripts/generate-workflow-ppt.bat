@echo off
title Generate EduOS Workflow PowerPoint
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0generate-workflow-ppt.ps1"
if exist "..\docs\EduOS-Workflow.pptx" (
  start "" "..\docs\EduOS-Workflow.pptx"
)
pause
