/** 📦 Vùng Cung / Cầu của khung đang xem — 3 vùng còn hiệu lực gần giá nhất mỗi bên. */
import type { Timeframe, Zone, ZoneSet } from "../../../api/types";

function nearest(zones: Zone[], price: number | null) {
  const mid = (z: Zone) => (z.bottom + z.top) / 2;
  const list = price ? zones.slice().sort((a, b) => Math.abs(mid(a) - price) - Math.abs(mid(b) - price)) : zones;
  return list.slice(0, 3);
}

function ZoneRows({ zones, price }: { zones: Zone[]; price: number | null }) {
  if (!zones.length) return <div className="znone">Chưa có vùng rõ</div>;
  return (
    <>
      {zones.map((z) => {
        const dd = price ? (((z.bottom + z.top) / 2 - price) / price) * 100 : 0;
        return (
          <div key={z.t + ":" + z.top} className="zrow">
            <span className="zpx">
              {z.bottom.toFixed(1)} – {z.top.toFixed(1)}
              {z.ok && <b style={{ fontSize: ".7rem", color: "var(--gold)" }}> OK</b>}
            </span>
            <span className="zd">{(dd >= 0 ? "+" : "") + dd.toFixed(2)}%</span>
          </div>
        );
      })}
    </>
  );
}

export function SupplyDemand({ tf, set, price }: { tf: Timeframe; set: ZoneSet | undefined; price: number | null }) {
  const live = (set?.zones ?? []).filter((z) => !z.mitigated);
  const tr = set?.trend ?? 0;
  return (
    <section className="master">
      <div className="mtop">
        <span className="eyebrow">📦 Vùng Cung / Cầu · {tf}</span>
        <span className="lo-live">Swing: {tr === 1 ? "TĂNG → Cầu OK" : tr === -1 ? "GIẢM → Cung OK" : "chưa rõ"}</span>
      </div>
      <div className="zwrap" style={{ marginTop: 10 }}>
        <div className="zcol">
          <div className="zlab sell">🔴 Cung — vùng canh SELL</div>
          <ZoneRows zones={nearest(live.filter((z) => z.bias === -1), price)} price={price} />
        </div>
        <div className="zcol">
          <div className="zlab buy">🟢 Cầu — vùng canh BUY</div>
          <ZoneRows zones={nearest(live.filter((z) => z.bias === 1), price)} price={price} />
        </div>
      </div>
    </section>
  );
}
