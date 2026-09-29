# In ra thu muc ban Python cu (chua gold_dashboard.py). Uu tien: file ghi nho -> tien trinh dang chay -> cac cho hay dat.
param([string]$Remember)
if ($Remember -and (Test-Path $Remember)) {
  $p = (Get-Content $Remember -TotalCount 1).Trim()
  if ($p -and (Test-Path (Join-Path $p "gold_dashboard.py"))) { $p; exit 0 }
}
$proc = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'gold_dashboard\.py' } | Select-Object -First 1
if ($proc -and $proc.CommandLine -match '"?([^"]*?)\\gold_dashboard\.py') {
  if (Test-Path (Join-Path $Matches[1] "gold_dashboard.py")) { $Matches[1]; exit 0 }
}
$cands = @("C:\Gold-Dashboard", "D:\Gold-Dashboard",
  (Join-Path $env:USERPROFILE "Desktop\Gold-Dashboard"), (Join-Path $env:USERPROFILE "Gold-Dashboard"))
foreach ($c in $cands) { if (Test-Path (Join-Path $c "gold_dashboard.py")) { $c; exit 0 } }
exit 1
