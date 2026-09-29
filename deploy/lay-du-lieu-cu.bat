@echo off
rem Chep khoa + lich su Lenh Live tu ban Python cu sang server\data (CAI-DAT-VPS va CHUYEN-SANG-NODE goi).
rem   %1 = "orders"  -> chep de orders.json (lay lich su lenh MOI NHAT luc chuyen)
setlocal
set "DATA=%~dp0..\server\data"
if not exist "%DATA%" mkdir "%DATA%"
set "OLD="
for /f "usebackq delims=" %%p in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tim-ban-cu.ps1" -Remember "%DATA%\python-cu.txt"`) do set "OLD=%%p"
if not defined OLD (
  echo Khong tu tim thay thu muc ban Python cu ^(co file gold_dashboard.py^).
  set /p "OLD=Nhap duong dan thu muc do (VD C:\Gold-Dashboard): "
)
if not exist "%OLD%\gold_dashboard.py" (
  echo LOI: "%OLD%" khong co gold_dashboard.py - bo qua buoc chep du lieu.
  exit /b 1
)
> "%DATA%\python-cu.txt" echo %OLD%
echo Ban Python cu: %OLD%
rem Khoa/mat khau: chi chep khi ben moi chua co (khong ghi de)
for %%f in (web_password.txt tv_webhook_token.txt ai_push_key.txt) do (
  if exist "%OLD%\%%f" if not exist "%DATA%\%%f" copy /y "%OLD%\%%f" "%DATA%\%%f" >nul && echo   + %%f
)
if exist "%OLD%\orders.json" (
  if /i "%~1"=="orders" (
    copy /y "%OLD%\orders.json" "%DATA%\orders.json" >nul && echo   + orders.json ^(moi nhat^)
  ) else if not exist "%DATA%\orders.json" (
    copy /y "%OLD%\orders.json" "%DATA%\orders.json" >nul && echo   + orders.json
  )
)
if not exist "%DATA%\web_password.txt" echo CANH BAO: chua co web_password.txt - web se chi mo noi bo, khong vao duoc tu ngoai.
exit /b 0
