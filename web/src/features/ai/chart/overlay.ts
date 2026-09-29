/**
 * Vẽ lớp phủ canvas trên chart: vùng Cung/Cầu, Cấu trúc sóng, thành phần mô hình SMC/ICT/CRT.
 * Hàm thuần — nhận bộ đổi toạ độ (thời gian → x, giá → y) từ AiChart.
 */
import type { SchoolModel, Timeframe, Wave, Zone } from "../../../api/types";

export interface Painter {
  ctx: CanvasRenderingContext2D;
  tx: (t: number) => number | null;   // thời gian (giờ server) → x
  Y: (p: number) => number | null;    // giá → y
  W: number;                          // bề rộng vùng vẽ (không tính trục giá)
}

const FONT = "600 10px 'IBM Plex Mono',monospace";

function line(p: Painter, x1: number | null, y1: number | null, x2: number | null, y2: number | null, col: string, w: number, dash: number[] = []) {
  if (x1 == null || x2 == null || y1 == null || y2 == null) return;
  const { ctx } = p;
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function label(p: Painter, s: string, x: number | null, y: number | null, col: string, above: boolean) {
  if (x == null || y == null) return;
  p.ctx.fillStyle = col;
  p.ctx.textAlign = "center";
  p.ctx.fillText(s, x, above ? y - 4 : y + 11);
  p.ctx.textAlign = "left";
}

// ------------------------------------------------------------------ Cung / Cầu
const TF_SHORT: Partial<Record<Timeframe, string>> = { H1: "H1", H4: "H4", D1: "D", W1: "W", MN: "M" };

/** tf = null: khung đang xem; có tf: vùng khung lớn (viền dày + nhãn khung). */
export function drawZones(p: Painter, sets: { tf: Timeframe | null; zones: Zone[] }[], showSwept: boolean) {
  const { ctx, W } = p;
  ctx.font = FONT;
  for (const S of sets) {
    for (const z of S.zones.slice().reverse()) {
      if (z.mitigated && !showSwept) continue;
      const y1 = p.Y(z.top), y2 = p.Y(z.bottom);
      if (y1 == null || y2 == null) continue;
      let x1 = p.tx(z.t);
      let x2 = z.mitigated && z.t_end ? p.tx(z.t_end) : W;
      if (x1 == null || x2 == null) continue;
      x1 = Math.max(0, x1);
      x2 = Math.min(W, x2);
      if (x2 <= 0 || x1 >= W || x2 <= x1) continue;
      const top = Math.min(y1, y2), ht = Math.max(Math.abs(y2 - y1), 2);
      const col = z.bias === 1 ? "8,153,129" : "242,54,69";
      ctx.fillStyle = `rgba(${col},${z.mitigated ? 0.1 : 0.2})`;
      ctx.fillRect(x1, top, x2 - x1, ht);
      const stroke = `rgba(${col},${z.mitigated ? 0.4 : 0.9})`;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 0.5, top + 0.5, x2 - x1 - 1, ht);
      const ym = p.Y(z.mid);
      if (ym != null) line(p, x1, ym, x2, ym, stroke, 1, [4, 3]);
      ctx.fillStyle = `rgba(${col},${z.mitigated ? 0.55 : 1})`;
      ctx.fillText((S.tf ? TF_SHORT[S.tf] + " · " : "") + (z.bias === 1 ? "Cầu" : "Cung") + (z.ok ? " OK" : ""), x1 + 3, z.bias === 1 ? top + ht + 11 : top - 3);
      if (S.tf) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.strokeRect(x1 + 1, top + 1, x2 - x1 - 2, Math.max(ht - 2, 1));
      }
    }
  }
}

// ------------------------------------------------------------------ SMC / ICT / CRT
const BOX_COLOR: Record<string, (bull: boolean | null) => string> = {
  OB: (b) => (b ? "49,121,245" : "247,124,128"),
  FVG: () => "234,179,8",
  OTE: () => "168,85,247",
  CRT: () => "148,163,184",
};

