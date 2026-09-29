/**
 * Kiểu dữ liệu API — giữ đồng bộ với server/src (macro/, orders/, engines/, ai/).
 * Chỉ khai báo những trường giao diện dùng tới.
 */
export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1" | "MN";

export const TIMEFRAMES: { tf: Timeframe; label: string }[] = [
  { tf: "M1", label: "M1" }, { tf: "M5", label: "M5" }, { tf: "M15", label: "M15" },
  { tf: "M30", label: "M30" }, { tf: "H1", label: "H1" }, { tf: "H4", label: "H4" },
  { tf: "D1", label: "D1" }, { tf: "W1", label: "W" }, { tf: "MN", label: "M" },
];
export const TF_ORDER: Timeframe[] = TIMEFRAMES.map((x) => x.tf);

// ------------------------------------------------------------------ vĩ mô (/api/data)
export type MoveDir = "up" | "down" | "flat";

export interface GoldTfTech { ma20: number | null; ma50: number | null; ma200: number | null; rsi: number | null; spark: number[] | null }
export type GoldTfKey = "4h" | "d1" | "w1";

export interface Gold {
  value: number | null; pct: number | null; pct3: number | null; pct5: number | null; pctM: number | null;
  spark: number[] | null; tf?: Partial<Record<GoldTfKey, GoldTfTech>>; ok: boolean;
}

export interface Driver {
  name: string; what: string; weight: number; rise: number;
  value: number | null; pct: number | null; pct3: number | null; pct5: number | null; pctM: number | null;
  spark: number[] | null; dir: MoveDir; ok: boolean;
}

export interface CalEvent {
  ts: number; wd: string; day: string; time: string; impact: "High" | "Medium" | string; title: string;
  forecast: string; previous: string; desc: string; mech: string; hot: "tăng" | "giảm" | string;
}

export interface NewsItem { title: string; source: string; link: string; ago: string }

export interface MacroData {
  updated: string | null; gold: Gold | null; drivers: Record<string, Driver>; score: number; error: string | null;
  calendar: CalEvent[]; cal_updated: string | null; news: NewsItem[]; news_updated: string | null;
}

// ------------------------------------------------------------------ AI phân tích (/api/ai)
export type Bias = "bull" | "bear" | "neutral";

export interface Candle { t: number; o: number; h: number; l: number; c: number }

export interface Formation {
  name: string; dir: Bias; completion: number; confirm: number | null; invalidate: number | null;
  up_break?: number; down_break?: number; note: string;
  lines: { pts: [number, number][]; color: string; label: string }[];
}

export interface Finding {
  group: string; kind: string; name: string; dir: Bias;
  low: number | null; high: number | null; level: number | null; note: string;
}

export interface LensSetup { dir: Bias; style: string; entry_low?: number; entry_high?: number; sl?: number; tp1?: number | null; tp2?: number | null }
export interface Lens { note?: string; setup?: LensSetup | null; signals?: Finding[] }
export type LensKey = "smc" | "ict" | "crt";

export interface TfData {
  structure: { trend: string; pattern: string; event?: string; formation: Formation | null };
  smc: Lens; ict: Lens; crt: Lens;
  candles?: Candle[];
}

export interface Zone { bias: 1 | -1; top: number; bottom: number; mid: number; t: number; t_end: number | null; mitigated: boolean; touched: boolean; ok: boolean }
export interface ZoneSet { zones: Zone[]; trend: number }

export interface WaveSeg { x1: number; y1: number; x2: number; y2: number; up: boolean }
export interface WaveLine { k: "BOS" | "CHoCH" | "IDM"; x1: number; x2: number; y: number; up: boolean }
export interface WaveLayer {
  trend: number; strong: number | null; weak: number | null; valid: boolean; event: string;
  segs: WaveSeg[]; lines: WaveLine[]; sweeps: { x1: number; x2: number; y: number; above: boolean }[];
  live: WaveSeg[]; strongX: number | null; weakX: number | null;
  pd?: { top: number; bot: number; mid: number; x1: number };
}
export interface Wave { step: number; t_last: number; E: WaveLayer; I: WaveLayer }

export type SchoolState = "forming" | "ready" | "active" | "running" | "done" | "fail";
export interface SchoolBox { t1: number; top: number; bot: number; k: string; bull: boolean | null }
export interface SchoolLevel { t1: number; t2: number | null; y: number; lab: string; k: "sweep" | "brk" | "eq" }
export interface SchoolModel {
  dir: "bull" | "bear" | null; title: string; state: SchoolState;
  steps: { ok: boolean; text: string }[]; wait: string; todo: string;
  draw: { boxes: SchoolBox[]; levels: SchoolLevel[] };
}
export type Schools = Partial<Record<LensKey, SchoolModel>>;

export interface AiData {
  error?: string;
  updated: string; symbol: string; price: number; killzone: string;
  timeframes: Timeframe[];
  tf_data: Partial<Record<Timeframe, TfData>>;
  cc: Partial<Record<Timeframe, ZoneSet>>;
  wave: Partial<Record<Timeframe, Wave>>;
  school: Partial<Record<Timeframe, Schools>>;
  ai_text: string; macro: string; ai_src: "claude" | "auto"; ai_updated: string; ai_note_old?: string;
  age_sec: number; scan_err: string | null;
}

export interface AiLive { error?: string; bars?: Candle[]; bid: number | null }

// ------------------------------------------------------------------ Lệnh Live (/api/orders)
export type OrderState = "pending" | "open" | "closed" | "cancelled";

export interface OrderEvent { ts: number; code: string; text: string; price: number | null }

export interface Order {
  id: string; src?: "mt5"; ticket?: number; volume?: number; profit?: number;
  indi: string; side: "BUY" | "SELL"; tf: string; test: boolean;
  entries: number[]; filled: boolean[]; sl: number | null; tps: number[];
  recv_ts: number; state: OrderState; tp_hit: number; pip50: boolean; pip100: boolean;
  mfe: number; cur_pip: number | null; result: "win" | "loss" | "cancel" | null; close_pip: number | null;
  events: OrderEvent[]; status: string; status_text: string;
}

export interface Mt5Status {
  ok: boolean; login: number | null; server: string; company: string;
  tick: number | null; off: number | null; err: string | null;
}

export interface OrdersData { orders: Order[]; now: number; mt5: Mt5Status }
