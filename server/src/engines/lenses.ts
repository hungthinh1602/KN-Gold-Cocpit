/**
 * Playbook từng trường phái cho 1 khung — nhận định + setup (port patterns/lenses.py).
 * Dùng cho mục SMC/ICT/CRT chi tiết bên dưới biểu đồ.
 */
import type { Bar } from "../mt5/types.js";
import { crt } from "./crt.js";
import { displacement, killzone, ote } from "./ict.js";
import { fvgs, liquidity, orderBlocks, premiumDiscount } from "./smc.js";
import type { Swing, Trend } from "./structure.js";
import { atr, round, type Dir, type Finding, pyFixed } from "./util.js";

export interface Setup {
  dir: Dir;
  style: string;
  entry_low?: number;
  entry_high?: number;
  sl?: number;
  tp1?: number | null;
}

const f = (x: number) => pyFixed(x, 2);

/** POI = OB/FVG cùng hướng, gần giá, đúng phía. */
function poiOf(signals: Finding[], bdir: Dir, price: number): Finding | null {
  const mid = (p: Finding) => ((p.low ?? 0) + (p.high ?? 0)) / 2;
  let c: Finding[] = [];
  if (bdir === "bull") {
    c = signals.filter((p) => p.dir === "bull" && (p.kind === "OB" || p.kind === "FVG") && p.low != null && mid(p) <= price);
    c.sort((a, b) => (price - mid(a)) - (price - mid(b)));
  } else if (bdir === "bear") {
    c = signals.filter((p) => p.dir === "bear" && (p.kind === "OB" || p.kind === "FVG") && p.high != null && mid(p) >= price);
    c.sort((a, b) => (mid(a) - price) - (mid(b) - price));
  } else return null;
  return c[0] ?? null;
}

export function smcRead(bars: Bar[], swings: Swing[], trend: Trend, event: string | undefined,
  support: number | null | undefined, resistance: number | null | undefined, price: number) {
  const a = atr(bars);
  const buf = a > 0 ? a * 0.5 : price * 0.001;
  const bdir: Dir = trend === "TANG" ? "bull" : trend === "GIAM" ? "bear" : "neutral";
  const pd = premiumDiscount(bars, swings);
  const signals = [...orderBlocks(bars), ...fvgs(bars), ...liquidity(bars, swings), ...pd];
  const pdinfo = pd[0] ?? null;
  const poi = poiOf(signals, bdir, price);
  let setup: Setup | null = null;
  let note: string;
  const range = (p: Finding) => `${f(p.low!)}–${f(p.high!)}`;
  if (bdir === "bull") {
    setup = { dir: "bull", style: "Mua tại POI (vùng Discount) theo cấu trúc" };
    let base: number | null = null;
    if (poi) { setup.entry_low = poi.low!; setup.entry_high = poi.high!; base = poi.low; }
    else if (support != null) { setup.entry_low = support; setup.entry_high = support + buf; base = support; }
    if (base != null) setup.sl = round(base - buf, 2);
    setup.tp1 = resistance ?? null;
    note = `Cấu trúc TĂNG (${event ?? ""}). ${pdinfo ? `Giá ở ${pdinfo.name}. ` : ""}Chờ MUA tại ${poi ? poi.name + " " : "hỗ trợ "}` +
      `${poi ? range(poi) : support != null ? f(support) : ""} rồi hướng target kháng cự ${resistance != null ? f(resistance) : "kế tiếp"} / thanh khoản trên.`;
  } else if (bdir === "bear") {
    setup = { dir: "bear", style: "Bán tại POI (vùng Premium) theo cấu trúc" };
    let base: number | null = null;
    if (poi) { setup.entry_low = poi.low!; setup.entry_high = poi.high!; base = poi.high; }
    else if (resistance != null) { setup.entry_low = resistance - buf; setup.entry_high = resistance; base = resistance; }
    if (base != null) setup.sl = round(base + buf, 2);
    setup.tp1 = support ?? null;
    note = `Cấu trúc GIẢM (${event ?? ""}). ${pdinfo ? `Giá ở ${pdinfo.name}. ` : ""}Chờ BÁN tại ${poi ? poi.name + " " : "kháng cự "}` +
      `${poi ? range(poi) : resistance != null ? f(resistance) : ""} rồi hướng target hỗ trợ ${support != null ? f(support) : "kế tiếp"} / thanh khoản dưới.`;
  } else {
    note = "Cấu trúc đi ngang — chờ BOS/CHoCH xác nhận hướng trước khi tìm POI vào lệnh.";
  }
  return { bias: bdir, pd: pdinfo, poi, signals, setup, note };
}

