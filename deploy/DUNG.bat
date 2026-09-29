@echo off
chcp 65001 >nul
rem Dung ban Node (cau noi MT5 + server). Khong dong MT5, khong dung ban Python.
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dung.ps1"
echo Da dung ban Node.
timeout /t 4 >nul
