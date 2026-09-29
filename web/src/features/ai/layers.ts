/** Các lớp bật/tắt trên chart tab AI (nhớ trong localStorage "ailayers", cùng khoá bản cũ). */
import type { Timeframe } from "../../api/types";

export type Layers = Record<string, boolean | undefined>;

/** Nút lớp chính. */
export const MAIN_LAYERS = [
  { key: "struct", label: "🧱 Cấu trúc" },
  { key: "sd", label: "📦 Cung/Cầu" },
  { key: "smcM", label: "💧 SMC" },
  { key: "ictM", label: "⏱️ ICT" },
  { key: "crtM", label: "🕯️ CRT" },
  { key: "pattern", label: "📐 Mô hình giá" },
  { key: "order", label: "⚡ Lệnh Live" },
] as const;

/** Tuỳ chọn phụ của Cấu trúc sóng — MẶC ĐỊNH BẬT (chỉ tắt khi = false). */
export const WAVE_OPTS = [
  { key: "wvE", label: "Sóng chính" },
  { key: "wvI", label: "Nội bộ" },
  { key: "wvBos", label: "BOS/CHoCH" },
  { key: "wvIdm", label: "IDM/Sweep" },
  { key: "wvSW", label: "Strong/Weak" },
  { key: "wvPD", label: "Premium/Discount" },
] as const;

/** Cung/Cầu khung lớn hơn vẽ chồng lên khung đang xem. */
export const SD_HTF: { key: string; tf: Timeframe; label: string }[] = [
  { key: "sdH1", tf: "H1", label: "H1" },
  { key: "sdH4", tf: "H4", label: "H4" },
  { key: "sdD1", tf: "D1", label: "D" },
  { key: "sdW1", tf: "W1", label: "W" },
  { key: "sdMN", tf: "MN", label: "M" },
];

/** Mô hình trường phái: lớp → khoá dữ liệu school[tf][...] */
export const SCHOOL_LAYERS = [
  { layer: "smcM", key: "smc", icon: "💧" },
  { layer: "ictM", key: "ict", icon: "⏱️" },
  { layer: "crtM", key: "crt", icon: "🕯️" },
] as const;

export const waveOn = (L: Layers, k: string) => L[k] !== false;
