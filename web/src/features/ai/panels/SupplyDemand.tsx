/** 📦 Vùng Cung / Cầu của khung đang xem — 3 vùng còn hiệu lực gần giá nhất mỗi bên. */
import type { Timeframe, Zone, ZoneSet } from "../../../api/types";
import { Collapsible } from "../../../components/common/Collapsible";
import { useT } from "../../../i18n/lang";

function nearest(zones: Zone[], price: number | null) {
  const mid = (z: Zone) => (z.bottom + z.top) / 2;
  const list = price ? zones.slice().sort((a, b) => Math.abs(mid(a) - price) - Math.abs(mid(b) - price)) : zones;
  return list.slice(0, 3);
}

function ZoneRows({ zones, price }: { zones: Zone[]; price: number | null }) {
  const t = useT();
  if (!zones.length) return <div className="znone">{t("Chưa có vùng rõ", "No clear zone")}</div>;
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
  const t = useT();
  const live = (set?.zones ?? []).filter((z) => !z.mitigated);
  const tr = set?.trend ?? 0;
  const supply = nearest(live.filter((z) => z.bias === -1), price);
  const demand = nearest(live.filter((z) => z.bias === 1), price);
  const band = (z: Zone | undefined) => (z ? `${z.bottom.toFixed(1)} – ${z.top.toFixed(1)}` : t("chưa có", "none"));
  return (
    <Collapsible
      id="sd"
      title={`${t("📦 Vùng Cung / Cầu", "📦 Supply / Demand zones")} · ${tf}`}
      extra={<span className="lo-live">Swing: {tr === 1 ? t("TĂNG → Cầu OK", "UP → Demand OK") : tr === -1 ? t("GIẢM → Cung OK", "DOWN → Supply OK") : t("chưa rõ", "unclear")}</span>}
      summary={<>🔴 {t("Cung gần nhất", "Nearest supply")} <b>{band(supply[0])}</b> · 🟢 {t("Cầu gần nhất", "Nearest demand")} <b>{band(demand[0])}</b></>}
    >
      <div className="zwrap" style={{ marginTop: 10 }}>
        <div className="zcol">
          <div className="zlab sell">🔴 {t("Cung — vùng canh SELL", "Supply — SELL zones")}</div>
          <ZoneRows zones={supply} price={price} />
        </div>
        <div className="zcol">
          <div className="zlab buy">🟢 {t("Cầu — vùng canh BUY", "Demand — BUY zones")}</div>
          <ZoneRows zones={demand} price={price} />
        </div>
      </div>
    </Collapsible>
  );
}
