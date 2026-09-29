# Cai Node.js LTS moi nhat (64-bit) tu trang chinh thuc nodejs.org — CAI-DAT-VPS.bat goi.
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$lts = (Invoke-RestMethod "https://nodejs.org/dist/index.json") | Where-Object { $_.lts } | Select-Object -First 1
$v = $lts.version
$msi = Join-Path $env:TEMP "node-$v-x64.msi"
Write-Host "Tai Node.js $v ..."
Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-x64.msi" -OutFile $msi -UseBasicParsing
Write-Host "Cai dat ..."
$p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "msiexec loi $($p.ExitCode)" }
Remove-Item $msi -ErrorAction SilentlyContinue
Write-Host "Da cai Node.js $v"
