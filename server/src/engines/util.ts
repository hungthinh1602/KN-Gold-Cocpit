/** Tiện ích dùng chung cho các bộ máy phân tích (port từ ai_engine/patterns/util.py). */
import type { Bar } from "../mt5/types.js";

export const isUp = (b: Bar) => b.close > b.open;
export const isDown = (b: Bar) => b.close < b.open;

/** Trung bình True Range của `period` nến cuối (không phải RMA). */
export function atr(bars: Bar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high: h, low: l } = bars[i];
    const pc = bars[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const seg = trs.length >= period ? trs.slice(-period) : trs;
  return seg.length ? seg.reduce((s, x) => s + x, 0) / seg.length : 0;
}

export type Dir = "bull" | "bear" | "neutral";

/** 1 mô hình phát hiện được (SMC/ICT/CRT). */
export interface Finding {
  group: string;
  kind: string;
  name: string;
  dir: Dir;
  low: number | null;
  high: number | null;
  level: number | null;
  note: string;
  tf: string | null;
  time: number | null;
}

export const finding = (group: string, kind: string, name: string, dir: Dir, low: number | null,
  high: number | null, level: number | null, note: string): Finding =>
  ({ group, kind, name, dir, low, high, level, note, tf: null, time: null });

/**
 * Định dạng số giống Python "%.Nf": khi đúng giữa (vd 4144.125) Python làm tròn về số CHẴN (4144.12),
 * còn JS toFixed làm tròn lên (4144.13) → tự xử lý trường hợp đúng giữa cho khớp bản Python.
 */
export function pyFixed(x: number, digits = 2): string {
  // Khai triển thập phân CHÍNH XÁC của số double (toFixed nhiều chữ số là chính xác),
  // chỉ khi phần sau đúng là "5000…" mới là trường hợp đúng giữa.
  const exact = x.toFixed(Math.min(100, digits + 60));
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + digits);
  if (!/^50*$/.test(tail)) return x.toFixed(digits);
  const kept = exact.slice(0, digits ? dot + 1 + digits : dot); // phần giữ lại (cắt, chưa làm tròn)
  const lastDigit = Number(kept[kept.length - 1]);
  if (lastDigit % 2 === 0) return kept;
  const step = 10 ** -digits * (x < 0 ? -1 : 1);             // lẻ → làm tròn ra xa số 0 thành số chẵn
  return (Number(kept) + step).toFixed(digits);
}
/** Định dạng như Python "%.2f" */
export const f2 = (x: number) => pyFixed(x, 2);
/** Định dạng như Python "%+.Nf" */
export const signed = (x: number, digits = 1) => (x >= 0 ? "+" : "") + pyFixed(x, digits);
/** Làm tròn như Python round(x, n) cho số dương thông thường */
export const round = (x: number, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
