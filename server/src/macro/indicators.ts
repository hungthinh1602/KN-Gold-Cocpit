/** Chỉ báo đơn giản trên chuỗi giá đóng cửa (cũ → mới). */

/** % thay đổi của phiên gần nhất so với n phiên trước. */
export function pctOver(closes: number[], n: number): number | null {
  if (closes.length > n) {
    const a = closes[closes.length - 1];
    const b = closes[closes.length - 1 - n];
    if (b) return ((a - b) / b) * 100;
  }
  return null;
}

/** Trung bình động n phiên. */
export function sma(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  return closes.slice(-n).reduce((s, x) => s + x, 0) / n;
}

/** RSI (Wilder) trên toàn chuỗi. */
export function rsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null;
  const d = closes.slice(1).map((c, i) => c - closes[i]);
  let ag = d.slice(0, n).reduce((s, x) => s + Math.max(x, 0), 0) / n;
  let al = d.slice(0, n).reduce((s, x) => s + Math.max(-x, 0), 0) / n;
  for (let i = n; i < d.length; i++) {
    ag = (ag * (n - 1) + Math.max(d[i], 0)) / n;
    al = (al * (n - 1) + Math.max(-d[i], 0)) / n;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

/** Gộp mỗi k nến thành 1 (lấy giá đóng cửa cuối nhóm), giữ nến mới nhất. */
export function resample(closes: number[], k: number): number[] {
  const out: number[] = [];
  for (let i = closes.length - 1; i >= 0; i -= k) out.unshift(closes[i]);
  return out;
}

/** MA20/50/200, RSI, sparkline 60 điểm cho 1 chuỗi giá. */
export function goldTech(series: number[]) {
  if (!series.length) return null;
  return {
    ma20: sma(series, 20), ma50: sma(series, 50), ma200: sma(series, 200),
    rsi: rsi(series, 14), spark: series.slice(-60).map((x) => Math.round(x * 100) / 100),
  };
}
