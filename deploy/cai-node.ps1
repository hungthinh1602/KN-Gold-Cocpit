# Cai Node.js ban PORTABLE (giai nen zip, KHONG dung trinh cai MSI) vao <du an>\tools\node — CAI-DAT-VPS.bat goi.
# Tu chon phien ban hop Windows: Windows 10 / Server 2016 tro len -> Node 22 LTS; cu hon (2012 R2) -> Node 18.
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem

$os = [Environment]::OSVersion.Version
$caption = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption
Write-Host "Windows: $caption ($os)"
$major = if ($os.Major -ge 10) { "v22." } else { "v18." }

$rel = (Invoke-RestMethod "https://nodejs.org/dist/index.json") |
  Where-Object { $_.version.StartsWith($major) -and $_.files -contains "win-x64-zip" } | Select-Object -First 1
if (-not $rel) { throw "Khong tim thay ban Node $major* cho win-x64" }
$v = $rel.version
$name = "node-$v-win-x64"
$zip = Join-Path $env:TEMP "$name.zip"
$dest = Join-Path (Split-Path $PSScriptRoot -Parent) "tools\node"

Write-Host "Tai Node.js $v (ban portable) ..."
Invoke-WebRequest "https://nodejs.org/dist/$v/$name.zip" -OutFile $zip -UseBasicParsing
Write-Host "Giai nen vao $dest ..."
$tmp = Join-Path $env:TEMP "node-giai-nen"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
[IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
Move-Item (Join-Path $tmp $name) $dest
Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue

& (Join-Path $dest "node.exe") -v
if ($LASTEXITCODE -ne 0) { throw "node.exe khong chay duoc tren Windows nay" }
Write-Host "Da cai Node.js $v"
