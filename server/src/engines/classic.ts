/**
 * Mô hình giá cổ điển từ chuỗi swing (port patterns/classic.py):
 * Hai đỉnh/đáy, Vai-Đầu-Vai (thuận/ngược), Tam giác (cân/tăng/giảm), Nêm, Chữ nhật.
 * Trả mô hình đang hình thành RÕ NHẤT (ưu tiên + % hoàn thành).
 */

export interface SwingPt {
  t: "H" | "L";
  p: number;
  time: number;
}

export interface Formation {
  name: string;
  dir: "bull" | "bear" | "neutral";
  completion: number;
  confirm: number | null;
  invalidate: number | null;
  up_break?: number;
  down_break?: number;
  note: string;
  lines: { pts: [number, number][]; color: string; label: string }[];
  pri: number;
}

/** round() của Python 3 (làm tròn .5 về số chẵn) — để % hoàn thành khớp bản Python. */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** % tiến tới mức xác nhận. Đã phá → 100. */
function comp(extreme: number, confirm: number, close: number): number {
  const rng = Math.abs(extreme - confirm);
  if (rng <= 0) return 50;
  const done = (Math.abs(extreme - close) / rng) * 100;
  const broken = (confirm < extreme && close <= confirm) || (confirm > extreme && close >= confirm);
  if (broken) return 100;
  return Math.trunc(Math.max(5, Math.min(95, pyRound(done))));
}

