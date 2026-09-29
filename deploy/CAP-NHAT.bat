@echo off
chcp 65001 >nul
rem === Cap nhat code moi: giai nen ban zip moi DE LEN thu muc nay (giu nguyen server\data), roi chay file nay ===
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0.."
set "PATH=%CD%\tools\node;%ProgramFiles%\nodejs;%PATH%"
echo [1/3] Cai goi ...
call npm ci --no-audit --no-fund || (echo LOI npm ci - chup man hinh gui Claude. & pause & exit /b 1)
echo [2/3] Build ...
call npm run build || (echo LOI build - chup man hinh gui Claude. & pause & exit /b 1)
echo [3/3] Chay lai ...
call "%~dp0CHAY.bat"
echo XONG.
pause
