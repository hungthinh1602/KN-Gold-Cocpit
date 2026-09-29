@echo off
chcp 65001 >nul
title BLV-Server
rem Chay server Node va TU BAT LAI neu no thoat. Cau hinh cong: server\data\cau-hinh.env (PORT=..., WEBHOOK_PORT=...)
cd /d "%~dp0.."
set "PATH=%CD%\tools\node;%ProgramFiles%\nodejs;%PATH%"
set "PORT=8788"
set "WEBHOOK_PORT=0"
if exist "server\data\cau-hinh.env" for /f "usebackq eol=# tokens=1,* delims==" %%a in ("server\data\cau-hinh.env") do set "%%a=%%b"
echo Cong web %PORT% - cong webhook %WEBHOOK_PORT% (0 = tat)
:loop
node server\dist\index.js
echo Server thoat (ma %errorlevel%) - bat lai sau 5 giay...
timeout /t 5 /nobreak >nul
goto loop
