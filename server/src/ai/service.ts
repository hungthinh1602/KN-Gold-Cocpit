/**
 * Dịch vụ quét AI phân tích (port _ai_scan_once / ai_loop / _ai_payload của bản Python):
 * mỗi 5 phút lấy 1500 nến × 9 khung từ MT5 → cấu trúc fractal + SMC/ICT/CRT + mô hình giá,
 * Cung/Cầu, Cấu trúc sóng, mô hình trường phái, bài nhận định tự động. Không gọi AI.
 */
import { mt5 } from "../mt5/client.js";
import type { Bar, Timeframe } from "../mt5/types.js";
import { readJson, writeJson } from "../lib/store.js";
import { macro } from "../macro/service.js";
import { vnHourFloat } from "../engines/ict.js";
import { ANALYZE_TFS, CFG, autoMacro, autoText, build } from "../engines/scan.js";
import { zones } from "../engines/cungcau.js";
import { analyze as waveAnalyze } from "../engines/wave.js";
import { analyze as schoolsAnalyze } from "../engines/schools.js";
import { mongo } from "../db/mongo.js";

const SCAN_EVERY_MS = 300_000;
const SCAN_TIMEOUT_MS = 180_000;       // 1 lần quét kẹt quá mức này thì bỏ, lần sau quét lại
const NOTE_MAX_AGE_SEC = 4 * 3600;     // bài Claude quá tuổi này → quay về bài tự động
const BARS = 1500;
const SNAPSHOT = "analysis.json";

type ScanData = ReturnType<typeof build> & Record<string, unknown>;

let data: ScanData | null = readJson<ScanData | null>(SNAPSHOT, null);   // bản quét cũ để hiện ngay khi khởi động
let scanErr: string | null = null;

function vnStampFull(d = new Date()): string {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(d);
  return `${p} (VN)`;
}

function vnDayHM(tsSec: number): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(tsSec * 1000));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}/${g("month")} ${g("hour")}:${g("minute")}`;
}

async function scanOnce(): Promise<ScanData> {
  const health = await mt5.health();
  const barsBig: Partial<Record<Timeframe, Bar[]>> = {};
  for (const tf of ANALYZE_TFS) {
    try {
      barsBig[tf] = await mt5.rates(tf, BARS);
    } catch {
      /* khung này lỗi → bỏ qua */
    }
  }
  if (!Object.keys(barsBig).length) throw new Error("MT5 không trả nến");
  const tick = await mt5.tick().catch(() => null);
  const price = tick?.bid ?? (barsBig.M15 ?? barsBig.H1)!.at(-1)!.close;
  const hourVn = vnHourFloat();
  // Cấu trúc fractal/SMC dùng n nến cuối như bản Python (500/400/300/200 tuỳ khung)
  const barsCfg = Object.fromEntries(Object.entries(barsBig).map(([tf, b]) => [tf, b!.slice(-CFG[tf as Timeframe][0])])) as Partial<Record<Timeframe, Bar[]>>;
  const d = build(barsCfg, price, hourVn, vnStampFull(), health.symbol ?? "XAUUSD") as ScanData;
  const cc: Record<string, unknown> = {};
  const wave: Record<string, unknown> = {};
  const school: Record<string, unknown> = {};
  for (const tf of ANALYZE_TFS) {
    const bl = barsBig[tf];
    if (!bl || bl.length < 20) continue;
    cc[tf] = zones(bl);
    const wv = waveAnalyze(bl);
    wave[tf] = wv;
    try {
      school[tf] = schoolsAnalyze(bl, wv, price, d.killzone, tf);
    } catch (e) {
      school[tf] = { error: (e as Error).message };
    }
    const t = d.tf_data[tf];
    if (t) t.candles = bl.map((b) => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close }));   // chart: 1500 nến
  }
  Object.assign(d, { cc, wave, school, ts: Date.now() / 1000 });
  d.auto_text = autoText(d);
  d.auto_macro = autoMacro(macro, Date.now() / 1000);
  return d;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`quá ${ms / 1000} giây không phản hồi`)), ms))]);

export function startAiScan() {
  if (mongo.configured) {
    void mongo.noteLoad().then((note) => {
      if (note) writeJson("ai_note.json", note);
    }).catch((e) => console.warn(`[mongo] AI note restore: ${(e as Error).message}`));
  }
  const run = async () => {
    try {
      data = await withTimeout(scanOnce(), SCAN_TIMEOUT_MS);
      scanErr = null;
      writeJson(SNAPSHOT, data);
    } catch (e) {
      scanErr = `Lần quét lỗi/treo (${(e as Error).message}) — sẽ quét lại`;
    }
    setTimeout(run, SCAN_EVERY_MS);
  };
  setTimeout(run, 8000);                // chờ vĩ mô tải trước
}

/** Dữ liệu cho tab AI. `tf` = chỉ gửi nến của khung đang xem (nhẹ). */
export function aiPayload(tf?: string) {
  if (!data) return { error: `chưa có dữ liệu quét (${scanErr ?? "đang quét lần đầu…"})` };
  const d: Record<string, any> = { ...data };
  if (tf && d.tf_data) {
    d.tf_data = Object.fromEntries(Object.entries(d.tf_data as Record<string, Record<string, unknown>>).map(([k, v]) => {
      if (k === tf) return [k, v];
      const { candles: _drop, ...rest } = v;
      return [k, rest];
    }));
  }
  d.age_sec = Math.round(Date.now() / 1000 - (Number(d.ts) || Date.now() / 1000));
  const note = readJson<{ ai_text?: string; macro?: string; ts?: number } | null>("ai_note.json", null);
  const age = note ? Date.now() / 1000 - (note.ts ?? 0) : null;
  if (note && age != null && age <= NOTE_MAX_AGE_SEC) {
    d.ai_text = note.ai_text || d.auto_text || "";
    d.macro = note.macro || d.auto_macro || "";
    d.ai_src = "claude";
    d.ai_updated = vnDayHM(note.ts ?? 0);
  } else {
    d.ai_text = d.auto_text || d.ai_text || "";
    d.macro = d.auto_macro || d.macro || "";
    d.ai_src = "auto";
    d.ai_updated = d.updated ?? "";
    if (note) d.ai_note_old = vnDayHM(note.ts ?? 0);
  }
  d.scan_err = scanErr;
  return d;
}

/** 3 nến cuối + giá hiện tại của 1 khung — cho chart chạy trực tiếp. */
export async function aiLive(tf: string) {
  if (!ANALYZE_TFS.includes(tf as Timeframe)) return { error: "tf không hợp lệ" };
  const [bars, tick] = await Promise.all([mt5.rates(tf as Timeframe, 3), mt5.tick().catch(() => null)]);
  return { bars: bars.map((b) => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close })), bid: tick?.bid ?? null };
}
