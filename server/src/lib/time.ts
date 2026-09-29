/** Giờ Việt Nam (UTC+7) — định dạng dùng trong dữ liệu gửi web. */

const VN = "Asia/Ho_Chi_Minh";

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: g("year"), mo: g("month"), d: g("day"), h: g("hour"), mi: g("minute"), s: g("second"), wd: g("weekday") };
}

/** "HH:MM:SS" giờ VN */
export const vnClock = (d = new Date()) => { const p = parts(d); return `${p.h}:${p.mi}:${p.s}`; };
/** "HH:MM" giờ VN */
export const vnHM = (d = new Date()) => { const p = parts(d); return `${p.h}:${p.mi}`; };
/** "DD/MM HH:MM" giờ VN */
export const vnDayHM = (d = new Date()) => { const p = parts(d); return `${p.d}/${p.mo} ${p.h}:${p.mi}`; };
/** "MMDDHHMMSS" giờ VN — dùng làm mã lệnh */
export const vnStamp = (d = new Date()) => { const p = parts(d); return `${p.mo}${p.d}${p.h}${p.mi}${p.s}`; };
/** Thứ theo giờ VN: "T2".."CN" */
export const vnWeekday = (d: Date) => {
  const map: Record<string, string> = { Mon: "T2", Tue: "T3", Wed: "T4", Thu: "T5", Fri: "T6", Sat: "T7", Sun: "CN" };
  return map[parts(d).wd] ?? "";
};
export const vnDay = (d: Date) => { const p = parts(d); return `${p.d}/${p.mo}`; };
