/**
 * CẤU TRÚC SÓNG (break-based) theo chỉ báo "CẤU TRÚC SÓNG" của anh — port ai_engine/wave.py.
 * - Đỉnh/đáy theo RÂU nến, phá vỡ phải ĐÓNG NẾN.
 * - Nhịp hồi hợp lệ = "Đáy/đỉnh hình thành": sau mốc Weak đã có 1 đáy/đỉnh nhỏ (pivot N nến: chính 5, nội bộ 2).
 * - BOS = hồi hợp lệ + đóng qua Weak; CHoCH = đóng qua Strong; Sweep = râu qua mốc, thân đóng lại.
 * - NỘI BỘ chạy trong đoạn sóng chính: mỗi lần sóng chính BOS/CHoCH, nội bộ khởi động lại từ
 *   điểm cấu trúc chính mới nhất và tính lại các nến từ đó (xoá hình vẽ nội bộ đoạn cũ).
 * Không dính tới SMC.
 */
import type { Bar } from "../mt5/types.js";
import { pyFixed } from "./util.js";

const E_N = 5;
const I_N = 2;
type Mode = "flip" | "form" | "idm";
const E_MODE: Mode = "form";
const I_MODE: Mode = "form";

interface Seg { x1: number; y1: number; x2: number; y2: number; up: boolean }
interface Line { k: "BOS" | "CHoCH" | "IDM"; x1: number; x2: number; y: number; up: boolean }
interface SweepMark { x1: number; x2: number; y: number; above: boolean }
type Ev = "bosUp" | "bosDn" | "chUp" | "chDn";

const f2 = (x: number) => pyFixed(x, 2);

class Wave {
  trend = 0;
  ext: number | null = null; extX: number | null = null;       // mốc BOS (Weak)
  prot: number | null = null; protX: number | null = null;     // mốc bảo vệ (Strong)
  pb: number | null = null; pbX: number | null = null;         // cực trị nhịp hồi sau ext
  post: number | null = null; postX: number | null = null;     // cực trị theo hướng trend sau pb
  peak: number | null = null; peakX: number | null = null;     // cực trị tuyệt đối của sóng
  retr: number | null = null; retrX: number | null = null;     // cực trị ngược hướng sau peak
  idmHit = false; flip = false; valid = false; extSwept = false; protSwept = false;
  chX: number | null = null;
  pl: number | null = null; plX: number | null = null;
  ph: number | null = null; phX: number | null = null;
  ptY: number | null = null; ptX: number | null = null;         // điểm cấu trúc cuối đã vẽ
  lastHi: number | null = null; lastHiX: number | null = null;
  lastLo: number | null = null; lastLoX: number | null = null;
  lastEv = "—";
  ev = new Set<Ev>();
  segs: Seg[] = []; lines: Line[] = []; sweeps: SweepMark[] = [];

  clearDraw() { this.segs = []; this.lines = []; this.sweeps = []; }

  private pt(y: number | null, x: number | null, isHigh: boolean) {
    if (y == null || x == null) return;
    if (isHigh) { this.lastHi = y; this.lastHiX = x; } else { this.lastLo = y; this.lastLoX = x; }
    if (this.ptY != null) this.segs.push({ x1: this.ptX!, y1: this.ptY, x2: x, y2: y, up: isHigh });
    this.ptY = y;
    this.ptX = x;
  }

  private reset() {
    this.retr = null;
    this.idmHit = this.flip = this.valid = this.extSwept = this.protSwept = false;
  }

  private validBy(mode: Mode, formOk: boolean) {
    return mode === "flip" ? this.flip : mode === "idm" ? this.idmHit : formOk;
  }

