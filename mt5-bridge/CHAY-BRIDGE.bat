@echo off
chcp 65001 >nul
rem Chay cau noi MT5 va TU BAT LAI neu no thoat (vd MT5 ket -> bridge tu thoat de lam moi).
cd /d "%~dp0"
:loop
py bridge.py
echo Bridge thoat (ma %errorlevel%) - bat lai sau 3 giay...
timeout /t 3 /nobreak >nul
goto loop
