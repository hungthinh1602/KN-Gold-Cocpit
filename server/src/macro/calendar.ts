/** Lịch kinh tế Mỹ tuần này (Forex Factory JSON) + giải nghĩa tác động lên vàng. */
import { fetchJson } from "../lib/http.js";
import { vnDay, vnHM, vnWeekday } from "../lib/time.js";

const CAL_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

/** (từ khóa trong tên tin) → mô tả, cơ chế, chiều vàng KHI SỐ THỰC TẾ CAO HƠN dự báo. */
const EVENT_KB: [string[], string, string, "tăng" | "giảm"][] = [
  [["non-farm", "nonfarm", "payroll", "employment change", "adp"],
    "Số việc làm mới tạo ra (ngoài nông nghiệp) — thước đo sức khỏe thị trường lao động Mỹ.",
    "Việc làm nhiều = kinh tế mạnh = Fed dễ giữ lãi suất cao → USD & lợi suất lên → đè vàng.", "giảm"],
  [["unemployment rate"], "Tỷ lệ thất nghiệp của Mỹ.",
    "Thất nghiệp CAO = lao động yếu = Fed dễ nới lỏng → hỗ trợ vàng.", "tăng"],
  [["unemployment claims", "jobless"], "Số đơn xin trợ cấp thất nghiệp hàng tuần.",
    "Đơn CAO = lao động yếu đi → Fed bồ câu hơn → hỗ trợ vàng.", "tăng"],
  [["average hourly earnings", "wage"], "Tăng trưởng tiền lương theo giờ — chỉ báo áp lực lạm phát từ lương.",
    "Lương tăng nhanh = lạm phát dai dẳng = Fed diều hâu → đè vàng.", "giảm"],
  [["cpi", "inflation", "pce", "price index", "ppi"], "Dữ liệu lạm phát của Mỹ.",
    "Lạm phát nóng → Fed diều hâu, lợi suất thực lên → thường đè vàng (dù vàng là hầm trú lạm phát).", "giảm"],
  [["ism manufacturing", "manufacturing pmi"], "Chỉ số sức khỏe ngành sản xuất Mỹ (trên 50 = mở rộng).",
    "PMI mạnh = kinh tế khỏe, risk-on → hút tiền khỏi vàng.", "giảm"],
  [["ism services", "services pmi", "non-manufacturing"], "Chỉ số sức khỏe ngành dịch vụ Mỹ (chiếm phần lớn GDP).",
    "Dịch vụ mạnh = kinh tế khỏe → USD/lợi suất lên → đè vàng.", "giảm"],
  [["jolts", "job openings"], "Số vị trí tuyển dụng còn trống — đo nhu cầu lao động.",
    "Tuyển dụng nhiều = lao động chặt = Fed diều hâu → đè vàng.", "giảm"],
  [["retail sales"], "Doanh số bán lẻ — sức chi tiêu của người tiêu dùng Mỹ.",
    "Chi tiêu mạnh = kinh tế khỏe → USD/lợi suất lên → đè vàng.", "giảm"],
  [["gdp"], "Tăng trưởng GDP của Mỹ.", "GDP mạnh = kinh tế khỏe → đè vàng; yếu → hỗ trợ vàng.", "giảm"],
  [["fomc", "federal funds", "interest rate", "powell", "fed chair", "monetary policy"],
    "Quyết định/định hướng lãi suất của Fed.",
    "Giọng điệu diều hâu / lãi suất cao hơn → USD & lợi suất lên → đè vàng mạnh.", "giảm"],
  [["consumer confidence", "consumer sentiment", "michigan"], "Niềm tin/tâm lý người tiêu dùng Mỹ.",
    "Niềm tin cao = risk-on → hút tiền khỏi vàng.", "giảm"],
  [["durable goods", "factory orders", "industrial production"], "Đơn hàng/sản lượng công nghiệp Mỹ.",
    "Số mạnh = kinh tế khỏe → USD/lợi suất lên → đè vàng.", "giảm"],
];

function classifyEvent(title: string) {
  const t = title.toLowerCase();
  const hit = EVENT_KB.find(([keys]) => keys.some((k) => t.includes(k)));
  if (hit) return { desc: hit[1], mech: hit[2], hot: hit[3] };
  return {
    desc: "Tin kinh tế Mỹ có tác động đến USD và lợi suất.",
    mech: "Theo lệ chung: số MẠNH hơn dự báo → USD/lợi suất lên → gây áp lực GIẢM lên vàng.",
    hot: "giảm" as const,
  };
}

export interface CalEvent {
  ts: number; wd: string; day: string; time: string; impact: string; title: string;
  forecast: string; previous: string; desc: string; mech: string; hot: string;
}

/** Tin USD mức High/Medium, đổi giờ VN, chỉ giữ tin sắp tới (tối đa 12). */
export async function fetchCalendar(): Promise<CalEvent[]> {
  const data = await fetchJson<any[]>(CAL_URL);
  const now = Date.now();
  const out: CalEvent[] = [];
  for (const e of data) {
    if (e.country !== "USD" || !["High", "Medium"].includes(e.impact)) continue;
    const dt = new Date(e.date);
    if (Number.isNaN(dt.getTime()) || dt.getTime() < now - 3600_000) continue;
    out.push({
      ts: dt.getTime() / 1000, wd: vnWeekday(dt), day: vnDay(dt), time: vnHM(dt), impact: e.impact,
      title: e.title ?? "", forecast: e.forecast ?? "", previous: e.previous ?? "", ...classifyEvent(e.title ?? ""),
    });
  }
  return out.sort((a, b) => a.ts - b.ts).slice(0, 12);
}
