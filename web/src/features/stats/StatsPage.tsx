/** Tab 📈 Hiệu suất: thống kê tín hiệu Lệnh Live (winrate, pip, profit factor, sụt giảm, đường pip cộng dồn, bảng phân tích). */
import { useState } from "react";
import { api } from "../../api/client";
import type { StatsBucket, StatsData } from "../../api/types";
import { Segmented } from "../../components/common/Segmented";
import { usePolling } from "../../hooks/usePolling";
import { useStoredState } from "../../hooks/useStoredState";
import { useLang, useT, locale, type T } from "../../i18n/lang";
import "../../styles/stats.css";

type Range = "30" | "90" | "365" | "0";
const RANGES: { value: Range; vi: string; en: string }[] = [
  { value: "30", vi: "30 ngày", en: "30 days" }, { value: "90", vi: "90 ngày", en: "90 days" },
  { value: "365", vi: "1 năm", en: "1 year" }, { value: "0", vi: "Tất cả", en: "All" },
];
const REFRESH_MS = 60_000;

const sign = (x: number) => (x > 0 ? "+" : "") + x.toFixed(0);
const cls = (x: number | null | undefined) => (x == null || x === 0 ? "" : x > 0 ? "up" : "dn");
const pfText = (pf: number | null, trades: number) => (pf != null ? pf.toFixed(2) : trades ? "∞" : "—");
const pct = (x: number | null) => (x == null ? "—" : `${x}%`);

function Kpi({ v, label, sub, c }: { v: string; label: string; sub?: string; c?: string }) {
  return (
    <div className="st-kpi">
      <span className="st-kl">{label}</span>
      <b className={c}>{v}</b>
      {sub && <span className="st-ks">{sub}</span>}
    </div>
  );
}

