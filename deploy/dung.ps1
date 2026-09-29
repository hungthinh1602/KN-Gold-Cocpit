# Dung ban Node: vong lap chay (cmd), server node, cau noi MT5 (python bridge.py).
$procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
$loops = $procs | Where-Object { $_.Name -eq "cmd.exe" -and $_.CommandLine -match 'chay-server-vong\.bat|CHAY-BRIDGE\.bat' }
$work = $procs | Where-Object {
  ($_.Name -eq "node.exe" -and $_.CommandLine -match 'server[\\/]dist[\\/]index\.js') -or
  ($_.Name -match '^pyw?(thonw?)?\.exe$' -and $_.CommandLine -match 'bridge\.py')
}
foreach ($p in @($loops) + @($work)) {
  if ($p) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host "  dung $($p.Name) #$($p.ProcessId)" }
}