export function detect(swings: SwingPt[], close: number, atr: number): Formation | null {
  const sw = swings.filter((s) => s.time != null);
  if (sw.length < 3) return null;
  const tol = Math.max(0.4 * atr, close * 0.0006);
  const out: Formation[] = [];
  const n = sw.length;
  const last = sw[n - 1];
  const types = sw.map((x) => x.t).join("");

  if (types.endsWith("HLH")) {                                   // HAI ĐỈNH
    const [h1, neck, h2] = sw.slice(-3);
    if (Math.abs(h1.p - h2.p) <= tol) {
      const ex = Math.max(h1.p, h2.p);
      out.push({ name: "Hai đỉnh (Double Top)", dir: "bear", completion: comp(ex, neck.p, close),
        confirm: neck.p, invalidate: ex + tol, note: "Hai đỉnh ngang nhau — phá neckline dưới là xác nhận GIẢM.",
        lines: [{ pts: [[neck.time, neck.p], [last.time, neck.p]], color: "#a855f7", label: "Neckline" }], pri: 8 });
    }
  }
  if (types.endsWith("LHL")) {                                   // HAI ĐÁY
    const [l1, neck, l2] = sw.slice(-3);
    if (Math.abs(l1.p - l2.p) <= tol) {
      const ex = Math.min(l1.p, l2.p);
      out.push({ name: "Hai đáy (Double Bottom)", dir: "bull", completion: comp(ex, neck.p, close),
        confirm: neck.p, invalidate: ex - tol, note: "Hai đáy ngang nhau — phá neckline trên là xác nhận TĂNG.",
        lines: [{ pts: [[neck.time, neck.p], [l2.time, neck.p]], color: "#a855f7", label: "Neckline" }], pri: 8 });
    }
  }
  if (n >= 5 && types.endsWith("HLHLH")) {                       // VAI-ĐẦU-VAI
    const [h1, l1, h2, l2, h3] = sw.slice(-5);
    if (h2.p > h1.p && h2.p > h3.p && Math.abs(h1.p - h3.p) <= tol * 1.6) {
      const neck = Math.min(l1.p, l2.p);
      out.push({ name: "Vai-Đầu-Vai (H&S)", dir: "bear", completion: comp(h2.p, neck, close),
        confirm: neck, invalidate: h2.p + tol, note: "Đầu cao giữa 2 vai — phá neckline là xác nhận GIẢM mạnh.",
        lines: [{ pts: [[l1.time, neck], [last.time, neck]], color: "#a855f7", label: "Neckline" }], pri: 10 });
    }
  }
  if (n >= 5 && types.endsWith("LHLHL")) {                       // VAI-ĐẦU-VAI NGƯỢC
    const [l1, h1, l2, h2, l3] = sw.slice(-5);
    if (l2.p < l1.p && l2.p < l3.p && Math.abs(l1.p - l3.p) <= tol * 1.6) {
      const neck = Math.max(h1.p, h2.p);
      out.push({ name: "Vai-Đầu-Vai ngược (iH&S)", dir: "bull", completion: comp(l2.p, neck, close),
        confirm: neck, invalidate: l2.p - tol, note: "Đáy sâu giữa 2 vai — phá neckline là xác nhận TĂNG mạnh.",
        lines: [{ pts: [[h1.time, neck], [last.time, neck]], color: "#a855f7", label: "Neckline" }], pri: 10 });
    }
  }

  // TAM GIÁC / NÊM / CHỮ NHẬT từ 2 đỉnh + 2 đáy gần nhất
  const highs = sw.filter((s) => s.t === "H").slice(-2);
  const lows = sw.filter((s) => s.t === "L").slice(-2);
  if (highs.length === 2 && lows.length === 2) {
    const [hp, hl] = [highs[0].p, highs[1].p];
    const [lp, ll] = [lows[0].p, lows[1].p];
    const hiEq = Math.abs(hl - hp) <= tol;
    const loEq = Math.abs(ll - lp) <= tol;
    const hiDn = hl < hp - tol * 0.2;
    const hiUp = hl > hp + tol * 0.2;
    const loUp = ll > lp + tol * 0.2;
    const loDn = ll < lp - tol * 0.2;
    const rngNow = hl - ll;
    const rngPrev = hp - lp;
    const conv = rngPrev > 0 && rngNow < rngPrev;
    const cc = rngPrev > 0 ? Math.trunc(Math.max(20, Math.min(90, pyRound((1 - rngNow / rngPrev) * 100)))) : 50;
    const edges = (color: string) => [
      { pts: [[highs[0].time, hp], [highs[1].time, hl]] as [number, number][], color, label: "Cạnh trên" },
      { pts: [[lows[0].time, lp], [lows[1].time, ll]] as [number, number][], color, label: "Cạnh dưới" },
    ];
    if (hiDn && loUp) out.push({ name: "Tam giác cân", dir: "neutral", completion: cc, confirm: null, invalidate: null,
      up_break: hl, down_break: ll, note: "Nén dần — phá cạnh nào đi theo hướng đó.", lines: edges("#38bdf8"), pri: 6 });
    else if (hiEq && loUp) out.push({ name: "Tam giác tăng", dir: "bull", completion: cc, confirm: Math.max(hp, hl),
      invalidate: ll - tol, note: "Đỉnh phẳng, đáy nâng dần — nghiêng phá LÊN.", lines: edges("#16a34a"), pri: 7 });
    else if (loEq && hiDn) out.push({ name: "Tam giác giảm", dir: "bear", completion: cc, confirm: Math.min(lp, ll),
      invalidate: hl + tol, note: "Đáy phẳng, đỉnh hạ dần — nghiêng phá XUỐNG.", lines: edges("#dc2626"), pri: 7 });
    else if (hiUp && loUp && conv) out.push({ name: "Nêm tăng (đảo giảm)", dir: "bear", completion: cc, confirm: ll,
      invalidate: hl + tol, note: "Cùng dốc lên nhưng hẹp dần — dễ đảo XUỐNG.", lines: edges("#f59e0b"), pri: 6 });
    else if (hiDn && loDn && conv) out.push({ name: "Nêm giảm (đảo tăng)", dir: "bull", completion: cc, confirm: hl,
      invalidate: ll - tol, note: "Cùng dốc xuống nhưng hẹp dần — dễ đảo LÊN.", lines: edges("#f59e0b"), pri: 6 });
    else if (hiEq && loEq) out.push({ name: "Chữ nhật (Range)", dir: "neutral", completion: 50, confirm: null, invalidate: null,
      up_break: Math.max(hp, hl), down_break: Math.min(lp, ll), note: "Đi ngang giữa 2 biên — chờ phá biên.", lines: edges("#9ca3af"), pri: 4 });
  }
  if (!out.length) return null;
  // Python sort ổn định theo (pri, completion) giảm dần → lấy phần tử đầu
  return [...out].sort((a, b) => b.pri - a.pri || b.completion - a.completion)[0];
}
