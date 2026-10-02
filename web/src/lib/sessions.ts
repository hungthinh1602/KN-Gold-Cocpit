/** Phiên giao dịch Sydney / Tokyo / London / New York, quy về phút trong ngày theo giờ VN (tự tính giờ mùa hè). */

export interface SessionDef { name: string; tz: string; open: number; close: number; color: string }

export const SESSIONS: SessionDef[] = [
  { name: "Sydney", tz: "Australia/Sydney", open: 7, close: 16, color: "#3b5fce" },
  { name: "Tokyo", tz: "Asia/Tokyo", open: 9, close: 18, color: "#b0158a" },
  { name: "London", tz: "Europe/London", open: 8, close: 17, color: "#3b9cf0" },
  { name: "New York", tz: "America/New_York", open: 8, close: 17, color: "#4cc421" },
];

const WD: Record<string, string> = { Mon: "T2", Tue: "T3", Wed: "T4", Thu: "T5", Fri: "T6", Sat: "T7", Sun: "CN" };   // thứ kiểu Việt; tiếng Anh giữ Mon/Tue…

function tzParts(tz: string, d: Date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return { y: +g("year"), mo: +g("month"), d: +g("day"), h: +g("hour") % 24, mi: +g("minute"), wd: g("weekday") };
}

/** Lệch múi giờ (phút) của tz so với UTC tại thời điểm d. */
function tzOffset(tz: string, d: Date) {
  const q = tzParts(tz, d);
  return Math.round((Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi) - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

export interface SessionRow { def: SessionDef; start: number; end: number; on: boolean }

export function sessionState(now = new Date(), lang: "vi" | "en" = "vi") {
  const vn = tzParts("Asia/Ho_Chi_Minh", now);
  const vnMin = vn.h * 60 + vn.mi;
  const ny = tzParts("America/New_York", now);
  const nyMin = ny.h * 60 + ny.mi;
  const weekend = ny.wd === "Sat" || (ny.wd === "Fri" && nyMin >= 17 * 60) || (ny.wd === "Sun" && nyMin < 17 * 60);
  const rows: SessionRow[] = SESSIONS.map((def) => {
    const off = tzOffset(def.tz, now);
    const norm = (m: number) => (((m - off + 420) % 1440) + 1440) % 1440; // giờ địa phương → phút giờ VN
    const start = norm(def.open * 60);
    const end = norm(def.close * 60);
    const on = !weekend && (start < end ? vnMin >= start && vnMin < end : vnMin >= start || vnMin < end);
    return { def, start, end, on };
  });
  const open = rows.filter((r) => r.on).map((r) => r.def.name);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { rows, open, weekend, vnMin, clock: `${pad(vn.h)}:${pad(vn.mi)} ${lang === "en" ? vn.wd : WD[vn.wd] ?? ""}` };
}
