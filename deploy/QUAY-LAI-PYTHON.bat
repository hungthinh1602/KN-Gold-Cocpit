@echo off
chcp 65001 >nul
rem === Quay lai ban Python cu (8787 + cong 80). Ban Node van chay song song o 8788. ===
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0.."
set "OLD="
if exist "server\data\python-cu.txt" set /p OLD=<"server\data\python-cu.txt"
if not exist "%OLD%\gold_dashboard.py" (echo LOI: khong biet thu muc ban Python cu. & pause & exit /b 1)

echo [1/3] Dung ban Node, tra cong 8787 + 80 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dung.ps1"
> "server\data\cau-hinh.env" echo # Chay song song: web 8788, KHONG mo cong 80 ^(ban Python giu^)
>> "server\data\cau-hinh.env" echo PORT=8788
>> "server\data\cau-hinh.env" echo WEBHOOK_PORT=0

echo [2/3] Tra lich su Lenh Live (co ca lenh nhan trong luc chay ban Node) ve ban cu ...
if exist "server\data\orders.json" copy /y "server\data\orders.json" "%OLD%\orders.json" >nul

echo [3/3] Bat lai ban Python cu + ban Node o 8788 ...
schtasks /change /tn "BuongLaiVang" /enable >nul 2>&1
start "" "%OLD%\CHAY-VPS.bat"
timeout /t 5 /nobreak >nul
call "%~dp0CHAY.bat"
echo XONG. Ban cu: http://36.50.134.246:8787 - ban Node: http://36.50.134.246:8788
pause
