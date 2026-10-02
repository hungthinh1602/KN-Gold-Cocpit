/** Thẻ 1 yếu tố vĩ mô (US10Y, DXY, lợi suất thực, S&P 500, VIX). */
import type { Driver } from "../../api/types";
import { fmt } from "../../lib/format";
import { useLang, useT } from "../../i18n/lang";
import { Change, History } from "../../components/common/Change";
import { Sparkline } from "../../components/common/Sparkline";
import { DRIVER_WHAT_EN, contribution } from "./drivers";

export function DriverCard({ id, x }: { id: string; x: Driver }) {
  const t = useT();
  const [lang] = useLang();
  const dec = id === "spx" || id === "dxy" || id === "vix" ? 2 : 3;
  const c = contribution(x);
  const chip = c > 0 ? { cls: "chip pos", t: t("Hỗ trợ vàng", "Supports gold") }
    : c < 0 ? { cls: "chip neg", t: t("Đè vàng", "Weighs on gold") }
    : { cls: "chip neu", t: t("Trung tính", "Neutral") };
  const dir = x.dir === "up" ? { t: t("Đang tăng", "Rising"), c: "up" }
    : x.dir === "down" ? { t: t("Đang giảm", "Falling"), c: "down" }
    : { t: t("Đi ngang", "Flat"), c: "flat" };
  const color = c > 0 ? "var(--up)" : c < 0 ? "var(--down)" : "var(--neutral)";
  return (
    <section className={"card" + (x.ok ? "" : " stale")}>
      <div className="cmain">
        <div className="chead">
          <div><div className="cname">{x.name}</div><div className="cwhat">{lang === "en" ? DRIVER_WHAT_EN[id] ?? x.what : x.what}</div></div>
          <span className="wt">×{x.weight}</span>
        </div>
        <div className="cval"><span className="cnum">{fmt(x.value, dec)}</span><span className="cchg"><Change pct={x.pct} /></span></div>
        <div className="row"><span className={"dirtag " + dir.c}>{dir.t}</span><span className={chip.cls}>{chip.t}</span></div>
      </div>
      <div className="cchart"><Sparkline data={x.spark} color={color} /></div>
      <div className="hist"><History p3={x.pct3} p5={x.pct5} pM={x.pctM} /></div>
    </section>
  );
}
