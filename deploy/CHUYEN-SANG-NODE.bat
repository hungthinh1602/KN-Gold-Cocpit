@echo off
chcp 65001 >nul
rem === CHUYEN HAN sang ban Node: tat ban Python cu, ban Node nhan cong 8787 + cong 80 (webhook TradingView) ===
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0.."
echo Se TAT ban Python cu va cho ban Node chay o cong 8787 + 80.
echo (Muon quay lai ban cu: chay QUAY-LAI-PYTHON.bat)
pause

echo [1/4] Tat ban Python cu + bo tu chay ...
schtasks /change /tn "BuongLaiVang" /disable >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'gold_dashboard\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('  dung ' + $_.Name + ' #' + $_.ProcessId) }"
timeout /t 2 /nobreak >nul

echo [2/4] Lay lich su Lenh Live moi nhat tu ban cu ...
call "%~dp0lay-du-lieu-cu.bat" orders

echo [3/4] Doi cong: web 8787, webhook 80 ...
> "server\data\cau-hinh.env" echo # Da chuyen han sang ban Node
>> "server\data\cau-hinh.env" echo PORT=8787
>> "server\data\cau-hinh.env" echo WEBHOOK_PORT=80

echo [4/4] Chay lai ban Node ...
call "%~dp0CHAY.bat"
echo.
echo XONG. Web: http://36.50.134.246:8787 - webhook TradingView giu nguyen dia chi cu (cong 80).
netstat -ano | findstr ":8787 :80 " | findstr LISTENING
pause