export function ictRead(bars: Bar[], swings: Swing[], price: number, hourVn: number) {
  const a = atr(bars);
  const kz = killzone(hourVn);
  const disp = displacement(bars);
  const oteL = ote(bars, swings);
  const sweeps = liquidity(bars, swings).filter((p) => p.kind === "SWEEP");
  const signals = [...(kz ? [kz] : []), ...sweeps, ...disp, ...oteL];
  const o = oteL[0] ?? null;
  const kzname = kz ? kz.name.replace("Killzone: ", "") : "Ngoài killzone";
  let setup: Setup | null = null;
  let note: string;
  if (o) {
    const d = o.dir;
    setup = { dir: d, style: "Vào lệnh OTE 62–79%", entry_low: o.low!, entry_high: o.high! };
    if (swings.length >= 2) {
      const p1 = swings[swings.length - 2].price;
      const p2 = swings[swings.length - 1].price;
      const lo = Math.min(p1, p2);
      const hi = Math.max(p1, p2);
      if (d === "bull") { setup.sl = round(lo - a * 0.5, 2); setup.tp1 = hi; }
      else { setup.sl = round(hi + a * 0.5, 2); setup.tp1 = lo; }
    }
    note = `Phiên: ${kzname}. ${sweeps.length ? "Đã có quét thanh khoản. " : ""}` +
      `${disp.length ? `Có displacement ${disp[0].dir === "bull" ? "tăng" : "giảm"}. ` : ""}` +
      `Vùng OTE (${f(o.low!)}–${f(o.high!)}) để ${d === "bull" ? "MUA" : "BÁN"}.`;
  } else {
    note = `Phiên: ${kzname}. Chưa có nhịp xung lực rõ để tính OTE — chờ quét thanh khoản + displacement.`;
  }
  return { killzone: kzname, sweep: sweeps[0] ?? null, displacement: disp[0] ?? null, ote: o, signals, setup, note };
}

export function crtRead(bars: Bar[]) {
  if (bars.length < 3) return { phase: "Thiếu dữ liệu", setup: null, note: "Chưa đủ nến.", signals: [] as Finding[] };
  const a = atr(bars);
  const c1 = bars[bars.length - 3];
  const c2 = bars[bars.length - 2];
  const eq = (c1.high + c1.low) / 2;
  const res = crt(bars);
  const base = { c1_high: round(c1.high, 2), c1_low: round(c1.low, 2), eq: round(eq, 2), signals: res };
  if (res.length) {
    const d = res[0].dir;
    let setup: Setup;
    let note: string;
    if (d === "bear") {
      setup = { dir: d, style: "CRT: vào sau nến quét (C2), target biên range", entry_low: eq, entry_high: c1.high,
        sl: round(c2.high + a * 0.3, 2), tp1: c1.low };
      note = `Nến 2 QUÉT ĐỈNH range (C1 ${f(c1.low)}–${f(c1.high)}) rồi đóng vào trong → kỳ vọng phân phối XUỐNG về ${f(c1.low)} (hoặc EQ ${f(eq)}).`;
    } else {
      setup = { dir: d, style: "CRT: vào sau nến quét (C2), target biên range", entry_low: c1.low, entry_high: eq,
        sl: round(c2.low - a * 0.3, 2), tp1: c1.high };
      note = `Nến 2 QUÉT ĐÁY range (C1 ${f(c1.low)}–${f(c1.high)}) rồi đóng vào trong → kỳ vọng phân phối LÊN về ${f(c1.high)} (hoặc EQ ${f(eq)}).`;
    }
    return { ...base, phase: "Đã có tín hiệu", setup, note };
  }
  return { ...base, phase: "Chờ", setup: null,
    note: `Chưa có tín hiệu CRT. Range nến trước: ${f(c1.low)}–${f(c1.high)}, EQ ${f(eq)}. Chờ 1 nến quét 1 biên rồi đóng vào trong.` };
}
