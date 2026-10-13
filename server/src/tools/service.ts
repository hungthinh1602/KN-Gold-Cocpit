/**
 * Công cụ chart lưu trên server (dùng chung mọi máy):
 *   - Cảnh báo giá: mức giá + ghi chú; server tự canh giá MT5 mỗi 2 giây (chạy 24/7, không cần mở web).
 *     Chạm mức → ghi vào danh sách "đã chạm" (web đọc để báo) rồi xoá mức đó.
 *   - Hình vẽ tay: đường ngang, hộp (thời gian = giờ server MT5 như nến).
 * Lưu JSON trong DATA_DIR: price_alerts.json, alert_hits.json, drawings.json.
 */
import { mt5 } from "../mt5/client.js";
import { readJson, writeJson } from "../lib/store.js";

export interface PriceAlert { id: string; price: number; note: string; dir: "up" | "down"; created: number }
export interface AlertHit { id: string; alertId: string; price: number; note: string; dir: "up" | "down"; hit: number; ts: number }
export interface Drawing {
  id: string; kind: "hline" | "box"; note: string; created: number;
  price?: number;                                   // hline
  t1?: number; t2?: number; p1?: number; p2?: number;   // box (t = giờ server MT5, giây)
}

const ALERTS = "price_alerts.json";
const HITS = "alert_hits.json";
const DRAWINGS = "drawings.json";
const WATCH_MS = 2000;
const MAX_ALERTS = 50, MAX_HITS = 50, MAX_DRAWINGS = 200;

const alerts = readJson<PriceAlert[]>(ALERTS, []);
const hits = readJson<AlertHit[]>(HITS, []);
const drawings = readJson<Drawing[]>(DRAWINGS, []);
let lastBid: number | null = null;
let seq = 0;

const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++ % 1000).toString(36)}`;
const r2 = (x: number) => Math.round(x * 100) / 100;
const okPrice = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 1 && x < 1e6;
const okTime = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 1e9 && x < 1e11;
const cleanNote = (x: unknown) => String(x ?? "").trim().slice(0, 200);

async function currentBid(): Promise<number | null> {
  if (lastBid != null) return lastBid;
  try {
    return (await mt5.tick()).bid;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ cảnh báo giá
export function alertsPayload() {
  return { alerts, hits: hits.slice(-30), bid: lastBid };
}

export async function addAlert(price: unknown, note: unknown) {
  if (!okPrice(price)) throw new Error("giá không hợp lệ");
  if (alerts.length >= MAX_ALERTS) throw new Error(`tối đa ${MAX_ALERTS} mức cảnh báo`);
  const bid = await currentBid();
  const a: PriceAlert = { id: newId("a"), price: r2(price), note: cleanNote(note), dir: bid != null && price < bid ? "down" : "up", created: Date.now() / 1000 };
  alerts.push(a);
  writeJson(ALERTS, alerts);
  return a;
}

export async function updateAlert(id: string, patch: { price?: unknown; note?: unknown }) {
  const a = alerts.find((x) => x.id === id);
  if (!a) return false;
  if (patch.price !== undefined) {
    if (!okPrice(patch.price)) throw new Error("giá không hợp lệ");
    a.price = r2(patch.price);
    const bid = await currentBid();
    a.dir = bid != null && a.price < bid ? "down" : "up";      // dời mức → tính lại chiều chờ
  }
  if (patch.note !== undefined) a.note = cleanNote(patch.note);
  writeJson(ALERTS, alerts);
  return true;
}

export function deleteAlert(id: string) {
  const i = alerts.findIndex((x) => x.id === id);
  if (i < 0) return false;
  alerts.splice(i, 1);
  writeJson(ALERTS, alerts);
  return true;
}

/** Canh giá MT5: chạm mức (theo chiều đang chờ) → ghi "đã chạm" + xoá mức. Chạy tuần tự, không chồng vòng. */
export function startAlertWatch() {
  const run = async () => {
    try {
      const bid = (await mt5.tick()).bid;
      lastBid = bid;
      const reached = alerts.filter((a) => (a.dir === "up" ? bid >= a.price : bid <= a.price));
      if (reached.length) {
        for (const a of reached) {
          hits.push({ id: newId("h"), alertId: a.id, price: a.price, note: a.note, dir: a.dir, hit: bid, ts: Date.now() / 1000 });
          alerts.splice(alerts.indexOf(a), 1);
        }
        hits.splice(0, Math.max(0, hits.length - MAX_HITS));
        writeJson(ALERTS, alerts);
        writeJson(HITS, hits);
      }
    } catch {
      /* MT5 tạm lỗi → vòng sau thử lại */
    }
    setTimeout(run, WATCH_MS);
  };
  void run();
}

// ------------------------------------------------------------------ hình vẽ tay
export const drawingsPayload = () => ({ drawings });

export function addDrawing(d: Partial<Drawing>) {
  if (drawings.length >= MAX_DRAWINGS) throw new Error(`tối đa ${MAX_DRAWINGS} hình`);
  let x: Drawing;
  if (d.kind === "hline" && okPrice(d.price)) {
    x = { id: newId("d"), kind: "hline", price: r2(d.price), note: cleanNote(d.note), created: Date.now() / 1000 };
  } else if (d.kind === "box" && okTime(d.t1) && okTime(d.t2) && okPrice(d.p1) && okPrice(d.p2)) {
    x = { id: newId("d"), kind: "box", t1: Math.min(d.t1, d.t2), t2: Math.max(d.t1, d.t2), p1: r2(Math.max(d.p1, d.p2)), p2: r2(Math.min(d.p1, d.p2)),
      note: cleanNote(d.note), created: Date.now() / 1000 };
  } else {
    throw new Error("hình không hợp lệ");
  }
  drawings.push(x);
  writeJson(DRAWINGS, drawings);
  return x;
}

export function updateDrawing(id: string, patch: { price?: unknown; note?: unknown }) {
  const d = drawings.find((x) => x.id === id);
  if (!d) return false;
  if (patch.price !== undefined && d.kind === "hline") {
    if (!okPrice(patch.price)) throw new Error("giá không hợp lệ");
    d.price = r2(patch.price);
  }
  if (patch.note !== undefined) d.note = cleanNote(patch.note);
  writeJson(DRAWINGS, drawings);
  return true;
}

export function deleteDrawing(id: string | "all") {
  if (id === "all") {
    drawings.length = 0;
  } else {
    const i = drawings.findIndex((x) => x.id === id);
    if (i < 0) return false;
    drawings.splice(i, 1);
  }
  writeJson(DRAWINGS, drawings);
  return true;
}
