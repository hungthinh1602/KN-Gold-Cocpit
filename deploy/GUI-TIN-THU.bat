@echo off
chcp 65001 >nul
rem === Gui bo tin thu (BUY: setup > khop Entry > +50 > THANG 100 > +150 > TP) vao Lenh Live. Muon SELL: GUI-TIN-THU.bat SELL ===
set "SIDE=%~1"
if "%SIDE%"=="" set "SIDE=BUY"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gui-tin-thu.ps1" -Side %SIDE%
pause
