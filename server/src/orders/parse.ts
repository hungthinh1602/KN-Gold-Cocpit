/**
 * Đọc tin webhook TradingView → lệnh.
 * JSON: {"indi","side","tf","entry"/"entry1..3","sl","tp","test","cmd":"cancel"}
 * hoặc chữ tự do: "BUY XAUUSD M15 — KN A1 : Entry=4280 SL=4270 TP=4290".
 */
import { PIP_SIZE } from "./types.js";

export interface ParsedSignal {
  indi: string;
  side: "BUY" | "SELL" | null;
  tf: string;
  symbol: string;
  test: boolean;
  cmd: "" | "cancel";
  entries: number[];
  sl: number | null;
  tps: number[];
  pip: number;
}

const num = (v: unknown): number | null => {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) && x > 0 ? x : null;
};

function parseFreeText(raw: string): Record<string, string> {
  const txt = raw.replace(/<[^>]+>/g, " ");
  const d: Record<string, string> = {};
  const side = txt.match(/\b(BUY|SELL|MUA|B[AÁ]N)\b/i);
  if (side) d.side = side[1];
  const pats: [string, RegExp][] = [
    ["entry1", /Entry\s*1?\s*[=:]\s*([\d.,]+)/i], ["entry2", /Entry\s*2\s*[=:]\s*([\d.,]+)/i],
    ["entry3", /Entry\s*3\s*[=:]\s*([\d.,]+)/i], ["sl", /\bSL\s*[=:]\s*([\d.,]+)/i],
  ];
  for (const [k, re] of pats) {
    const m = txt.match(re);
    if (m) d[k] = m[1];
  }
  for (const m of txt.matchAll(/\bTP\s*(\d)?\s*[=:]\s*([\d.,]+)/gi)) d["tp" + (m[1] ?? "1")] = m[2];
  const tf = txt.match(/\b(M1|M5|M15|M30|H1|H4|D1|W1)\b/i);
  if (tf) d.tf = tf[1].toUpperCase();
  // mẫu "BUY XAUUSD M15 — KN A1 : Entry=…" → tên chỉ báo nằm giữa "—" và ":"
  const indi = txt.match(/[—–-]\s*([^:\n—–-]{2,40}?)\s*:/) ?? txt.match(/^\s*([^\n—:-]{2,40}?)\s*[—:-]/);
  d.indi = indi ? indi[1].trim() : "TradingView";
  if (/\b(H[UỦ]Y|CANCEL)\b/i.test(txt) && !d.entry1) d.cmd = "cancel";
  return d;
}

// ───────────────────────────────  TIN CỦA CHỈ BÁO KN (có mã setup)  ───────────────────────────────
// Setup:  "<b>KN 4A1</b> #29343005 — 🟢 <b>BUY</b> (XAUUSD M5)\n🎯 Entry1=<b>4180.50</b>\n🛑 SL=<b>4175.00</b>\nTP1=4220.00"
// Sự kiện: "<b>KN 4A1</b> #29343005 - BUY (XAUUSD M5) : 🎯 Khớp <b>Entry1</b> 4180.50" (Đạt mốc +N pip · THẮNG · Đạt TP ·
//          Đóng lệnh tại SL · Hủy lệnh chờ — lý do: … · Ẩn lệnh). Mã "#…" ghép tin với đúng lệnh dù tin đến lộn thứ tự.

export type KnEvent =
  | { kind: "entry" }
  | { kind: "pip"; pip: number; price: number | null }
  | { kind: "win"; pip: number }
  | { kind: "tp"; price: number | null }
  | { kind: "sl"; price: number | null }
  | { kind: "cancel"; why?: string }          // tin chỉ ghi "Hủy"; lý do (nếu có) chỉ lưu, không hiện
  | { kind: "hide" };

export interface KnMessage {
  indi: string;
  side: "BUY" | "SELL";
  tf: string;
  symbol: string;
  sid: string;                                                  // mã setup
  setup?: { entry: number; sl: number; tp: number };
  event?: KnEvent;
}

/** Thứ tự hợp lý của sự kiện trong 1 lệnh — dùng khi nhiều tin đến TRƯỚC setup. */
export const knRank = (e: KnEvent) =>
  ({ entry: 0, pip: 1, win: 2, tp: 3, sl: 4, cancel: 4, hide: 5 })[e.kind];

