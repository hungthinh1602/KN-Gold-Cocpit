/** Thiên hướng tổng hợp: điểm, kim đo −7…+7, nhận định. */
import type { MacroData } from "../../api/types";
import { useT } from "../../i18n/lang";
import { Assessment } from "./Assessment";
import { verdict } from "./drivers";

const MAX = 7;

export function BiasCard({ d }: { d: MacroData | null }) {
  const t = useT();
  const sc = d?.score ?? 0;
  const v = verdict(sc, t);
  return (
    <section className="master">
      <div className="mtop">
        <span className="eyebrow">{t("Thiên hướng tổng hợp", "Overall bias")}</span>
        <span className="score">{d ? `${t("điểm", "score")} ${sc > 0 ? "+" : ""}${sc.toFixed(1)}` : "—"}</span>
      </div>
      <div className="verdict" style={d ? { color: v.color } : undefined}>{d ? v.text : t("Đang lấy dữ liệu…", "Loading data…")}</div>
      <div className="meter"><div className="needle" style={{ left: `${((sc + MAX) / (2 * MAX)) * 100}%` }} /></div>
      <div className="mlab">
        <span className="l">{t("◀ Vàng GIẢM", "◀ Gold DOWN")}</span>
        <span className="r">{t("Vàng TĂNG ▶", "Gold UP ▶")}</span>
      </div>
      {d && <Assessment d={d} />}
    </section>
  );
}