  step(mode: Mode, o: number, h: number, l: number, cl: number, x: number) {
    this.ev = new Set();
    if (this.trend === 0) {                                      // khởi tạo
      this.trend = cl >= o ? 1 : -1;
      this.ext = this.trend === 1 ? h : l; this.extX = x;
      this.peak = this.ext; this.peakX = x;
      this.prot = this.trend === 1 ? l : h; this.protX = x;
      this.ptY = this.prot; this.ptX = x;
      if (this.trend === 1) { this.lastLo = l; this.lastLoX = x; } else { this.lastHi = h; this.lastHiX = x; }
    } else if (this.trend === 1) {                               // ===== TĂNG =====
      if (x > this.extX!) {
        if (this.pb == null || l < this.pb) {
          if (this.peakX! > this.extX! && this.peakX! < x) { this.ext = this.peak; this.extX = this.peakX; this.extSwept = false; }
          this.pb = l; this.pbX = x; this.post = h; this.postX = x;
        } else if (this.post != null && h > this.post) { this.post = h; this.postX = x; }
        if (!this.idmHit && this.pl != null && this.plX! > this.protX! && l < this.pl) {
          this.idmHit = true;
          this.lines.push({ k: "IDM", x1: this.plX!, x2: x, y: this.pl, up: false });
        }
      }
      const formOk = this.pl != null && this.plX! > this.extX!;
      this.valid = this.valid || (this.pb != null && this.validBy(mode, formOk));
      if (cl < this.prot!) {                                     // CHoCH giảm
        this.lines.push({ k: "CHoCH", x1: this.protX!, x2: x, y: this.prot!, up: false });
        this.pt(this.peak, this.peakX, true);
        const [nlo, nlx] = this.retr == null || l < this.retr ? [l, x] : [this.retr, this.retrX!];
        this.trend = -1;
        this.prot = this.peak; this.protX = this.peakX;
        this.ext = nlo; this.extX = nlx; this.peak = nlo; this.peakX = nlx;
        this.pb = nlx < x ? h : null; this.pbX = x;
        this.post = nlx < x ? l : null; this.postX = x;
        this.reset();
        this.chX = x;
        this.ev.add("chDn");
        this.lastEv = `CHoCH ↓ ${f2(this.prot!)}`;
      } else if (this.valid && cl > this.ext!) {                 // BOS tăng
        this.lines.push({ k: "BOS", x1: this.extX!, x2: x, y: this.ext!, up: true });
        const lvl = this.ext!;
        this.pt(this.ext, this.extX, true);
        this.pt(this.pb, this.pbX, false);
        const nx = this.postX;
        this.prot = this.pb; this.protX = this.pbX;
        this.ext = this.post; this.extX = nx; this.peak = this.post; this.peakX = nx;
        this.pb = nx! < x ? l : null; this.pbX = x;
        this.post = nx! < x ? h : null; this.postX = x;
        this.reset();
        this.ev.add("bosUp");
        this.lastEv = `BOS ↑ ${f2(lvl)}`;
      } else {
        if (h > this.ext! && !this.valid) {                      // chưa hồi hợp lệ → kéo dài đỉnh
          this.ext = h; this.extX = x; this.peak = h; this.peakX = x;
          this.pb = this.post = this.retr = null;
          this.idmHit = this.flip = this.extSwept = false;
        } else if (h > this.ext! && this.valid) {                // râu vượt Weak High → sweep
          if (!this.extSwept) {
            this.extSwept = true;
            this.lastEv = `Sweep đỉnh ${f2(this.ext!)}`;
            this.sweeps.push({ x1: this.extX!, x2: x, y: this.ext!, above: true });
          }
          if (h > this.peak!) { this.peak = h; this.peakX = x; this.retr = null; }
        }
        if (l < this.prot! && !this.protSwept) {
          this.protSwept = true;
          this.lastEv = `Sweep đáy ${f2(this.prot!)}`;
          this.sweeps.push({ x1: this.protX!, x2: x, y: this.prot!, above: false });
        }
      }
    } else {                                                     // ===== GIẢM =====
      if (x > this.extX!) {
        if (this.pb == null || h > this.pb) {
          if (this.peakX! > this.extX! && this.peakX! < x) { this.ext = this.peak; this.extX = this.peakX; this.extSwept = false; }
          this.pb = h; this.pbX = x; this.post = l; this.postX = x;
        } else if (this.post != null && l < this.post) { this.post = l; this.postX = x; }
        if (!this.idmHit && this.ph != null && this.phX! > this.protX! && h > this.ph) {
          this.idmHit = true;
          this.lines.push({ k: "IDM", x1: this.phX!, x2: x, y: this.ph, up: true });
        }
      }
      const formOk = this.ph != null && this.phX! > this.extX!;
      this.valid = this.valid || (this.pb != null && this.validBy(mode, formOk));
      if (cl > this.prot!) {                                     // CHoCH tăng
        this.lines.push({ k: "CHoCH", x1: this.protX!, x2: x, y: this.prot!, up: true });
        this.pt(this.peak, this.peakX, false);
        const [nhi, nhx] = this.retr == null || h > this.retr ? [h, x] : [this.retr, this.retrX!];
        this.trend = 1;
        this.prot = this.peak; this.protX = this.peakX;
        this.ext = nhi; this.extX = nhx; this.peak = nhi; this.peakX = nhx;
        this.pb = nhx < x ? l : null; this.pbX = x;
        this.post = nhx < x ? h : null; this.postX = x;
        this.reset();
        this.chX = x;
        this.ev.add("chUp");
        this.lastEv = `CHoCH ↑ ${f2(this.prot!)}`;
      } else if (this.valid && cl < this.ext!) {                 // BOS giảm
        this.lines.push({ k: "BOS", x1: this.extX!, x2: x, y: this.ext!, up: false });
        const lvl = this.ext!;
        this.pt(this.ext, this.extX, false);
        this.pt(this.pb, this.pbX, true);
        const nx = this.postX;
        this.prot = this.pb; this.protX = this.pbX;
        this.ext = this.post; this.extX = nx; this.peak = this.post; this.peakX = nx;
        this.pb = nx! < x ? h : null; this.pbX = x;
        this.post = nx! < x ? l : null; this.postX = x;
        this.reset();
        this.ev.add("bosDn");
        this.lastEv = `BOS ↓ ${f2(lvl)}`;
      } else {
        if (l < this.ext! && !this.valid) {
          this.ext = l; this.extX = x; this.peak = l; this.peakX = x;
          this.pb = this.post = this.retr = null;
          this.idmHit = this.flip = this.extSwept = false;
        } else if (l < this.ext! && this.valid) {
          if (!this.extSwept) {
            this.extSwept = true;
            this.lastEv = `Sweep đáy ${f2(this.ext!)}`;
            this.sweeps.push({ x1: this.extX!, x2: x, y: this.ext!, above: false });
          }
          if (l < this.peak!) { this.peak = l; this.peakX = x; this.retr = null; }
        }
        if (h > this.prot! && !this.protSwept) {
          this.protSwept = true;
          this.lastEv = `Sweep đỉnh ${f2(this.prot!)}`;
          this.sweeps.push({ x1: this.protX!, x2: x, y: this.prot!, above: true });
        }
      }
    }
    if (this.peakX != null && x > this.peakX) {                  // cực trị ngược hướng sau peak (dùng khi CHoCH)
      if (this.trend === 1 && (this.retr == null || l < this.retr)) { this.retr = l; this.retrX = x; }
      else if (this.trend === -1 && (this.retr == null || h > this.retr)) { this.retr = h; this.retrX = x; }
    }
  }