/** Đường pip cộng dồn (SVG, tự co theo khung). */
function Curve({ data, t }: { data: StatsData["curve"]; t: T }) {
  const [lang] = useLang();
  if (data.length < 2) return <div className="st-empty">{t("Cần ít nhất 2 lệnh đã đóng để vẽ đường pip.", "Needs at least 2 closed orders to draw the curve.")}</div>;
  const W = 800, Hh = 220, P = 8;
  const pts = [{ t: data[0].t, pips: 0 }, ...data];
  const ys = pts.map((p) => p.pips);
  const lo = Math.min(0, ...ys), hi = Math.max(0, ...ys);
  const span = hi - lo || 1;
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + ((hi - v) / span) * (Hh - 2 * P);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pips).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
  const last = pts[pts.length - 1].pips;
  const day = (ts: number) => new Date(ts * 1000).toLocaleDateString(locale(lang), { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  return (
    <figure className="st-curve">
      <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" role="img" aria-label={t("Đường pip cộng dồn", "Cumulative pips")}>
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="st-zero" />
        <path d={area} className={`st-area ${last >= 0 ? "up" : "dn"}`} />
        <path d={line} className={`st-line ${last >= 0 ? "up" : "dn"}`} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        <span>{day(pts[0].t)}</span>
        <span>{t("cao nhất", "peak")} {sign(hi)} · {t("thấp nhất", "low")} {sign(lo)} pip</span>
        <span>{day(pts[pts.length - 1].t)}</span>
      </figcaption>
    </figure>
  );
}

function BucketTable({ title, rows, t, label }: { title: string; rows: StatsBucket[]; t: T; label?: (k: string) => string }) {
  if (!rows.length) return null;
  return (
    <section className="st-tbl">
      <h3>{title}</h3>
      <div className="st-scroll">
        <table>
          <thead>
            <tr><th />{[t("Lệnh", "Trades"), t("Thắng", "Win"), t("Thua", "Loss"), "Winrate", "Pip", t("Pip/lệnh", "Pip/trade"), "PF"].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{label ? label(r.key) : r.key}</td>
                <td>{r.trades}</td><td className="up">{r.win}</td><td className="dn">{r.loss}</td>
                <td>{pct(r.winrate)}</td><td className={cls(r.pips)}>{sign(r.pips)}</td>
                <td className={cls(r.avg)}>{r.avg == null ? "—" : sign(r.avg)}</td><td>{pfText(r.pf, r.trades)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StatsPage() {
  const t = useT();
  const [lang] = useLang();
  const [range, setRange] = useStoredState<Range>("strange", "90");
  const [mt5, setMt5] = useStoredState<boolean>("stmt5", false);
  const [data, setData] = useState<StatsData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  usePolling(async () => {
    try { setData(await api.stats(Number(range), mt5)); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, REFRESH_MS, true, [range, mt5]);

  const s = data;
  const month = (k: string) => {
    const [y, m] = k.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale(lang), { month: "short", year: "numeric" });
  };
  const session = (k: string) => (lang === "en" ? ({ "Á": "Asia", "Âu": "Europe", "Mỹ": "US" } as Record<string, string>)[k] ?? k : k);

  return (
    <div className="master st-page">
      <div className="mtop st-top">
        <span className="eyebrow">{t("📈 Hiệu suất tín hiệu", "📈 Signal performance")}</span>
        <div className="st-ctl">
          <Segmented options={RANGES.map((r) => ({ value: r.value, label: lang === "en" ? r.en : r.vi }))} value={range} onChange={setRange} />
          <label className="st-chk"><input type="checkbox" checked={mt5} onChange={(e) => setMt5(e.target.checked)} /> {t("Gồm lệnh MT5", "Include MT5 orders")}</label>
        </div>
      </div>
      {err && <div className="st-empty dn">⚠ {err}</div>}
      {!s ? <div className="st-empty">{t("Đang tải…", "Loading…")}</div> : !s.trades ? (
        <div className="st-empty">{t("Chưa có lệnh đã đóng trong khoảng này.", "No closed orders in this range.")}{s.running ? ` ${t("Đang chạy", "Running")}: ${s.running}.` : ""}</div>
      ) : (
        <>
          <div className="st-kpis">
            <Kpi label="Winrate" v={pct(s.winrate)} sub={`${s.win} ${t("thắng", "won")} · ${s.loss} ${t("thua", "lost")}`} />
            <Kpi label={t("Tổng pip", "Total pips")} v={sign(s.pips)} c={cls(s.pips)} sub={`${s.trades} ${t("lệnh đã đóng", "closed trades")}`} />
            <Kpi label={t("Pip / lệnh", "Pips / trade")} v={s.avg == null ? "—" : sign(s.avg)} c={cls(s.avg)}
              sub={`${t("TB thắng", "avg win")} ${s.avgWin == null ? "—" : sign(s.avgWin)} · ${t("TB thua", "avg loss")} ${s.avgLoss == null ? "—" : sign(s.avgLoss)}`} />
            <Kpi label="Profit factor" v={pfText(s.pf, s.trades)} sub={t("pip thắng ÷ pip thua", "win pips ÷ loss pips")} />
            <Kpi label={t("Sụt giảm lớn nhất", "Max drawdown")} v={s.maxDd ? `-${s.maxDd.toFixed(0)}` : "0"} c={s.maxDd ? "dn" : ""} sub="pip" />
            <Kpi label={t("Chuỗi dài nhất", "Longest streak")} v={`${s.bestStreak} / ${s.worstStreak}`} sub={t("thắng / thua liên tiếp", "wins / losses in a row")} />
          </div>
          <h3 className="st-h">{t("Pip cộng dồn", "Cumulative pips")}</h3>
          <Curve data={s.curve} t={t} />
          <div className="st-grid">
            <BucketTable title={t("Theo tháng", "By month")} rows={s.months} t={t} label={month} />
            <BucketTable title={t("Theo chỉ báo / setup", "By indicator / setup")} rows={s.setups} t={t} />
            <BucketTable title={t("Theo chiều", "By side")} rows={s.sides} t={t} />
            <BucketTable title={t("Theo khung", "By timeframe")} rows={s.tfs} t={t} />
            <BucketTable title={t("Theo phiên (giờ VN nhận lệnh: Á 5–14h · Âu 14–19h · Mỹ 19–5h)", "By session (VN time received: Asia 5–14 · Europe 14–19 · US 19–5)")} rows={s.sessions} t={t} label={session} />
          </div>
          <p className="st-note">{t(
            `Không gồm lệnh test. ${s.cancel} lệnh hủy và ${s.running} lệnh đang chạy không tính vào winrate.`,
            `Test orders excluded. ${s.cancel} cancelled and ${s.running} running orders are not counted in the winrate.`)}</p>
        </>
      )}
    </div>
  );
}
