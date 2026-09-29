/** Candle Range Theory 3 nến (port patterns/crt.py): nến 1 range, nến 2 quét 1 phía rồi đóng vào trong. */
import type { Bar } from "../mt5/types.js";
import { finding, type Finding } from "./util.js";

export function crt(bars: Bar[]): Finding[] {
  if (bars.length < 3) return [];
  const c1 = bars[bars.length - 3];
  const c2 = bars[bars.length - 2];
  const out: Finding[] = [];
  if (c2.high > c1.high && c2.close < c1.high)
    out.push(finding("CRT", "CRT", "CRT giảm (quét đỉnh)", "bear", c1.low, c1.high, c1.high,
      "Nến 2 quét đỉnh nến 1 rồi đóng vào trong → kỳ vọng phân phối XUỐNG"));
  if (c2.low < c1.low && c2.close > c1.low)
    out.push(finding("CRT", "CRT", "CRT tăng (quét đáy)", "bull", c1.low, c1.high, c1.low,
      "Nến 2 quét đáy nến 1 rồi đóng vào trong → kỳ vọng phân phối LÊN"));
  return out;
}
