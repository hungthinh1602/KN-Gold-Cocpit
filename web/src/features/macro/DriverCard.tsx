/** Thẻ 1 yếu tố vĩ mô (US10Y, DXY, lợi suất thực, S&P 500, VIX). */
import type { Driver } from "../../api/types";
import { fmt } from "../../lib/format";
import { Change, History } from "../../components/common/Change";
import { Sparkline } from "../../components/common/Sparkline";
import { contribution } from "./drivers";

const DIR = { up: { t: "Đang tăng", c: "up" }, down: { t: "Đang giảm", c: "down" }, flat: { t: "Đi ngang", c: "flat" } };

export function DriverCard({ id, x }: { id: string; x: Driver }) {
  const dec = id === "spx" || id === "dxy" || id === "vix" ? 2 : 3;
  const c = contribution(x);
  const chip = c > 0 ? { cls: "chip pos", t: "Hỗ trợ vàng" } : c < 0 ? { cls: "chip neg", t: "Đè vàng" } : { cls: "chip neu", t: "Trung tính" };
  const di = DIR[x.dir] ?? DIR.flat;
  const color = c > 0 ? "var(--up)" : c < 0 ? "var(--down)" : "var(--neutral)";
  return (
    <section className={"card" + (x.ok ? "" : " stale")}>
      <div className="cmain">
        <div className="chead">
          <div><div className="cname">{x.name}</div><div className="cwhat">{x.what}</div></div>
          <span className="wt">×{x.weight}</span>
        </div>
        <div className="cval"><span className="cnum">{fmt(x.value, dec)}</span><span className="cchg"><Change pct={x.pct} /></span></div>
        <div className="row"><span className={"dirtag " + di.c}>{di.t}</span><span className={chip.cls}>{chip.t}</span></div>
      </div>
      <div className="cchart"><Sparkline data={x.spark} color={color} /></div>
      <div className="hist"><History p3={x.pct3} p5={x.pct5} pM={x.pctM} /></div>
    </section>
  );
}