  /** Khởi động nội bộ tại điểm cấu trúc chính mới nhất (đầu đoạn sóng chính hiện tại). */
  seed(e: Wave, bars: Bar[]) {
    const x0 = e.ptX!;
    this.trend = e.trend;
    this.ptY = e.ptY; this.ptX = x0;
    this.prot = e.ptY; this.protX = x0;
    this.ext = e.trend === 1 ? bars[x0].high : bars[x0].low; this.extX = x0;
    this.peak = this.ext; this.peakX = x0;
    this.pb = this.post = this.pl = this.ph = this.chX = null;
    this.lastHi = e.lastHi; this.lastHiX = e.lastHiX; this.lastLo = e.lastLo; this.lastLoX = e.lastLoX;
    this.reset();
    this.lastEv = "Đoạn mới";
  }
}

/** ta.pivotlow/pivothigh(L, L): giá trị xác nhận TẠI nến i (của nến i-L), null nếu không. */
function pivots(bars: Bar[], L: number): [(number | null)[], (number | null)[]] {
  const n = bars.length;
  const pl: (number | null)[] = new Array(n).fill(null);
  const ph: (number | null)[] = new Array(n).fill(null);
  for (let i = 2 * L; i < n; i++) {
    const c = i - L;
    const lo = bars[c].low;
    const hi = bars[c].high;
    let minL = Infinity, maxL = -Infinity, minR = Infinity, maxR = -Infinity;
    for (let k = c - L; k < c; k++) { minL = Math.min(minL, bars[k].low); maxL = Math.max(maxL, bars[k].high); }
    for (let k = c + 1; k <= i; k++) { minR = Math.min(minR, bars[k].low); maxR = Math.max(maxR, bars[k].high); }
    if (lo < minL && lo <= minR) pl[i] = lo;
    if (hi > maxL && hi >= maxR) ph[i] = hi;
  }
  return [pl, ph];
}

