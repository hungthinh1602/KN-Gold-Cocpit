/**
 * Quét phân tích từng khung + tự viết bài nhận định / tóm tắt vĩ mô (port ai_engine/scan.py).
 * Không gọi AI — câu chữ ghép theo luật từ số liệu.
 */
import type { Bar, Timeframe } from "../mt5/types.js";
import { detect as detectFormation } from "./classic.js";
import { killzone } from "./ict.js";
import { crtRead, ictRead, smcRead, type Setup } from "./lenses.js";
import { analyze as analyzeStructure, type Trend } from "./structure.js";
import { atr, signed, pyFixed } from "./util.js";

export const ANALYZE_TFS: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];
/** [số nến, strength fractal, min_amp giá lọc nhiễu] cho cấu trúc fractal. */
export const CFG: Record<Timeframe, [number, number, number]> = {
  M1: [500, 2, 1.5], M5: [500, 2, 3.0], M15: [500, 2, 4.0], M30: [500, 2, 5.0], H1: [500, 2, 6.0],
  H4: [400, 2, 10.0], D1: [300, 2, 15.0], W1: [300, 2, 30.0], MN: [200, 2, 60.0],
};

const TREND_VN: Record<string, string> = { TANG: "TĂNG", GIAM: "GIẢM", SIDEWAY: "ĐI NGANG", "KHONG RO": "CHƯA RÕ", "THIEU DL": "THIẾU DỮ LIỆU" };
const EVENT_VN: Record<string, string> = {
  "PHA VO DINH gan nhat (BOS len)": "vừa phá đỉnh gần nhất (BOS lên)",
  "PHA VO DAY gan nhat (BOS xuong)": "vừa phá đáy gần nhất (BOS xuống)",
  "Trong bien do": "đang trong biên độ",
};
const TSIGN: Record<string, number> = { TANG: 1, GIAM: -1 };
const TF_W: [Timeframe, number][] = [["D1", 1.0], ["H4", 2.0], ["H1", 1.5], ["M15", 0.5]];

export type TfData = ReturnType<typeof buildTf>;

function buildTf(bars: Bar[], tf: Timeframe, price: number, hourVn: number) {
  const [, strength, minAmp] = CFG[tf];
  const r = analyzeStructure(bars, strength, minAmp);
  const rawSw = r.swings;
  const swMap = rawSw.map((s) => ({ t: s.type, p: s.price, time: s.time }));
  return {
    structure: {
      trend: r.trend, pattern: r.pattern, event: r.event, support: r.support ?? null, resistance: r.resistance ?? null,
      swings: swMap.slice(-10), formation: detectFormation(swMap, bars[bars.length - 1].close, atr(bars)),
    },
    smc: smcRead(bars, rawSw, r.trend, r.event, r.support, r.resistance, price),
    ict: ictRead(bars, rawSw, price, hourVn),
    crt: crtRead(bars),
    candles: bars.map((b) => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close })),
  };
}

/** Quét tất cả khung có ≥ 10 nến. `updated` = chuỗi giờ VN "YYYY-MM-DD HH:MM:SS (VN)". */
export function build(barsByTf: Partial<Record<Timeframe, Bar[]>>, price: number, hourVn: number, updated: string, symbol: string) {
  const tfData: Partial<Record<Timeframe, TfData>> = {};
  for (const tf of ANALYZE_TFS) {
    const bars = barsByTf[tf] ?? [];
    if (bars.length >= 10) tfData[tf] = buildTf(bars, tf, price, hourVn);
  }
  const kz = killzone(hourVn);
  return {
    updated, symbol, price,
    killzone: kz ? kz.name.replace("Killzone: ", "") : "Ngoài killzone",
    timeframes: ANALYZE_TFS.filter((tf) => tf in tfData),
    tf_data: tfData,
  };
}

// ------------------------------------------------------------------ bài nhận định tự động
const fx = (x: unknown) => (typeof x === "number" ? pyFixed(x, 2) : "—");
const trendOf = (td: Partial<Record<Timeframe, TfData>>, tf: Timeframe) => td[tf]?.structure.trend as Trend | undefined;

