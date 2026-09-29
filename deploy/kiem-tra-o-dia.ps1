# CHI XEM (khong xoa gi): dung luong o dia, kha nang mo rong o C, thu muc lon, MT5 nao chiem cho.
function Size($p) {
  if (-not (Test-Path -LiteralPath $p)) { return $null }
  $s = (Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  [math]::Round($s / 1GB, 2)
}
function Top($p, $n = 6) {
  if (-not (Test-Path -LiteralPath $p)) { return }
  Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $g = if ($_.PSIsContainer) { Size $_.FullName } else { [math]::Round($_.Length / 1GB, 2) }
    [pscustomobject]@{ GB = $g; Name = $_.Name }
  } | Sort-Object GB -Descending | Select-Object -First $n | ForEach-Object { "   {0,6:N2}  {1}" -f $_.GB, $_.Name }
}

Write-Host "=== O DIA ==="
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  "{0}  trong {1,6:N1} GB / tong {2,6:N1} GB" -f $_.DeviceID, ($_.FreeSpace / 1GB), ($_.Size / 1GB)
}
try {
  $part = Get-Partition -DriveLetter C -ErrorAction Stop
  $max = (Get-PartitionSupportedSize -DriveLetter C -ErrorAction Stop).SizeMax
  $more = ($max - $part.Size) / 1GB
  "O C: co the MO RONG them: {0:N1} GB {1}" -f $more, $(if ($more -gt 0.5) { "<-- CO DUNG LUONG CHUA DUNG!" } else { "(khong con - phai nang cap goi VPS)" })
  Get-Disk | ForEach-Object { "Disk {0}: tong {1:N1} GB, chua chia {2:N1} GB" -f $_.Number, ($_.Size / 1GB), (($_.Size - $_.AllocatedSize) / 1GB) }
} catch { "Khong doc duoc thong tin phan vung: $($_.Exception.Message)" }
Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue | ForEach-Object { "Pagefile {0}: {1:N1} GB" -f $_.Name, ($_.AllocatedBaseSize / 1024) }

Write-Host ""
Write-Host "=== MT5 NAO CHIEM CHO (GB) ==="
$mq = "$env:APPDATA\MetaQuotes\Terminal"
if (Test-Path $mq) {
  Get-ChildItem $mq -Directory -Force | ForEach-Object {
    $origin = Join-Path $_.FullName "origin.txt"
    $name = if (Test-Path $origin) { (Get-Content $origin -Encoding Unicode -TotalCount 1) -replace '\s+$', '' } else { "(khong ro)" }
    [pscustomobject]@{ GB = Size $_.FullName; Bases = Size (Join-Path $_.FullName "bases"); Logs = Size (Join-Path $_.FullName "logs"); Id = $_.Name.Substring(0, 6); Name = $name }
  } | Sort-Object GB -Descending | ForEach-Object { "{0,6:N2} (lich su gia {1:N2}, logs {2:N2})  {3}  {4}" -f $_.GB, $_.Bases, $_.Logs, $_.Id, $_.Name }
}

Write-Host ""
Write-Host "=== TRONG DESKTOP ==="
Top "$env:USERPROFILE\Desktop"
Write-Host "=== TRONG PROGRAM FILES (x86) ==="
Top "C:\Program Files (x86)"
Write-Host "=== TRONG PROGRAM FILES ==="
Top "C:\Program Files"
