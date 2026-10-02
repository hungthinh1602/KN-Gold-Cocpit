/** Thẻ 1 lệnh: chiều, chỉ báo, trạng thái, Entry/SL/TP, pip + $, mốc 50p/100p/TP. Bấm để chọn & vẽ lên chart. */
import type { Order } from "../../api/types";
import { vnTime } from "../../lib/format";
import { useT } from "../../i18n/lang";

const f2 = (x: number | null | undefined) => (x == null ? "—" : Number(x).toFixed(2));

function statusColor(o: Order) {
  if (o.state === "closed") return o.result === "win" ? "#16a34a" : "#dc2626";
  if (o.state === "open") return "#f59e0b";
  return "var(--dim)";
}

export function OrderCard({ o, selected, onClick }: { o: Order; selected: boolean; onClick: () => void }) {
  const t = useT();
  const buy = o.side === "BUY";
  const done = o.state === "closed" || o.state === "cancelled";
  const slHit = o.state === "closed" && o.status === "SL";
  const pip = o.state === "open" ? o.cur_pip : o.state === "closed" && !slHit ? o.close_pip : null;
  const showProfit = o.profit != null && o.state !== "pending" && !slHit;
  const tps = o.tps || [];

  return (
    <div className={`lo-card ${buy ? "buy" : "sell"}${done ? " done" : ""}${selected ? " sel" : ""}`} onClick={onClick}>
      <div className="lo-r1">
        <span>
          <span className={"lo-side " + (buy ? "buy" : "sell")}>{o.side}</span> <b>{o.indi}</b>
          {o.tf ? ` · ${o.tf}` : ""}
          {o.test && <span className="lo-tag">test</span>}
          {o.src === "mt5" && <span className="lo-tag mt5">#{o.ticket}{o.volume ? ` · ${o.volume} lot` : ""}</span>}
        </span>
      </div>
      <div className="lo-r2"><span className="lo-stat" style={{ color: statusColor(o) }}>{o.status_text || o.status}</span></div>
      <div className="lo-lv">
        Entry <b>{(o.entries || []).map((e, i) => (o.filled?.[i] ? "✓" : "") + f2(e)).join(" / ")}</b><br />
        SL <b>{f2(o.sl)}</b><br />
        TP <b>{tps.map(f2).join(" / ")}</b>
      </div>
      <div className="lo-r3">
        {pip == null
          ? <span className="lo-pip" style={{ color: "var(--dim)" }}>{o.state === "pending" ? t("chờ khớp", "awaiting fill") : ""}</span>
          : <span className={"lo-pip " + (pip >= 0 ? "up" : "dn")}>{(pip > 0 ? "+" : "") + pip.toFixed(1)} pip</span>}
        {showProfit && (
          <span className={o.profit! >= 0 ? "up" : "dn"} style={{ fontWeight: 700 }}>
            {(o.profit! > 0 ? "+" : "") + o.profit!.toFixed(2)} $
          </span>
        )}
        <span className="lo-ms">
          <i className={o.pip50 ? "on" : ""}>50p</i>
          <i className={o.pip100 ? "on" : ""}>100p</i>
          {tps.map((_, i) => <i key={i} className={o.tp_hit > i ? "on" : ""}>TP{tps.length > 1 ? i + 1 : ""}</i>)}
        </span>
      </div>
      <div className="lo-lv" style={{ fontSize: ".68rem" }}>
        {vnTime(o.recv_ts)}{o.mfe ? ` · ${t("lời tối đa", "max profit")} ${o.mfe.toFixed(0)} pip` : ""}
      </div>
      {selected && (
        <div className="lo-ev">
          {(o.events || []).map((e, i) => <div key={i}>{vnTime(e.ts)} — {e.text}</div>)}
        </div>
      )}
    </div>
  );
}
