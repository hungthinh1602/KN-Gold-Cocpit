/** Chart nhỏ ở phần mở đầu trang giới thiệu: nến M15 thật (canvas) + đường giá hiện tại. */
import { useEffect, useRef } from "react";
import type { PublicHome } from "./types";

const C = { grid: "#221d17", up: "#3ccf91", down: "#f2685f", gold: "#e8b65a", label: "#140f08" };

export function HeroChart({ candles, price }: { candles: PublicHome["candles"]; price: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) { const yy = 10 + g * (H - 60) / 6; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
      if (!candles.length) return;
      // nến cuối lấy theo giá hiện tại cho "sống"
      const cs = candles.map((c, i) => (i === candles.length - 1 && price ? { ...c, c: price, h: Math.max(c.h, price), l: Math.min(c.l, price) } : c));
      const lo = Math.min(...cs.map((c) => c.l)), hi = Math.max(...cs.map((c) => c.h)), pad = (hi - lo) * .08 || 1;
      const plotH = H - 70, right = 64;
      const y = (v: number) => 12 + (1 - (v - lo + pad) / (hi - lo + 2 * pad)) * plotH;
      const step = (W - right) / cs.length;
      cs.forEach((c, i) => {
        const x = i * step + step / 2, col = c.c >= c.o ? C.up : C.down;
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x, y(c.h)); ctx.lineTo(x, y(c.l)); ctx.stroke();
        const t = y(Math.max(c.o, c.c));
        ctx.fillStyle = col; ctx.fillRect(x - step * .32, t, Math.max(1, step * .64), Math.max(1, y(Math.min(c.o, c.c)) - t));
      });
      const last = cs[cs.length - 1].c, ly = y(last);
      ctx.strokeStyle = C.gold; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W - right, ly); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.gold; ctx.fillRect(W - right + 2, ly - 9, right - 4, 18);
      ctx.fillStyle = C.label; ctx.font = "600 11px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText(last.toFixed(2), W - right / 2, ly + 4);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [candles, price]);

  return <canvas ref={ref} className="lp-canvas" aria-label="XAU/USD M15" />;
}
