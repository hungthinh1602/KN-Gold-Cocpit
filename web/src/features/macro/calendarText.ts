/** Chuyển vài chữ tiếng Việt do server trả (thứ, "x giờ trước") sang tiếng Anh. */
const WD_EN: Record<string, string> = { T2: "Mon", T3: "Tue", T4: "Wed", T5: "Thu", T6: "Fri", T7: "Sat", CN: "Sun" };

export const weekdayEn = (wd: string) => WD_EN[wd] ?? wd;

/** "5 phút trước" / "2 giờ trước" / "3 ngày trước" → "5 min ago" / "2 h ago" / "3 days ago". */
export function agoEn(s: string): string {
  const m = s.match(/^(\d+)\s*(phút|giờ|ngày)\s*trước$/);
  if (!m) return s;
  const n = Number(m[1]);
  return m[2] === "phút" ? `${n} min ago` : m[2] === "giờ" ? `${n} h ago` : `${n} day${n > 1 ? "s" : ""} ago`;
}
