@echo off
chcp 65001 >nul
rem CHI XEM dung luong o dia + thu muc lon (KHONG xoa gi). Chup man hinh ket qua gui Claude.
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kiem-tra-o-dia.ps1"
echo.
pause
