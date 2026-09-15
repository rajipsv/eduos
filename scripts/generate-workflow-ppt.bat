@echo off
title Generate Tutorsala Workflow PowerPoint
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0generate-workflow-ppt.ps1"
if exist "..\docs\Tutorsala-Workflow.pptx" (
  start "" "..\docs\Tutorsala-Workflow.pptx"
)
pause