/** Nhận ra tin có mã setup. Không phải dạng này → null (rơi về parseSignal cũ). Dạng này mà hỏng → ném lỗi. */
export function parseKn(raw: string): KnMessage | null {
  const txt = (raw ?? "").normalize("NFC").replace(/<[^>]+>/g, "");
  // Dạng chỉ báo gửi: "KN 4A1 #123 - BUY (XAUUSD M5) : …" — nhận thêm dạng gõ tay "KN 4A1 - BUY - #123 : …"
  const head = txt.match(/^\s*(.+?)\s+#(\d{4,})\s+[—–-]\s*([\s\S]*)$/);
  const alt = head ? null : txt.match(/^\s*(.+?)\s+[—–-]\s+(BUY|SELL)\s+[—–-]\s+#(\d{4,})\s*:?\s*([\s\S]*)$/);
  if (!head && !alt) return null;
  const [indi, sid, body] = head ? [head[1], head[2], head[3]] : [alt![1], alt![3], `${alt![2]} ${alt![4]}`];
  const side = body.match(/\b(BUY|SELL)\b/)?.[1] as "BUY" | "SELL" | undefined;
  if (!side) throw new Error("tin có mã setup nhưng thiếu BUY/SELL");
  const st = body.match(/\(\s*([A-Za-z0-9._]+)\s+M(\d+)\s*\)/);
  const base = { indi: indi.trim().slice(0, 40), side, sid, symbol: st?.[1] ?? "XAUUSD", tf: st ? `M${st[2]}` : "" };
  const n = (re: RegExp) => { const v = Number(body.match(re)?.[1]); return Number.isFinite(v) && v > 0 ? v : null; };

  // Setup: có Entry/SL/TP
  const sl = n(/\bSL\s*=\s*([\d.]+)/);
  const tp = n(/\bTP\s*\d?\s*=\s*([\d.]+)/);
  if (sl != null && tp != null) {
    const entry = n(/Entry\s*\d?\s*=\s*([\d.]+)/);
    if (entry == null) throw new Error("setup thiếu Entry");
    return { ...base, setup: { entry, sl, tp } };
  }
  // Sự kiện — thứ tự kiểm tra: Hủy trước (nếu tin có lý do thì lý do có thể chứa chữ Entry/TP)
  let event: KnEvent | null = null;
  if (/Hủy/.test(body)) event = { kind: "cancel", why: body.match(/lý do\s*:\s*([\s\S]+)$/)?.[1]?.trim() };
  else if (/Ẩn lệnh/.test(body)) event = { kind: "hide" };
  else if (/Khớp\s+Entry/.test(body)) event = { kind: "entry" };
  else if (/Đạt mốc/.test(body)) {
    const pip = n(/\+\s*([\d.]+)\s*pip/);
    if (pip != null) event = { kind: "pip", pip, price: n(/pip\s+([\d.]+)/) };
  } else if (/Đạt Lợi nhuận/.test(body)) {
    const pip = n(/Lợi nhuận\s+([\d.]+)\s*pip/);
    if (pip != null) event = { kind: "win", pip };
  } else if (/Đạt\s+TP/.test(body)) event = { kind: "tp", price: n(/TP\s+([\d.]+)/) };
  else if (/Đóng lệnh tại\s+SL/.test(body)) event = { kind: "sl", price: n(/SL\s+([\d.]+)/) };
  if (!event) throw new Error("không hiểu sự kiện của tin có mã setup");
  return { ...base, event };
}

export function parseSignal(raw: string): ParsedSignal {
  raw = (raw ?? "").trim();
  let d: Record<string, unknown> | null = null;
  if (raw.startsWith("{")) {
    try {
      d = Object.fromEntries(Object.entries(JSON.parse(raw)).map(([k, v]) => [k.toLowerCase().trim(), v]));
    } catch {
      d = null;
    }
  }
  d ??= parseFreeText(raw);
  const sideRaw = String(d.side ?? d.dir ?? d.action ?? "").toUpperCase();
  const side = ["BUY", "MUA", "LONG"].includes(sideRaw) ? "BUY" : ["SELL", "BÁN", "BAN", "SHORT"].includes(sideRaw) ? "SELL" : null;
  const cmd = String(d.cmd ?? d.type ?? "").toLowerCase() === "cancel" ? "cancel" : "";
  const base = {
    indi: String(d.indi ?? d.indicator ?? d.name ?? "TradingView").slice(0, 40),
    side, tf: String(d.tf ?? d.timeframe ?? "").slice(0, 8),
    symbol: String(d.symbol ?? d.ticker ?? "XAUUSD").slice(0, 20),
    test: ["true", "1", "yes"].includes(String(d.test).toLowerCase()), cmd,
  } as const;
  if (cmd === "cancel") return { ...base, entries: [], sl: null, tps: [], pip: PIP_SIZE };
  if (!side) throw new Error("thiếu BUY/SELL");
  const entries = [num(d.entry1 ?? d.entry), num(d.entry2), num(d.entry3)].filter((x): x is number => x != null);
  const sl = num(d.sl);
  const tp = num(d.tp ?? d.tp1);                    // CHỈ 1 TP: chạm TP = đóng lệnh
  if (!sl || !tp) throw new Error("thiếu SL hoặc TP");
  return { ...base, entries, sl, tps: [tp], pip: num(d.pip) ?? PIP_SIZE };
}
