/** Logic vĩ mô phía giao diện: thứ tự 5 yếu tố, mức đóng góp của từng yếu tố tới vàng. */
import type { Driver } from "../../api/types";

export const DRIVER_ORDER = ["us10y", "dxy", "real", "spx", "vix"] as const;

/** > 0: hỗ trợ vàng · < 0: đè vàng · 0: trung tính. */
export function contribution(x: Driver): number {
  const mult = x.dir === "up" ? 1 : x.dir === "down" ? -1 : 0;
  return mult * x.rise * x.weight;
}

/** Điểm tổng hợp → nhãn + màu (thang −7 … +7). */
export function verdict(score: number): { text: string; color: string } {
  if (score >= 3) return { text: "Vàng nghiêng TĂNG mạnh", color: "var(--up)" };
  if (score >= 1) return { text: "Vàng nghiêng Tăng", color: "var(--up)" };
  if (score > -1) return { text: "Trung lập · giằng co", color: "var(--gold)" };
  if (score > -3) return { text: "Vàng nghiêng Giảm", color: "var(--down)" };
  return { text: "Vàng nghiêng GIẢM mạnh", color: "var(--down)" };
}
