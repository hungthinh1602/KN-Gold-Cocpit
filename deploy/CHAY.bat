@echo off
chcp 65001 >nul
rem Chay (hoac chay lai) ban Node: cau noi MT5 + server. 2 cua so thu nho "BLV-Bridge", "BLV-Server" - DUNG dong.
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0.."
echo Dung ban dang chay (neu co)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dung.ps1"
timeout /t 2 /nobreak >nul
start "BLV-Bridge" /min "%~dp0..\mt5-bridge\CHAY-BRIDGE.bat"
timeout /t 3 /nobreak >nul
start "BLV-Server" /min "%~dp0chay-server-vong.bat"
set "PORT=8788"
if exist "server\data\cau-hinh.env" for /f "usebackq eol=# tokens=1,* delims==" %%a in ("server\data\cau-hinh.env") do set "%%a=%%b"
echo.
echo Da chay. Mo http://localhost:%PORT% de kiem tra (doi ~15 giay).
timeout /t 6 >nul
