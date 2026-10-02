/** Logic vĩ mô phía giao diện: thứ tự 5 yếu tố, mức đóng góp của từng yếu tố tới vàng. */
import type { Driver } from "../../api/types";
import type { T } from "../../i18n/lang";

export const DRIVER_ORDER = ["us10y", "dxy", "real", "spx", "vix"] as const;

/** Mô tả tiếng Anh của 5 yếu tố (server trả mô tả tiếng Việt). */
export const DRIVER_WHAT_EN: Record<string, string> = {
  us10y: "US 10-year Treasury yield",
  dxy: "US Dollar Index",
  real: "10-year real yield (TIPS)",
  spx: "US stocks · risk-on",
  vix: "Fear index · safe-haven demand",
};

/** > 0: hỗ trợ vàng · < 0: đè vàng · 0: trung tính. */
export function contribution(x: Driver): number {
  const mult = x.dir === "up" ? 1 : x.dir === "down" ? -1 : 0;
  return mult * x.rise * x.weight;
}

/** Điểm tổng hợp → nhãn + màu (thang −7 … +7). */
export function verdict(score: number, t: T): { text: string; color: string } {
  if (score >= 3) return { text: t("Vàng nghiêng TĂNG mạnh", "Gold strongly BULLISH"), color: "var(--up)" };
  if (score >= 1) return { text: t("Vàng nghiêng Tăng", "Gold leaning Bullish"), color: "var(--up)" };
  if (score > -1) return { text: t("Trung lập · giằng co", "Neutral · range-bound"), color: "var(--gold)" };
  if (score > -3) return { text: t("Vàng nghiêng Giảm", "Gold leaning Bearish"), color: "var(--down)" };
  return { text: t("Vàng nghiêng GIẢM mạnh", "Gold strongly BEARISH"), color: "var(--down)" };
}
