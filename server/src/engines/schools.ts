/**
 * Mô hình SMC / ICT / CRT đang hình thành (port ai_engine/schools.py).
 * Mỗi trường phái: {dir, title, state, steps, wait, todo, draw}
 *   state: forming ⚪ · ready 🟡 · active 🟢 · running 🟢 · done ✅ · fail ❌
 * Dựa trên CẤU TRÚC SÓNG (wave.ts).
 */
import type { Bar } from "../mt5/types.js";
import type { WaveResult } from "./wave.js";
import { pyFixed } from "./util.js";

const LOOK = 60; // số nến tìm quét thanh khoản trước phá vỡ
const LTF: Record<string, string> = {
  M1: "M1", M5: "M1", M15: "M5", M30: "M5/M15", H1: "M15", H4: "H1/M15", D1: "H1/M15", W1: "H4/D1", MN: "D1/W1",
};

type State = "forming" | "ready" | "active" | "running" | "done" | "fail";
interface Box { t1: number; top: number; bot: number; k: string; bull: boolean | null }
interface Level { t1: number; t2: number | null; y: number; lab: string; k: "sweep" | "brk" | "eq" }
export interface Model {
  dir: "bull" | "bear" | null; title: string; state: State;
  steps: { ok: boolean; text: string }[]; wait: string; todo: string;
  draw: { boxes: Box[]; levels: Level[] };
}

const f = (x: number) => pyFixed(x, 2);

