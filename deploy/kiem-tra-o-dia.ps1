# CHI XEM (khong xoa gi): dung luong trong cac o + nhung thu muc hay phinh to tren VPS.
function Size($p) {
  if (-not (Test-Path $p)) { return $null }
  $s = (Get-ChildItem $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  [math]::Round($s / 1GB, 2)
}
Write-Host "=== O DIA ==="
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  "{0}  trong {1,6:N1} GB / tong {2,6:N1} GB" -f $_.DeviceID, ($_.FreeSpace / 1GB), ($_.Size / 1GB)
}
Write-Host ""
Write-Host "=== THU MUC LON (GB) - dang tinh, doi 1-2 phut ==="
$u = $env:USERPROFILE
$list = @(
  "$env:TEMP", "C:\Windows\Temp", "C:\Windows\SoftwareDistribution\Download",
  "$u\Downloads", "$u\Desktop", "$u\Documents",
  "$u\AppData\Roaming\MetaQuotes", "$u\AppData\Local\pip", "$u\AppData\Local\npm-cache",
  "C:\Program Files", "C:\Program Files (x86)", "C:\Users"
)
foreach ($p in $list) { $g = Size $p; if ($g -ne $null) { "{0,7:N2}  {1}" -f $g, $p } }
Write-Host ""
Write-Host "=== 10 THU MUC CON LON NHAT TRONG MetaQuotes (lich su gia MT5) ==="
$mq = "$u\AppData\Roaming\MetaQuotes\Terminal"
if (Test-Path $mq) {
  Get-ChildItem $mq -Directory -Force | ForEach-Object {
    foreach ($sub in Get-ChildItem $_.FullName -Directory -Force -ErrorAction SilentlyContinue) {
      [pscustomobject]@{ GB = Size $sub.FullName; Path = $sub.FullName }
    }
  } | Sort-Object GB -Descending | Select-Object -First 10 | ForEach-Object { "{0,7:N2}  {1}" -f $_.GB, $_.Path }
}
