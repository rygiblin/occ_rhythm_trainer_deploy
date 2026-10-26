@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-rhythm.ps1" -Tutorial
if errorlevel 1 pause