function atrTail(bars: Bar[], n = 14): number {
  const trs: number[] = [];
  for (let i = Math.max(1, bars.length - n); i < bars.length; i++) {
    const { high: h, low: l } = bars[i];
    const pc = bars[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs.length ? trs.reduce((s, x) => s + x, 0) / trs.length : 0;
}

const idxMap = (bars: Bar[]) => new Map(bars.map((b, i) => [b.time, i]));
const lastOf = <T>(arr: T[], cond: (x: T) => boolean): T | null => { for (let i = arr.length - 1; i >= 0; i--) if (cond(arr[i])) return arr[i]; return null; };

function rr(price: number, sl: number, tp: number): number {
  const risk = Math.abs(price - sl);
  const rew = (tp - price) * (tp > sl ? 1 : -1);
  return risk > 0 ? rew / risk : 0;
}

/** FVG chưa lấp trong đoạn nến [a, b] theo hướng (gần nhất). */
function fvgIn(bars: Bar[], a: number, b: number, bull: boolean) {
  const n = bars.length;
  for (let i = Math.min(b, n - 1); i >= Math.max(a + 1, 2); i--) {
    const p = bars[i - 2];
    const c = bars[i];
    if (bull && p.high < c.low) {
      const lo = p.high, hi = c.low;
      let filled = false;
      for (let k = i + 1; k < n; k++) if (bars[k].low <= lo) { filled = true; break; }
      if (!filled) return { t1: p.time, top: hi, bot: lo, i };
    }
    if (!bull && p.low > c.high) {
      const lo = c.high, hi = p.low;
      let filled = false;
      for (let k = i + 1; k < n; k++) if (bars[k].high >= hi) { filled = true; break; }
      if (!filled) return { t1: p.time, top: hi, bot: lo, i };
    }
  }
  return null;
}

const base = (title: string): Model => ({ dir: null, title, state: "forming", steps: [], wait: "", todo: "", draw: { boxes: [], levels: [] } });

// ------------------------------------------------------------------ SMC
function smc(bars: Bar[], wv: WaveResult, price: number, tf: string): Model {
  const E = wv.E;
  const bull = E.trend === 1;
  const ix = idxMap(bars);
  const word = bull ? "TĂNG" : "GIẢM";
  const act = bull ? "MUA" : "BÁN";
  const out = base("SMC " + word);
  out.dir = bull ? "bull" : "bear";
  const ltf = LTF[tf] ?? "khung nhỏ";
  const brk = lastOf(E.lines, (l) => (l.k === "BOS" || l.k === "CHoCH") && l.up === bull);
  if (!brk) {
    out.steps.push({ ok: false, text: "Chưa có BOS/CHoCH " + word });
    out.wait = "Chờ sóng chính phá cấu trúc (đóng nến qua Weak/Strong)";
    out.todo = "Đứng ngoài — chưa có mô hình SMC";
    return out;
  }
  const bi = ix.get(brk.x2) ?? bars.length - 1;
  const sws = [...E.sweeps, ...wv.I.sweeps].sort((a, b) => a.x2 - b.x2);
  const sw = lastOf(sws, (s) => s.above !== bull && bi - LOOK <= (ix.get(s.x2) ?? 0) && (ix.get(s.x2) ?? 0) <= bi);
  out.steps.push({ ok: !!sw, text: sw ? `Quét ${bull ? "đáy " : "đỉnh "}${f(sw.y)}` : `Chưa thấy quét thanh khoản ${bull ? "đáy" : "đỉnh"} trước cú phá` });
  if (sw) out.draw.levels.push({ t1: sw.x1, t2: sw.x2, y: sw.y, lab: "Quét", k: "sweep" });
  out.steps.push({ ok: true, text: `${brk.k} ${bull ? "↑" : "↓"} ${f(brk.y)}` });
  out.draw.levels.push({ t1: brk.x1, t2: brk.x2, y: brk.y, lab: brk.k, k: "brk" });
  const si = (E.strongX != null ? ix.get(E.strongX) : undefined) ?? Math.max(0, bi - 20);
  let ob: { t1: number; top: number; bot: number; i: number } | null = null;
  for (let j = si; j >= Math.max(0, si - 6); j--) {
    const b = bars[j];
    if (bull ? b.close < b.open : b.close > b.open) { ob = { t1: b.time, top: b.high, bot: b.low, i: j }; break; }
  }
  if (ob) {
    for (let k = ob.i + 1; k < bars.length; k++) if (bull ? bars[k].close < ob.bot : bars[k].close > ob.top) { ob = null; break; }
  }
  const fvg = fvgIn(bars, si, bi, bull);
  const pois = [ob, fvg].filter((p): p is NonNullable<typeof p> => !!p);
  if (ob) out.draw.boxes.push({ t1: ob.t1, top: ob.top, bot: ob.bot, k: "OB", bull });
  if (fvg) out.draw.boxes.push({ t1: fvg.t1, top: fvg.top, bot: fvg.bot, k: "FVG", bull });
  const poiTxt = [...(ob ? [`OB ${f(ob.bot)}–${f(ob.top)}`] : []), ...(fvg ? [`FVG ${f(fvg.bot)}–${f(fvg.top)}`] : [])].join(" · ");
  out.steps.push({ ok: pois.length > 0, text: poiTxt || "Chưa có OB/FVG còn hiệu lực trong chân sóng" });
  const eq = E.pd ? E.pd.mid : null;
  if (E.pd) out.draw.levels.push({ t1: E.pd.x1, t2: null, y: E.pd.mid, lab: "EQ 50%", k: "eq" });
  const inZone = eq != null && (bull ? price <= eq : price >= eq);
  const strong = E.strong!;
  const tgt = E.weak!;
  if (!pois.length) {
    out.wait = "Chờ hình thành OB/FVG mới sau cú phá";
    out.todo = "Đứng ngoài — chờ POI mới";
    return out;
  }
  const at = pois.filter((p) => p.bot <= price && price <= p.top);
  const near = at[0] ?? pois.reduce((m, p) => (Math.abs(price - (bull ? p.top : p.bot)) < Math.abs(price - (bull ? m.top : m.bot)) ? p : m));
  const nm = near === ob ? "OB" : "FVG";
  const sl = bull ? near.bot : near.top;
  const zoneName = bull ? "Discount" : "Premium";
  out.steps.push({ ok: at.length > 0, text: at.length ? `Giá đang ở ${nm}${inZone ? " trong " + zoneName : ""}` : "Giá chưa hồi về POI" });
  const d = bull ? price - near.top : near.bot - price;
  const brokeStrong = bull ? price < strong : price > strong;
  const tren = bull ? "dưới" : "trên";
  if (brokeStrong) {
    out.state = "fail";
    out.wait = `Giá đã qua Strong ${bull ? "Low " : "High "}${f(strong)} — mô hình ${word} hỏng`;
    out.todo = `Không ${act} theo mô hình này. Chờ sóng chính CHoCH lại.`;
  } else if (at.length) {
    out.state = "active";
    out.wait = `Giá đang ở ${nm} ${f(near.bot)}–${f(near.top)}${inZone ? "" : ` (chưa vào ${zoneName})`}`;
    out.todo = `Xuống ${ltf} chờ CHoCH ${bull ? "tăng" : "giảm"} rồi ${act}. SL ${tren} ${f(sl)} (an toàn: ${tren} Strong ${f(strong)}). ` +
      `TP Weak ${bull ? "High" : "Low"} ${f(tgt)} (R:R ~1:${pyFixed(rr(price, sl, tgt), 1)})`;
  } else if (d > 0) {
    out.state = "ready";
    out.wait = `Chờ giá hồi ${bull ? "xuống" : "lên"} về ${nm} ${f(near.bot)}–${f(near.top)} (cách ${pyFixed(d, 1)} giá)`;
    const entry = bull ? near.top : near.bot;
    out.todo = `Đặt cảnh báo tại ${nm} ${f(entry)}. Giá về vùng → xuống ${ltf} chờ CHoCH ${bull ? "tăng" : "giảm"} rồi ${act}. ` +
      `SL ${tren} ${f(sl)}, TP Weak ${bull ? "High" : "Low"} ${f(tgt)} (R:R ~1:${pyFixed(rr(entry, sl, tgt), 1)})`;
  } else {
    out.state = "fail";
    out.wait = `Giá đã xuyên qua ${nm} — POI không giữ được`;
    out.todo = `Không ${act} tại POI này. Chờ POI kế tiếp hoặc giữ Strong ${f(strong)}.`;
  }
  return out;
}

// ------------------------------------------------------------------ ICT
function ict(bars: Bar[], wv: WaveResult, price: number, kzName: string, tf: string): Model {
  const { I, E } = wv;
  const ix = idxMap(bars);
  const a = atrTail(bars);
  const out = base("ICT");
  const ltf = LTF[tf] ?? "khung nhỏ";
  const inKz = !!kzName && kzName !== "Ngoài killzone";
  out.steps.push({ ok: inKz, text: inKz ? "Killzone: " + kzName : "Ngoài killzone" });
  const mss = lastOf(I.lines, (l) => l.k === "CHoCH");
  if (!mss) {
    out.steps.push({ ok: false, text: "Chưa có MSS (nội bộ đổi cấu trúc)" });
    out.wait = "Chờ quét thanh khoản + nội bộ đổi cấu trúc (MSS)";
    out.todo = "Đứng ngoài — chưa có mô hình ICT";
    return out;
  }
  const bull = mss.up;
  const act = bull ? "MUA" : "BÁN";
  out.dir = bull ? "bull" : "bear";
  out.title = "ICT " + (bull ? "TĂNG" : "GIẢM");
  const mi = ix.get(mss.x2) ?? bars.length - 1;
  const sws = [...E.sweeps, ...I.sweeps].sort((p, q) => p.x2 - q.x2);
  const sw = lastOf(sws, (s) => s.above !== bull && mi - LOOK <= (ix.get(s.x2) ?? 0) && (ix.get(s.x2) ?? 0) <= mi);
  out.steps.push({ ok: !!sw, text: sw ? `Quét ${bull ? "đáy " : "đỉnh "}${f(sw.y)}` : "Chưa quét thanh khoản trước MSS" });
  if (sw) out.draw.levels.push({ t1: sw.x1, t2: sw.x2, y: sw.y, lab: "Quét", k: "sweep" });
  const loI = Math.max(0, sw ? (ix.get(sw.x2) ?? mi - 20) : mi - 20);
  let extI = loI;
  for (let k = loI; k <= mi; k++) if (bull ? bars[k].low < bars[extI].low : bars[k].high > bars[extI].high) extI = k;
  let topI = extI;
  for (let k = extI; k < bars.length; k++) if (bull ? bars[k].high > bars[topI].high : bars[k].low < bars[topI].low) topI = k;
  const a0 = bull ? bars[extI].low : bars[extI].high;
  const a1 = bull ? bars[topI].high : bars[topI].low;
  let disp = false;
  if (a > 0) for (let k = extI; k <= Math.min(topI, bars.length - 1); k++) {
    const b = bars[k];
    if (Math.abs(b.close - b.open) > 1.5 * a && (b.close > b.open) === bull) { disp = true; break; }
  }
  out.steps.push({ ok: true, text: `MSS ${bull ? "↑" : "↓"} ${f(mss.y)}${disp ? " + displacement" : " (chưa có nến displacement mạnh)"}` });
  out.draw.levels.push({ t1: mss.x1, t2: mss.x2, y: mss.y, lab: "MSS", k: "brk" });
  const fvg = fvgIn(bars, extI, topI, bull);
  out.steps.push({ ok: !!fvg, text: fvg ? `FVG ${f(fvg.bot)}–${f(fvg.top)}` : "Chưa có FVG trong chân sóng" });
  if (fvg) out.draw.boxes.push({ t1: fvg.t1, top: fvg.top, bot: fvg.bot, k: "FVG", bull });
  const rng = a1 - a0;
  if (!rng) return out;
  const o62 = a1 - 0.62 * rng;
  const o79 = a1 - 0.79 * rng;
  const top = Math.max(o62, o79);
  const bot = Math.min(o62, o79);
  const tp2 = a1 + 0.27 * rng;                                   // mở rộng -27%
  out.draw.boxes.push({ t1: bars[topI].time, top, bot, k: "OTE", bull });
  const inside = bot <= price && price <= top;
  out.steps.push({ ok: inside, text: `OTE 62–79% ${f(bot)}–${f(top)}` });
  const d = bull ? price - top : bot - price;
  const lost = bull ? price < a0 : price > a0;
  const kzNote = inKz ? "" : " — tốt nhất trong killzone London (14–17h) / NY (19h30–22h30)";
  const tren = bull ? "dưới" : "trên";
  if (lost) {
    out.state = "fail";
    out.wait = `Giá đã qua gốc chân sóng ${f(a0)} — mô hình hỏng`;
    out.todo = `Không ${act}. Chờ MSS mới.`;
  } else if (inside) {
    out.state = "active";
    out.wait = `Giá đang trong OTE ${f(bot)}–${f(top)}`;
    out.todo = `Xuống ${ltf} chờ nến xác nhận rồi ${act}. SL ${tren} ${f(a0)} (gốc chân sóng). TP1 ${f(a1)}, TP2 ${f(tp2)} (R:R TP1 ~1:${pyFixed(rr(price, a0, a1), 1)})${kzNote}`;
  } else if (d > 0) {
    out.state = "ready";
    out.wait = `Chờ giá hồi về OTE ${f(bot)}–${f(top)} (cách ${pyFixed(d, 1)} giá)`;
    const entry = bull ? top : bot;
    out.todo = `Đặt lệnh chờ/cảnh báo tại OTE ${f(entry)}. SL ${tren} ${f(a0)}, TP1 ${f(a1)}, TP2 ${f(tp2)} (R:R TP1 ~1:${pyFixed(rr(entry, a0, a1), 1)})${kzNote}`;
  } else {
    out.state = "running";
    out.wait = `Giá đã qua OTE, chưa mất gốc ${f(a0)} — hồi sâu`;
    out.todo = `Đang có lệnh: giữ SL ${tren} ${f(a0)}. Chưa có: không vào thêm, chờ MSS mới.`;
  }
  return out;
}

// ------------------------------------------------------------------ CRT
function crt(bars: Bar[], tf: string): Model {
  const out = base("CRT");
  if (bars.length < 3) return out;
  const ltf = LTF[tf] ?? "khung nhỏ";
  const [c1, c2, c3] = bars.slice(-3);                          // c3 = nến đang chạy
  const price = c3.close;
  const eq = (c1.high + c1.low) / 2;
  out.steps.push({ ok: true, text: `Nến 1 range ${f(c1.low)}–${f(c1.high)} (EQ ${f(eq)})` });
  out.draw.boxes.push({ t1: c1.time, top: c1.high, bot: c1.low, k: "CRT", bull: null });
  out.draw.levels.push({ t1: c1.time, t2: null, y: eq, lab: "EQ", k: "eq" });
  const up = c2.high > c1.high && c2.close < c1.high;
  const dn = c2.low < c1.low && c2.close > c1.low;
  if (!(up || dn)) {
    const swh = c3.high > c2.high;
    const swl = c3.low < c2.low;
    out.steps.push({ ok: false, text: "Nến 2 chưa quét biên nến 1" });
    out.wait = swh || swl
      ? `Nến đang chạy vừa quét ${swh ? "đỉnh" : "đáy"} nến trước — chờ đóng nến lại vào trong range ${f(c2.low)}–${f(c2.high)}`
      : `Chờ 1 nến quét 1 biên range ${f(c2.low)}–${f(c2.high)} rồi đóng vào trong`;
    out.todo = swh || swl
      ? `Nếu nến này ĐÓNG lại trong range → CRT ${swh ? "GIẢM" : "TĂNG"} hình thành ở nến sau. Chưa vào vội.`
      : "Đứng ngoài — chưa có mô hình CRT";
    return out;
  }
  const bull = dn;
  const act = bull ? "MUA" : "BÁN";
  out.dir = bull ? "bull" : "bear";
  out.title = "CRT " + (bull ? "TĂNG" : "GIẢM");
  const swLvl = bull ? c2.low : c2.high;                         // râu cú quét = SL
  out.steps.push({ ok: true, text: `Nến 2 quét ${bull ? "đáy" : "đỉnh"} ${f(bull ? c1.low : c1.high)} rồi đóng vào trong (râu ${f(swLvl)})` });
  out.draw.levels.push({ t1: c2.time, t2: c2.time, y: swLvl, lab: "Quét", k: "sweep" });
  const tgt1 = eq;
  const tgt2 = bull ? c1.high : c1.low;
  const hit1 = bull ? c3.high >= tgt1 : c3.low <= tgt1;
  const hit2 = bull ? c3.high >= tgt2 : c3.low <= tgt2;
  const lost = bull ? price < swLvl : price > swLvl;
  out.steps.push({ ok: hit1, text: `Nến 3 về EQ ${f(tgt1)}` });
  out.steps.push({ ok: hit2, text: `Nến 3 về biên ${bull ? "trên" : "dưới"} ${f(tgt2)}` });
  const tren = bull ? "dưới" : "trên";
  if (hit2) {
    out.state = "done";
    out.wait = `Nến 3 đã chạm biên ${bull ? "trên" : "dưới"} ${f(tgt2)} — mô hình chạy xong`;
    out.todo = `Đang có lệnh: CHỐT LỜI. Không vào mới theo mô hình này. Chờ CRT mới — ${bull ? "đỉnh" : "đáy"} ${f(tgt2)} vừa chạm dễ bị quét tạo CRT ${bull ? "GIẢM" : "TĂNG"}.`;
  } else if (lost) {
    out.state = "fail";
    out.wait = `Giá đã qua râu nến 2 ${f(swLvl)} — cú quét thất bại`;
    out.todo = `Không ${act}. Nếu nến đóng ${tren} ${f(swLvl)} → mô hình hỏng hẳn, chờ CRT mới.`;
  } else if (hit1) {
    out.state = "running";
    out.wait = `Đã tới EQ ${f(tgt1)} — đang chạy tiếp về ${f(tgt2)}`;
    out.todo = `Đang có lệnh: chốt 1 phần tại EQ, dời SL về hòa vốn, giữ tới ${f(tgt2)}. Chưa có lệnh: không đuổi, chỉ vào khi hồi về dưới EQ + xác nhận ${ltf}.`;
  } else {
    out.state = "ready";
    out.wait = `Đã hình thành — chờ nến 3 phân phối ${bull ? "lên" : "xuống"} về EQ ${f(tgt1)}`;
    out.todo = `Canh ${act} ở ${ltf} khi có CHoCH ${bull ? "tăng" : "giảm"}, ưu tiên vùng ${tren} EQ. SL ${tren} ${f(swLvl)} (râu nến 2). ` +
      `TP1 ${f(tgt1)}, TP2 ${f(tgt2)}. Giá hiện tại: R:R TP1 ~1:${pyFixed(rr(price, swLvl, tgt1), 1)}, TP2 ~1:${pyFixed(rr(price, swLvl, tgt2), 1)}`;
    if (rr(price, swLvl, tgt2) < 1.5)
      out.todo += ` → R:R đang THẤP: đừng vào ở giá này, chờ giá hồi về gần râu nến 2 rồi mới canh ${act}.`;
  }
  return out;
}

export function analyze(bars: Bar[], wv: WaveResult | null, price: number, kzName: string, tf = "") {
  if (!wv || bars.length < 30) return null;
  return { smc: smc(bars, wv, price, tf), ict: ict(bars, wv, price, kzName, tf), crt: crt(bars, tf) };
}
