/** Thẻ giá vàng spot: giá, % hôm nay, lịch sử, biểu đồ nhỏ chọn khung 4H / D1 / W1. */
import type { Gold, GoldTfKey } from "../../api/types";
import { fmt } from "../../lib/format";
import { useStoredState } from "../../hooks/useStoredState";
import { Change, History } from "../../components/common/Change";
import { Segmented } from "../../components/common/Segmented";
import { Sparkline } from "../../components/common/Sparkline";
import { useT } from "../../i18n/lang";

const TF_OPTIONS: { value: GoldTfKey; label: string }[] = [
  { value: "4h", label: "4H" }, { value: "d1", label: "D1" }, { value: "w1", label: "W1" },
];

export function GoldCard({ gold }: { gold: Gold | null }) {
  const t = useT();
  const [tf, setTf] = useStoredState<GoldTfKey>("goldTf", "d1");
  const ok = gold && gold.value != null;
  const spark = (gold?.tf?.[tf] ?? gold?.tf?.d1)?.spark ?? gold?.spark ?? null;
  const up = spark && spark.length > 1 ? spark[spark.length - 1] >= spark[0] : true;

  return (
    <section className="gold">
      <div>
        <div className="lab">{t("Giá vàng · Spot (XAUUSD)", "Gold price · Spot (XAUUSD)")}</div>
        <div className="px">{ok ? fmt(gold.value, 2) : "—"}</div>
        <div className="hist">{ok && <History p3={gold.pct3} p5={gold.pct5} pM={gold.pctM} />}</div>
      </div>
      <div className="gcol">
        <div className="chg">{ok ? <Change pct={gold.pct} /> : "—"}</div>
        <div className="gchart"><Sparkline data={spark} color={up ? "var(--up)" : "var(--down)"} w={200} h={112} /></div>
        <Segmented options={TF_OPTIONS} value={tf} onChange={setTf} />
      </div>
    </section>
  );
}