export interface WaveLayer {
  trend: number; strong: number | null; weak: number | null; valid: boolean; event: string;
  segs: Seg[]; lines: Line[]; sweeps: SweepMark[];
  live: Seg[]; strongX: number | null; weakX: number | null;
  pd?: { top: number; bot: number; mid: number; x1: number };
}
export interface WaveResult { step: number; t_last: number; E: WaveLayer; I: WaveLayer }

/** bars cũ → mới (cây cuối có thể đang chạy). Toạ độ trả theo THỜI GIAN nến. */
export function analyze(bars: Bar[]): WaveResult | null {
  const n = bars.length;
  if (n < 30) return null;
  const [ePL, ePH] = pivots(bars, E_N);
  const [iPL, iPH] = pivots(bars, I_N);
  const E = new Wave();
  const I = new Wave();
  for (let x = 0; x < n; x++) {
    const b = bars[x];
    if (ePL[x] != null) { E.pl = ePL[x]; E.plX = x - E_N; }
    if (ePH[x] != null) { E.ph = ePH[x]; E.phX = x - E_N; }
    if (iPL[x] != null) { I.pl = iPL[x]; I.plX = x - I_N; }
    if (iPH[x] != null) { I.ph = iPH[x]; I.phX = x - I_N; }
    I.step(I_MODE, b.open, b.high, b.low, b.close, x);                       // 1) nội bộ trước
    if ((E.trend === 1 && I.ev.has("chDn")) || (E.trend === -1 && I.ev.has("chUp"))) E.flip = true;   // 2)
    E.step(E_MODE, b.open, b.high, b.low, b.close, x);                       // 3) sóng chính
    if (E.ev.size) {                                                           // 4) đoạn mới → tính lại nội bộ
      I.clearDraw();
      I.seed(E, bars);
      for (let xi = Math.max(E.ptX! + 1, x - 4000); xi <= x; xi++) {
        if (iPL[xi] != null) { I.pl = iPL[xi]; I.plX = xi - I_N; }
        if (iPH[xi] != null) { I.ph = iPH[xi]; I.phX = xi - I_N; }
        const bi = bars[xi];
        I.step(I_MODE, bi.open, bi.high, bi.low, bi.close, xi);
      }
      if (I.chX != null && I.chX > E.extX! && I.trend !== E.trend) E.flip = true;
    }
  }
  const T = (v: number | null) => (v == null ? null : bars[v].time);
  const layer = (w: Wave, withPd: boolean): WaveLayer => {
    const live: Seg[] = [];
    if (w.ptY != null && w.ext != null) {
      live.push({ x1: T(w.ptX)!, y1: w.ptY, x2: T(w.extX)!, y2: w.ext, up: w.trend === 1 });
      if (w.pb != null) {
        live.push({ x1: T(w.extX)!, y1: w.ext, x2: T(w.pbX)!, y2: w.pb, up: w.trend !== 1 });
        if (w.post != null && w.postX! > w.pbX!) live.push({ x1: T(w.pbX)!, y1: w.pb, x2: T(w.postX)!, y2: w.post, up: w.trend === 1 });
      }
    }
    const d: WaveLayer = {
      trend: w.trend, strong: w.prot, weak: w.ext, valid: w.valid, event: w.lastEv,
      segs: w.segs.map((s) => ({ ...s, x1: T(s.x1)!, x2: T(s.x2)! })),
      lines: w.lines.map((s) => ({ ...s, x1: T(s.x1)!, x2: T(s.x2)! })),
      sweeps: w.sweeps.map((s) => ({ ...s, x1: T(s.x1)!, x2: T(s.x2)! })),
      live, strongX: T(w.protX), weakX: T(w.extX),
    };
    if (withPd && w.prot != null && w.peak != null) {
      const top = Math.max(w.prot, w.peak);
      const bot = Math.min(w.prot, w.peak);
      d.pd = { top, bot, mid: (top + bot) / 2, x1: T(Math.min(w.protX!, w.peakX!))! };
    }
    return d;
  };
  return { step: bars[n - 1].time - bars[n - 2].time, t_last: bars[n - 1].time, E: layer(E, true), I: layer(I, false) };
}