/** Hộp OB / FVG / OTE / range CRT + mức quét, phá vỡ, EQ. */
export function drawSchool(p: Painter, D: SchoolModel["draw"], tag: string) {
  const { ctx, W } = p;
  ctx.font = FONT;
  for (const b of D.boxes || []) {
    let x1 = p.tx(b.t1);
    const y1 = p.Y(b.top), y2 = p.Y(b.bot);
    if (x1 == null || y1 == null || y2 == null) continue;
    x1 = Math.max(0, x1);
    const c = (BOX_COLOR[b.k] ?? BOX_COLOR.CRT)(b.bull);
    const top = Math.min(y1, y2), ht = Math.max(Math.abs(y2 - y1), 2);
    ctx.fillStyle = `rgba(${c},0.16)`;
    ctx.fillRect(x1, top, W - x1, ht);
    ctx.strokeStyle = `rgba(${c},0.85)`;
    ctx.lineWidth = 1;
    ctx.setLineDash(b.k === "OTE" ? [4, 3] : []);
    ctx.strokeRect(x1 + 0.5, top + 0.5, W - x1 - 1, ht);
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${c},1)`;
    ctx.fillText(`${tag} ${b.k}${b.k === "OTE" ? " 62–79%" : ""}`, x1 + 3, top - 3);
  }
  for (const l of D.levels || []) {
    let x1 = p.tx(l.t1);
    let x2 = l.t2 ? p.tx(l.t2) : W;
    const y = p.Y(l.y);
    if (x1 == null || x2 == null || y == null) continue;
    x1 = Math.max(0, x1);
    if (l.k === "sweep" && x2 - x1 < 30) x2 = Math.min(W, x1 + 30);
    const col = l.k === "brk" ? "#eab308" : l.k === "sweep" ? "#9598a1" : "#94a3b8";
    line(p, x1, y, x2, y, col, 1, l.k === "brk" ? [] : [3, 3]);
    ctx.fillStyle = col;
    ctx.fillText(`${tag} ${l.lab}${l.k === "sweep" ? " ✕" : ""}`, Math.min(x2, W - 80) + 3, y - 3);
  }
}

// ------------------------------------------------------------------ Cấu trúc sóng
const WAVE_STYLE = {
  E: { up: "#089981", dn: "#f23645", w: 2, dash: [] as number[], tag: "" },
  I: { up: "#2962ff", dn: "#ff6d00", w: 1, dash: [5, 4], tag: "i-" },
};

/** Zigzag cấu trúc + chân sóng đang chạy + BOS/CHoCH/IDM/Sweep + Strong/Weak + Premium/Discount. */
export function drawWave(p: Painter, WV: Wave, on: (k: string) => boolean) {
  const { ctx, W, tx, Y } = p;
  const right = tx(WV.t_last + 20 * WV.step) ?? W;
  const E = WV.E;

  if (on("wvPD") && E?.pd) {
    const yt = Y(E.pd.top), ym = Y(E.pd.mid), yb = Y(E.pd.bot);
    let x1 = tx(E.pd.x1);
    if (x1 != null && yt != null && ym != null && yb != null) {
      x1 = Math.max(0, x1);
      ctx.fillStyle = "rgba(242,54,69,0.07)";
      ctx.fillRect(x1, Math.min(yt, ym), right - x1, Math.abs(ym - yt));
      ctx.fillStyle = "rgba(8,153,129,0.07)";
      ctx.fillRect(x1, Math.min(ym, yb), right - x1, Math.abs(yb - ym));
      line(p, x1, ym, right, ym, "rgba(149,152,161,.8)", 1, [2, 3]);
      ctx.fillStyle = "#9598a1";
      ctx.fillText("EQ 50% " + E.pd.mid.toFixed(2), Math.min(right, W) - 110, ym - 3);
    }
  }
  ctx.font = FONT;
  for (const k of ["I", "E"] as const) {
    const L = WV[k], S = WAVE_STYLE[k];
    if (!L || !on(k === "E" ? "wvE" : "wvI")) continue;
    for (const g of L.segs || []) line(p, tx(g.x1), Y(g.y1), tx(g.x2), Y(g.y2), g.up ? S.up : S.dn, S.w, S.dash);
    for (const g of L.live || []) line(p, tx(g.x1), Y(g.y1), tx(g.x2), Y(g.y2), g.up ? S.up : S.dn, S.w, [6, 4]);
    for (const l of L.lines || []) {
      const isIdm = l.k === "IDM";
      if (isIdm ? !on("wvIdm") : k === "I" || !on("wvBos")) continue;   // nội bộ: chỉ IDM (theo chỉ báo)
      const x1 = tx(l.x1), x2 = tx(l.x2), y = Y(l.y);
      const col = isIdm ? "#9598a1" : l.up ? S.up : S.dn;
      line(p, x1, y, x2, y, col, 1, isIdm ? [2, 3] : l.k === "CHoCH" ? [5, 4] : []);
      if (x1 != null && x2 != null) label(p, isIdm ? "IDM" : S.tag + l.k, (x1 + x2) / 2, y, col, l.up);
    }
    if (k === "E" && on("wvIdm")) {
      for (const w of L.sweeps || []) {
        const x1 = tx(w.x1), x2 = tx(w.x2), y = Y(w.y);
        line(p, x1, y, x2, y, "#9598a1", 1, [2, 3]);
        label(p, "x", x2, y, "#9598a1", w.above);
      }
    }
  }
  if (on("wvSW") && E?.strong != null) {
    const up = E.trend === 1;
    const xs = Math.max(0, (E.strongX != null ? tx(E.strongX) : null) || 0);
    const xw = Math.max(0, (E.weakX != null ? tx(E.weakX) : null) || 0);
    const ys = Y(E.strong), yw = E.weak != null ? Y(E.weak) : null;
    line(p, xs, ys, right, ys, "#8a8f9c", 2);
    line(p, xw, yw, right, yw, "#c3c6ce", 1, [5, 4]);
    ctx.fillStyle = "#b2b5be";
    if (ys != null) ctx.fillText((up ? "Strong Low " : "Strong High ") + E.strong.toFixed(2), Math.min(right, W) - 140, ys + (up ? 12 : -4));
    if (yw != null && E.weak != null) ctx.fillText((up ? "Weak High " : "Weak Low ") + E.weak.toFixed(2), Math.min(right, W) - 140, yw + (up ? -4 : 12));
  }
}
