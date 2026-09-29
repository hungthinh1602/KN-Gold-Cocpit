/**
 * Dịch vụ vĩ mô chạy nền — giữ trạng thái cho GET /api/data (giống bản Python cũ).
 *   - giá vàng + 5 yếu tố vĩ mô: mỗi 25 giây
 *   - lịch kinh tế: mỗi 3 giờ (lỗi thì thử lại sau 5 phút)
 *   - tin vàng: mỗi 30 phút (lỗi thì thử lại sau 5 phút)
 */
import { vnClock, vnDayHM, vnHM } from "../lib/time.js";
import { biasScore, loadDrivers, loadGold, type Driver } from "./drivers.js";
import { fetchCalendar, type CalEvent } from "./calendar.js";
import { fetchNews, type NewsItem } from "./news.js";

export interface MacroState {
  updated: string | null;
  gold: Record<string, unknown> | null;
  drivers: Record<string, Driver>;
  score: number;
  error: string | null;
  calendar: CalEvent[];
  cal_updated: string | null;
  news: NewsItem[];
  news_updated: string | null;
}

export const macro: MacroState = {
  updated: null, gold: null, drivers: {}, score: 0, error: null,
  calendar: [], cal_updated: null, news: [], news_updated: null,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lặp mãi: chạy task, chờ okMs nếu thành công / errMs nếu lỗi. */
async function loop(task: () => Promise<void>, okMs: number, errMs = okMs) {
  for (;;) {
    let ok = true;
    try {
      await task();
    } catch {
      ok = false;
    }
    await sleep(ok ? okMs : errMs);
  }
}

export function startMacro() {
  loop(async () => {
    const { drivers, err } = await loadDrivers(macro.drivers);
    let gold = macro.gold;
    let error = err;
    try {
      gold = await loadGold();
    } catch (e) {
      error = `Vàng: ${(e as Error).message}`;
    }
    Object.assign(macro, { drivers, gold, score: biasScore(drivers), updated: vnClock(), error });
  }, 25_000);

  loop(async () => {
    macro.calendar = await fetchCalendar();
    macro.cal_updated = vnDayHM();
  }, 3 * 3600_000, 300_000);

  loop(async () => {
    macro.news = await fetchNews();
    macro.news_updated = vnHM();
  }, 1800_000, 300_000);
}
