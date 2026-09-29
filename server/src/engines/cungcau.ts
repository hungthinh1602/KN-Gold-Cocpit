/**
 * Vùng CUNG/CẦU theo chỉ báo "CUNG CAU 1" của anh (Smart Money Concepts + Cung/Cầu [LuxAlgo mod]),
 * giữ đúng cài đặt mặc định (port ai_engine/cungcau.py):
 * - CẦU = nến ngay TRƯỚC cây tăng mạnh tạo FVG tăng; CUNG = trước cây giảm mạnh tạo FVG giảm.
 *   Cây đẩy phải vượt ngưỡng tự động (trung bình |thân %| tích luỹ × 2). Chỉ lấy FVG ĐẦU CỤM.
 * - CHẠM mép vùng → touched (vẫn kéo dài). QUÉT HẾT vùng → mitigated (dừng tại cây quét, vẽ nhạt).
 * - "OK" = chưa chạm + thuận xu hướng Swing (cấu trúc 50 nến, BOS/CHoCH theo giá đóng cửa).
 * - Tối đa 20 vùng (xoá vùng đã quét cũ nhất trước).
 */
import type { Bar } from "../mt5/types.js";

const SWING_LEN = 50;
const MAX_ZONES = 20;

export interface Zone {
  bias: 1 | -1;
  top: number;
  bottom: number;
  mid: number;
  t: number;
  t_end: number | null;
  mitigated: boolean;
  touched: boolean;
  ok: boolean;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Xu hướng Swing cuối: +1 tăng, -1 giảm, 0 chưa rõ (port leg()/displayStructure() của Pine). */
function swingTrend(bars: Bar[], size = SWING_LEN): number {
  let leg = 0;
  let prevLeg = 0;
  let hiLvl: number | null = null;
  let loLvl: number | null = null;
  let hiCrossed = false;
  let loCrossed = false;
  let trend = 0;
  for (let i = 0; i < bars.length; i++) {
    const prevHi = hiLvl;
    const prevLo = loLvl;
    if (i >= size) {
      const hs = bars[i - size];
      let maxH = -Infinity;
      let minL = Infinity;
      for (let k = i - size + 1; k <= i; k++) {
        if (bars[k].high > maxH) maxH = bars[k].high;
        if (bars[k].low < minL) minL = bars[k].low;
      }
      if (hs.high > maxH) leg = 0;
      else if (hs.low < minL) leg = 1;
      if (leg !== prevLeg) {
        if (leg === 1) { loLvl = hs.low; loCrossed = false; }       // chân tăng bắt đầu → đáy swing mới
        else { hiLvl = hs.high; hiCrossed = false; }                // chân giảm bắt đầu → đỉnh swing mới
      }
      prevLeg = leg;
    }
    if (i === 0) continue;
    const c = bars[i].close;
    const c1 = bars[i - 1].close;
    const ph = prevHi ?? hiLvl;
    const pl = prevLo ?? loLvl;
    if (hiLvl != null && !hiCrossed && c > hiLvl && ph != null && c1 <= ph) { hiCrossed = true; trend = 1; }
    if (loLvl != null && !loCrossed && c < loLvl && pl != null && c1 >= pl) { loCrossed = true; trend = -1; }
  }
  return trend;
}

interface WorkZone { bias: 1 | -1; top: number; bottom: number; t: number; t_end: number | null; mitigated: boolean; touched: boolean }

/** bars cũ → mới (cây cuối có thể đang chạy). */
export function zones(bars: Bar[]): { zones: Zone[]; trend: number } {
  const n = bars.length;
  if (n < 5) return { zones: [], trend: 0 };
  const lastClosed = n - 2;                       // cây cuối coi như đang chạy
  const zs: WorkZone[] = [];
  let prevBull = false;
  let prevBear = false;
  let cum = 0;
  for (let i = 2; i < n; i++) {
    const b = bars[i];
    const b1 = bars[i - 1];
    const b2 = bars[i - 2];
    for (const z of zs) {                          // 1) cập nhật vùng
      if (z.mitigated) continue;
      if (z.bias === 1 ? b.low <= z.top : b.high >= z.bottom) z.touched = true;
      if (z.bias === 1 ? b.low < z.bottom : b.high > z.top) { z.mitigated = true; z.t_end = b.time; }
    }
    const delta = b1.open ? (b1.close - b1.open) / (b1.open * 100) : 0;   // 2) vùng mới
    cum += Math.abs(delta);
    const thr = (cum / i) * 2;
    const bullRaw = b.low > b2.high;
    const bearRaw = b.high < b2.low;
    if (i <= lastClosed) {
      if (bullRaw && b1.close > b2.high && delta > thr && b.close >= b2.high && !prevBull)
        zs.unshift({ bias: 1, top: b2.high, bottom: b2.low, t: b2.time, t_end: null, mitigated: false, touched: false });
      if (bearRaw && b1.close < b2.low && -delta > thr && b.close <= b2.low && !prevBear)
        zs.unshift({ bias: -1, top: b2.high, bottom: b2.low, t: b2.time, t_end: null, mitigated: false, touched: false });
      prevBull = bullRaw;
      prevBear = bearRaw;
      while (zs.length > MAX_ZONES) {             // xoá vùng đã quét cũ nhất trước
        let idx = zs.length - 1;
        for (let k = zs.length - 1; k >= 0; k--) if (zs[k].mitigated) { idx = k; break; }
        zs.splice(idx, 1);
      }
    }
  }
  const trend = swingTrend(bars);
  return {
    trend,
    zones: zs.map((z) => ({
      bias: z.bias, top: r2(z.top), bottom: r2(z.bottom), mid: r2((z.top + z.bottom) / 2), t: z.t, t_end: z.t_end,
      mitigated: z.mitigated, touched: z.touched, ok: !z.mitigated && !z.touched && z.bias === trend,
    })),
  };
}
