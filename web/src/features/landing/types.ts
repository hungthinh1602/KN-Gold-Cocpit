/** Dữ liệu GET /api/public/home (trang giới thiệu). */
export interface PublicCard {
  side: "BUY" | "SELL";
  name: string;
  tf: string;
  entry: number;
  sl: number | null;
  ts: number;
  close_ts: number;
  result: "win" | "loss";
  close_pip: number | null;
  win: { label: string; price: number; pip: number } | null;
  path?: number[];
}

export interface PublicHome {
  price: number | null;
  pct: number | null;
  tape: { name: string; value: number; pct: number | null }[];
  next: { title: string; ts: number } | null;
  trends: Record<string, number>;
  candles: { t: number; o: number; h: number; l: number; c: number }[];
  stats: { total: number; win: number; loss: number; winrate: number | null; pips: number };
  week: { win: number; pips: number };
  wins: PublicCard[];
  recent: PublicCard[];
  authed: boolean;
  links: { login: string; register: string };
}

/** Số kiểu "4 012.35" (nhóm nghìn bằng khoảng trắng). */
export const fmtPx = (v: number, d = 2) => v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** "13/10 14:20" theo giờ Việt Nam. */
export function vnTime(ts: number) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ts * 1000));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}/${g("month")} ${g("hour")}:${g("minute")}`;
}

export const signed = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtPx(Math.abs(v), Math.abs(v) % 1 ? 1 : 0);
