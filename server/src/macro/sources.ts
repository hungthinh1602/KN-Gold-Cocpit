/** Nguồn dữ liệu vĩ mô miễn phí (không cần key). */
import { fetchJson, fetchJsonInsecure, fetchText } from "../lib/http.js";

export interface Series {
  cur: number;
  prev: number;
  closes: number[];
}

/** Yahoo chart API: giá hiện tại, giá đóng cửa trước, chuỗi đóng cửa. */
export async function fetchYahoo(symbol: string, range = "3mo", interval = "1d"): Promise<Series> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const data = await fetchJson<any>(url, 12_000);
  const res = data.chart.result[0];
  const meta = res.meta;
  const closes: number[] = (res.indicators?.quote?.[0]?.close ?? []).filter((c: number | null) => c != null);
  return {
    cur: Number(meta.regularMarketPrice),
    prev: Number(meta.previousClose ?? meta.chartPreviousClose),
    closes,
  };
}

/** Lợi suất thực 10 năm (TIPS) từ Bộ Tài chính Mỹ — nối 2 năm để đủ dữ liệu cả lúc đầu năm. */
export async function fetchTreasuryReal(): Promise<Series> {
  const yr = new Date().getFullYear();
  const pairs: [number, number][] = [];
  for (const y of [yr - 1, yr]) {
    const url =
      "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/" +
      `${y}/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
    let raw = "";
    try {
      raw = await fetchText(url, 15_000);
    } catch {
      continue;
    }
    for (const line of raw.trim().split(/\r?\n/).slice(1)) {
      const p = line.split(",");                 // Date, 5YR, 7YR, 10YR, ...
      const [m, d, yy] = (p[0] ?? "").trim().replace(/"/g, "").split("/").map(Number);
      const v = Number(p[3]);
      if (yy && !Number.isNaN(v) && p[3] !== "") pairs.push([Date.UTC(yy, m - 1, d), v]);
    }
  }
  if (!pairs.length) throw new Error("Treasury real yield rỗng");
  pairs.sort((a, b) => a[0] - b[0]);
  const closes = pairs.map((x) => x[1]);
  return { cur: closes[closes.length - 1], prev: closes[closes.length - 2] ?? closes[closes.length - 1], closes };
}

/** Giá spot XAU/USD thật (gold-api.com, cache 30 giây). 0 nếu chưa lấy được. */
let spot = { price: 0, at: 0 };
export async function getSpotGold(): Promise<number> {
  if (Date.now() - spot.at < 30_000) return spot.price;
  try {
    const d = await fetchJsonInsecure<{ price: number }>("https://api.gold-api.com/price/XAU");
    spot = { price: Number(d.price), at: Date.now() };
  } catch {
    /* giữ giá cũ */
  }
  return spot.price;
}
