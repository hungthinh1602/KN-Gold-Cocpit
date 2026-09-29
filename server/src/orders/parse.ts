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
