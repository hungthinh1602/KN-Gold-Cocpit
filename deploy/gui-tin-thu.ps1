# Gui bo tin THU (nhu chi bao KN 4A1 gui) len webhook de xem the lenh tren web Lenh Live — khong can TradingView.
# Chay tren VPS:    GUI-TIN-THU.bat            (gui toi http://127.0.0.1/webhook, doc khoa tu server\data\tv_webhook_token.txt)
# Chay tu laptop:   powershell -File gui-tin-thu.ps1 -Url http://36.50.134.246/webhook -Token <khoa>
# Moi tin deu kem &test=1 -> the co nhan "test", xoa duoc bang nut "Xoa lenh test" tren web.
param(
  [string]$Url = "http://127.0.0.1/webhook",
  [string]$Token = "",
  [ValidateSet("BUY", "SELL")][string]$Side = "BUY",
  [double]$Entry = 4170,          # gia Entry cua lenh thu
  [double]$Gap = 10,              # khoang cach Entry-SL (gia, 10 = 100 pip); TP xa gap 3 lan
  [double]$Delay = 1.5            # giay giua cac tin
)
$ErrorActionPreference = "Stop"
if (-not $Token) {
  $f = Join-Path $PSScriptRoot "..\server\data\tv_webhook_token.txt"
  if (-not (Test-Path $f)) { throw "Khong thay khoa. Dung -Token <khoa> hoac chay trong thu muc deploy cua ban cai." }
  $Token = (Get-Content $f -TotalCount 1).Trim()
}
$inv = [Globalization.CultureInfo]::InvariantCulture
function F($x) { ([double]$x).ToString("F2", $inv) }            # luon dau cham, khong phan nghin (khong phu thuoc may VN)
$sg = if ($Side -eq "BUY") { 1 } else { -1 }
$sl = $Entry - $sg * $Gap
$tp = $Entry + $sg * 3 * $Gap
function Px($pip) { F ($Entry + $sg * $pip * 0.1) }
$id = [int][math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() / 60)   # ma setup = phut epoch, giong chi bao
$h = "<b>KN 4A1</b> #$id - $Side : "

$m1 = "<b>KN 4A1</b> #$id — <b>$Side</b>`nEntry1=<b>$(F $Entry)</b>`nSL=<b>$(F $sl)</b>`nTP1=$(F $tp)"
$m2 = $h + "Khớp <b>Entry1</b> " + (Px 0)
$m3 = $h + "Đạt mốc <b>+50 pip</b> " + (Px 50)
$m4 = $h + "Đạt Lợi nhuận 100 pip - THẮNG. Có thể dời SL hòa hoặc đóng một phần."
$m5 = $h + "Đạt mốc <b>+150 pip</b> " + (Px 150)
$m6 = $h + "Đạt <b>TP</b> " + (F $tp)
$msgs = @(
  @("Setup moi", $m1), @("Khop Entry", $m2), @("Moc +50 pip", $m3),
  @("THANG 100", $m4), @("Moc +150", $m5), @("Dat TP", $m6)
)

$uri = "$($Url.TrimEnd('/'))?token=$Token&test=1"
foreach ($m in $msgs) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($m[1])
  try {
    $r = Invoke-RestMethod -Uri $uri -Method Post -Body $bytes -ContentType "text/plain; charset=utf-8" -TimeoutSec 20
    Write-Host ("[OK ] {0,-12} -> {1}" -f $m[0], $r.msg)
  } catch {
    Write-Host ("[LOI] {0,-12} -> {1}" -f $m[0], $_.Exception.Message) -ForegroundColor Red
    break
  }
  Start-Sleep -Seconds $Delay
}
Write-Host "Xong. Mo web Lenh Live de xem the test (ma #$id)."