function bias(td: Partial<Record<Timeframe, TfData>>): ["bull" | "bear" | "neutral", number] {
  const s = TF_W.reduce((acc, [tf, w]) => acc + (td[tf] ? (TSIGN[td[tf]!.structure.trend] ?? 0) * w : 0), 0);
  return [s >= 2 ? "bull" : s <= -2 ? "bear" : "neutral", s];
}

function pickSetup(td: Partial<Record<Timeframe, TfData>>, b: string): [Timeframe, string, Setup] | null {
  const order: [Timeframe, "smc" | "ict"][] = [["H1", "smc"], ["H4", "smc"], ["H1", "ict"], ["H4", "ict"], ["M15", "smc"], ["M15", "ict"]];
  for (const [tf, lens] of order) {
    const s = td[tf]?.[lens]?.setup;
    if (s && s.dir === b && s.entry_low != null) return [tf, lens, s];
  }
  return null;
}

export function autoText(data: { tf_data: Partial<Record<Timeframe, TfData>>; price: number }): string {
  const td = data.tf_data;
  if (!Object.keys(td).length) return "Chưa đủ dữ liệu nến để phân tích.";
  const price = data.price || 0;
  const L: string[] = ["① XU HƯỚNG ĐA KHUNG"];
  for (const tf of ["D1", "H4", "H1", "M15"] as Timeframe[]) {
    const s = td[tf]?.structure;
    if (!s) continue;
    L.push(`  • ${tf.padEnd(3)}: ${TREND_VN[s.trend] ?? s.trend}${s.pattern ? ` (${s.pattern})` : ""} · ` +
      `${EVENT_VN[s.event ?? ""] ?? s.event ?? ""} · HT ${fx(s.support)} / KC ${fx(s.resistance)}`);
  }
  const [b, score] = bias(td);
  L.push("", "② NHẬN ĐỊNH");
  if (b === "neutral") {
    L.push(`  Các khung chưa đồng thuận (điểm ${signed(score)}) → thị trường giằng co, ưu tiên ĐỨNG NGOÀI hoặc đánh biên độ nhỏ, chờ H4 xác nhận hướng.`);
  } else {
    const word = b === "bull" ? "TĂNG" : "GIẢM";
    const dirSign = b === "bull" ? 1 : -1;
    L.push(`  Thiên hướng chung nghiêng ${word} (điểm ${signed(score)}) → ưu tiên ${b === "bull" ? "MUA" : "BÁN"} theo xu hướng.`);
    const h1 = trendOf(td, "H1");
    const m15 = trendOf(td, "M15");
    if (h1 && (TSIGN[h1] ?? 0) * dirSign < 0)
      L.push(`  H1 đang đi NGƯỢC khung lớn (nhịp hồi) → chờ H1/M15 đổi cấu trúc (CHoCH) quay lại theo hướng ${word} rồi mới vào.`);
    else if (m15 && (TSIGN[m15] ?? 0) * dirSign < 0)
      L.push(`  M15 đang điều chỉnh → canh điểm vào khi M15 phá cấu trúc theo hướng ${word}.`);
  }
  L.push("", "③ KỊCH BẢN CHÍNH");
  const pick = b !== "neutral" ? pickSetup(td, b) : null;
  if (pick) {
    const [tf, lens, s] = pick;
    let rr = "";
    if (s.entry_low != null && s.entry_high != null && typeof s.sl === "number" && typeof s.tp1 === "number") {
      const mid = (s.entry_low + s.entry_high) / 2;
      const risk = Math.abs(mid - s.sl);
      if (risk > 0) rr = ` · R:R ≈ 1:${pyFixed((Math.abs(s.tp1 - mid) / risk), 1)}`;
    }
    L.push(`  Theo ${lens.toUpperCase()} ${tf}: ${s.dir === "bull" ? "MUA" : "BÁN"} vùng ${fx(s.entry_low)}–${fx(s.entry_high)} · SL ${fx(s.sl)} · TP ${fx(s.tp1)}${rr}`);
    if (price && s.entry_low != null && s.entry_high != null) {
      const inside = s.entry_low <= price && price <= s.entry_high;
      const dist = Math.min(Math.abs(price - s.entry_low), Math.abs(price - s.entry_high));
      L.push(`  Giá ${fx(price)} ${inside ? "ĐANG trong vùng vào" : `cách vùng vào ~${pyFixed(dist, 1)} giá`}.`);
    }
  } else if (b === "neutral") {
    L.push("  Chưa có kịch bản theo xu hướng — chờ BOS/CHoCH trên H1/H4.");
  } else {
    L.push("  Chưa có POI/OTE cùng hướng gần giá — chờ giá hồi về vùng có cấu trúc.");
  }
  L.push("", "④ XÁC NHẬN / HỦY");
  const h4 = (td.H4 ?? td.H1)?.structure;
  const tfn = td.H4 ? "H4" : "H1";
  if (b === "bull") {
    L.push(`  Hủy nhận định tăng nếu nến ${tfn} đóng DƯỚI hỗ trợ ${fx(h4?.support)}.`, `  Xác nhận mạnh khi phá kháng cự ${fx(h4?.resistance)}.`);
  } else if (b === "bear") {
    L.push(`  Hủy nhận định giảm nếu nến ${tfn} đóng TRÊN kháng cự ${fx(h4?.resistance)}.`, `  Xác nhận mạnh khi phá hỗ trợ ${fx(h4?.support)}.`);
  } else {
    L.push(`  Phá lên ${fx(h4?.resistance)} → nghiêng tăng · phá xuống ${fx(h4?.support)} → nghiêng giảm (${tfn}).`);
  }
  const fms: string[] = [];
  for (const tf of ["D1", "H4", "H1", "M15"] as Timeframe[]) {
    const fm = td[tf]?.structure.formation;
    if (fm && fm.completion >= 60) fms.push(`  • ${tf}: ${fm.name} (${fm.completion}%)${fm.confirm ? ` · xác nhận ${fx(fm.confirm)}` : ""}`);
  }
  if (fms.length) L.push("", "⑤ MÔ HÌNH GIÁ ĐÁNG CHÚ Ý", ...fms);
  L.push("", "Phân tích tham khảo, không phải lời khuyên đầu tư.");
  return L.join("\n");
}

