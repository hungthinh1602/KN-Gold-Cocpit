/** Dải thẻ "lệnh thắng gần đây" chạy ngang (rê chuột để dừng). Đường giá = giá đóng nến thật từ lúc khớp tới lúc đóng. */
import { useT } from "../../i18n/lang";
import { fmtPx, vnTime, type PublicCard } from "./types";

const W = 258, H = 92;

function Spark({ c, i }: { c: PublicCard; i: number }) {
  const win = c.win!;
  const pts = c.path && c.path.length >= 3 ? [c.entry, ...c.path] : [c.entry, win.price];
  const lv = [c.entry, win.price, ...(c.sl != null ? [c.sl] : [])];
  const lo = Math.min(...pts, ...lv), hi = Math.max(...pts, ...lv), pad = (hi - lo) * .08 || 1;
  const y = (v: number) => (1 - (v - lo + pad) / (hi - lo + 2 * pad)) * H;
  const x = (k: number) => (k * (W - 6)) / (pts.length - 1);
  const d = pts.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const buy = c.side === "BUY", edge = buy ? H : 0, g = `lpg${i}`;
  const yE = y(c.entry), yT = y(win.price);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1={buy ? 0 : 1} x2="0" y2={buy ? 1 : 0}>
          <stop offset="0" stopColor="#3ccf91" stopOpacity=".35" /><stop offset="1" stopColor="#3ccf91" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y={Math.min(yE, yT)} width={W} height={Math.abs(yE - yT)} fill="#3ccf9110" />
      <line x1="0" x2={W} y1={yT} y2={yT} stroke="#3ccf91" strokeDasharray="4 4" />
      <line x1="0" x2={W} y1={yE} y2={yE} stroke="#e8b65a" strokeDasharray="4 4" />
      {c.sl != null && <line x1="0" x2={W} y1={y(c.sl)} y2={y(c.sl)} stroke="#f2685f" strokeOpacity=".6" strokeDasharray="2 4" />}
      <path d={`${d} L${x(pts.length - 1)} ${edge} L0 ${edge} Z`} fill={`url(#${g})`} />
      <path d={d} fill="none" stroke="#3ccf91" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4.5" fill="#3ccf91" stroke="#06140d" strokeWidth="2" />
    </svg>
  );
}

function Card({ c, i }: { c: PublicCard; i: number }) {
  const t = useT();
  const w = c.win!;
  return (
    <div className="wcard">
      <div className="wt">
        <span className="sym">XAU/USD <span className={"side " + (c.side === "BUY" ? "b" : "s")}>{c.side}</span></span>
        <span>{c.name}</span>
      </div>
      <div className="big">+{fmtPx(w.pip, w.pip % 1 ? 1 : 0)}<small>pip</small></div>
      <span className="hit"><i>✓</i>{w.label === "100 pip" ? t("Đạt +100 pip", "Hit +100 pips") : t(`Chạm ${w.label}`, `${w.label} hit`)}</span>
      <Spark c={c} i={i} />
      <div className="lv">
        <div>Entry<b>{fmtPx(c.entry, 1)}</b></div>
        <div>SL<b>{c.sl != null ? fmtPx(c.sl, 1) : "—"}</b></div>
        <div>{t("Chốt", "Target")}<b>{fmtPx(w.price, 1)}</b></div>
      </div>
      <div className="wf"><span>{vnTime(c.ts)}</span><span>Buồng Lái Vàng</span></div>
    </div>
  );
}

export function WinCards({ wins }: { wins: PublicCard[] }) {
  const list = wins.filter((c) => c.win);
  // lặp số CHẴN lần (chạy tới -50% là khớp nửa sau → vòng liền mạch), ít thẻ thì lặp nhiều hơn
  const n = Math.max(2, Math.ceil(12 / Math.max(1, list.length)));
  const loop = list.length ? Array.from({ length: n + (n % 2) }, () => list).flat() : [];
  return (
    <div className="wins-fade">
      <div className="wins-row" style={{ animationDuration: `${Math.max(30, loop.length * 4.5)}s` }}>
        {loop.map((c, i) => <Card key={i} c={c} i={i} />)}
      </div>
    </div>
  );
}
