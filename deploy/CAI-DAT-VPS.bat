@echo off
chcp 65001 >nul
rem === Cai dat Buong Lai Vang ban React/Node tren VPS - chay 1 lan (tu xin quyen Administrator) ===
rem Chay SONG SONG voi ban Python cu: ban moi o cong 8788, ban cu giu 8787 + cong 80 (webhook).
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0.."

echo [1/6] Node.js ...
set "PATH=%CD%\tools\node;%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1 || powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cai-node.ps1"
where node >nul 2>&1 || (echo LOI: chua cai duoc Node.js - chup man hinh gui Claude. & pause & exit /b 1)
node -v

echo [2/6] Thu vien Python cho cau noi MT5 ...
py -m pip install --upgrade -r mt5-bridge\requirements.txt

echo [3/6] Cai goi + build giao dien/server (vai phut) ...
call npm ci --no-audit --no-fund || (echo LOI npm ci - chup man hinh gui Claude. & pause & exit /b 1)
call npm run build || (echo LOI build - chup man hinh gui Claude. & pause & exit /b 1)

echo [4/6] Chep mat khau web, token webhook, khoa AI, lich su lenh tu ban Python cu ...
call "%~dp0lay-du-lieu-cu.bat"
if not exist "server\data\cau-hinh.env" (
  > "server\data\cau-hinh.env" echo # Chay song song: web 8788, KHONG mo cong 80 ^(ban Python con giu^)
  >> "server\data\cau-hinh.env" echo PORT=8788
  >> "server\data\cau-hinh.env" echo WEBHOOK_PORT=0
)

echo [5/6] Mo cong 8788 tren tuong lua ...
netsh advfirewall firewall delete rule name="Buong Lai Vang Node 8788" >nul 2>&1
netsh advfirewall firewall add rule name="Buong Lai Vang Node 8788" dir=in action=allow protocol=TCP localport=8788 >nul

echo [6/6] Tu chay khi dang nhap VPS ...
schtasks /create /f /tn "BuongLaiVang-Node" /sc onlogon /rl highest /tr "\"%~dp0CHAY.bat\"" >nul

call "%~dp0CHAY.bat"
echo.
echo XONG. Mo thu http://36.50.134.246:8788 (dang nhap bang mat khau web cu).
pause
