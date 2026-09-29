/**
 * Các yếu tố vĩ mô ảnh hưởng vàng + điểm thiên hướng tổng hợp.
 * `rise` = ảnh hưởng lên vàng KHI yếu tố đó TĂNG (-1 đè vàng, +1 đỡ vàng).
 */
import { goldTech, pctOver, resample } from "./indicators.js";
import { fetchTreasuryReal, fetchYahoo, getSpotGold, type Series } from "./sources.js";

interface DriverDef {
  id: string;
  name: string;
  what: string;
  weight: number;
  yahoo: string | null; // null = lấy từ US Treasury
  rise: 1 | -1;
}

export const DRIVERS: DriverDef[] = [
  { id: "us10y", name: "US10Y", what: "Lợi suất TP Mỹ 10 năm", weight: 1.5, yahoo: "^TNX", rise: -1 },
  { id: "dxy", name: "DXY", what: "Chỉ số sức mạnh USD", weight: 1.5, yahoo: "DX-Y.NYB", rise: -1 },
  { id: "real", name: "Real Yield", what: "Lợi suất thực 10 năm (TIPS)", weight: 2.0, yahoo: null, rise: -1 },
  { id: "spx", name: "SPX", what: "Chứng khoán Mỹ · risk-on", weight: 1.0, yahoo: "^GSPC", rise: -1 },
  { id: "vix", name: "VIX", what: "Chỉ số sợ hãi · cầu trú ẩn", weight: 1.0, yahoo: "^VIX", rise: 1 },
];

const GOLD_SYMBOL = "GC=F";
const DEADBAND = 0.08; // % thay đổi nhỏ hơn mức này coi như đi ngang

export type Dir = "up" | "down" | "flat";
export const direction = (pct: number | null): Dir =>
  pct == null ? "flat" : pct > DEADBAND ? "up" : pct < -DEADBAND ? "down" : "flat";

/** ^TNX đôi khi trả ×10 (47.3) — đưa về dạng % (4.73). */
const normYield = (v: number) => (v > 20 ? v / 10 : v);

export interface Driver {
  name: string; what: string; weight: number; rise: number;
  value: number | null; pct: number | null; pct3: number | null; pct5: number | null; pctM: number | null;
  spark: number[] | null; dir: Dir; ok: boolean;
}

function toDriver(def: DriverDef, s: Series): Driver {
  const pct = pctOver(s.closes, 1) ?? (s.prev ? ((s.cur - s.prev) / s.prev) * 100 : 0);
  return {
    name: def.name, what: def.what, weight: def.weight, rise: def.rise,
    value: s.cur, pct, pct3: pctOver(s.closes, 3), pct5: pctOver(s.closes, 5), pctM: pctOver(s.closes, 21),
    spark: s.closes.slice(-60).map((x) => Math.round(x * 10000) / 10000),
    dir: direction(pct), ok: true,
  };
}

/** Lấy 5 yếu tố vĩ mô. Lỗi thì giữ giá trị cũ (prev) — Real Yield lỗi thì suy theo US10Y. */
export async function loadDrivers(prev: Record<string, Driver>): Promise<{ drivers: Record<string, Driver>; err: string | null }> {
  const drivers: Record<string, Driver> = {};
  let err: string | null = null;
  for (const def of DRIVERS) {
    try {
      let s = def.yahoo ? await fetchYahoo(def.yahoo) : await fetchTreasuryReal();
      if (def.id === "us10y") s = { cur: normYield(s.cur), prev: normYield(s.prev), closes: s.closes.map(normYield) };
      drivers[def.id] = toDriver(def, s);
    } catch (e) {
      const ref = drivers.us10y;
      if (def.id === "real" && ref?.value != null) {
        drivers.real = { ...ref, name: def.name, what: "Lợi suất thực (≈ suy theo US10Y — nguồn lỗi)",
          weight: def.weight, rise: def.rise, value: null, spark: null, ok: false };
        err = "Real Yield dùng ước lượng (nguồn không truy cập được)";
      } else {
        err = `${def.name}: ${(e as Error).message}`;
        drivers[def.id] = prev[def.id] ?? { name: def.name, what: def.what, weight: def.weight, rise: def.rise,
          value: null, pct: null, pct3: null, pct5: null, pctM: null, spark: null, dir: "flat", ok: false };
      }
    }
  }
  return { drivers, err };
}

/** Điểm thiên hướng: cộng (hướng × ảnh hưởng × trọng số) của các yếu tố có dữ liệu. */
export function biasScore(drivers: Record<string, Driver>): number {
  let score = 0;
  for (const def of DRIVERS) {
    const d = drivers[def.id];
    if (d && d.value != null) score += (d.dir === "up" ? 1 : d.dir === "down" ? -1 : 0) * def.rise * def.weight;
  }
  return Math.round(score * 100) / 100;
}

/** Giá vàng: giá hiện tại theo spot thật (gold-api), %/MA/RSI/sparkline tính trên GC=F (cần lịch sử). */
export async function loadGold() {
  const g = await fetchYahoo(GOLD_SYMBOL, "1y");
  const tf: Record<string, ReturnType<typeof goldTech>> = { d1: goldTech(g.closes) };
  try {
    tf["4h"] = goldTech(resample((await fetchYahoo(GOLD_SYMBOL, "3mo", "1h")).closes, 4));
  } catch {
    tf["4h"] = null;
  }
  try {
    tf.w1 = goldTech((await fetchYahoo(GOLD_SYMBOL, "5y", "1wk")).closes);
  } catch {
    tf.w1 = null;
  }
  const gold: Record<string, unknown> = {
    value: g.cur,
    pct: pctOver(g.closes, 1) ?? (g.prev ? ((g.cur - g.prev) / g.prev) * 100 : 0),
    pct3: pctOver(g.closes, 3), pct5: pctOver(g.closes, 5), pctM: pctOver(g.closes, 21),
    tf, spark: g.closes.slice(-60).map((x) => Math.round(x * 100) / 100), ok: true,
  };
  const spot = await getSpotGold();
  if (spot) {
    gold.value = Math.round(spot * 100) / 100;
    gold.spot = true;
  }
  return gold;
}