interface MacroLike {
  drivers: Record<string, { name: string; value: number | null; dir: string; rise: number; pct: number | null }>;
  score: number;
  calendar: { ts: number; impact: string; wd: string; day: string; time: string; title: string }[];
}

/** Tóm tắt vĩ mô từ state tab VĨ MÔ (drivers, score, calendar). */
export function autoMacro(state: MacroLike, nowTs: number): string {
  const drivers = state?.drivers ?? {};
  if (!Object.keys(drivers).length) return "Chưa có dữ liệu vĩ mô.";
  const sc = state.score || 0;
  const v = sc >= 3 ? "nghiêng TĂNG mạnh" : sc >= 1 ? "nghiêng Tăng" : sc > -1 ? "trung lập · giằng co" : sc > -3 ? "nghiêng Giảm" : "nghiêng GIẢM mạnh";
  const L = [`Điểm vĩ mô ${signed(sc)} → vàng ${v}.`];
  const helps: string[] = [];
  const hurts: string[] = [];
  for (const id of ["us10y", "dxy", "real", "spx", "vix"]) {
    const d = drivers[id];
    if (!d || d.value == null || d.dir === "flat") continue;
    const up = d.dir === "up";
    const txt = `${d.name} ${up ? "tăng" : "giảm"} (${signed(d.pct ?? 0, 2)}%)`;
    ((up ? 1 : -1) * (d.rise ?? 0) > 0 ? helps : hurts).push(txt);
  }
  if (hurts.length) L.push("• Bất lợi cho vàng: " + hurts.join(", ") + ".");
  if (helps.length) L.push("• Hỗ trợ vàng: " + helps.join(", ") + ".");
  const ev = (state.calendar ?? []).filter((e) => ["High", "Medium"].includes(e.impact) && (e.ts ?? 0) - nowTs >= 0 && (e.ts ?? 0) - nowTs <= 36 * 3600);
  if (ev.length) {
    L.push("• Tin sắp ra (36 giờ tới):");
    for (const e of ev.slice(0, 6)) L.push(`   – ${e.wd ?? ""} ${e.day ?? ""} ${e.time ?? ""} · ${e.title ?? ""}${e.impact === "High" ? " 🔴" : ""}`);
    L.push("  → Hạn chế vào lệnh mới sát giờ tin mạnh.");
  }
  return L.join("\n");
}
