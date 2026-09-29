/** Thiên hướng tổng hợp: điểm, kim đo −7…+7, nhận định. */
import type { MacroData } from "../../api/types";
import { Assessment } from "./Assessment";
import { verdict } from "./drivers";

const MAX = 7;

export function BiasCard({ d }: { d: MacroData | null }) {
  const sc = d?.score ?? 0;
  const v = verdict(sc);
  return (
    <section className="master">
      <div className="mtop">
        <span className="eyebrow">Thiên hướng tổng hợp</span>
        <span className="score">{d ? `điểm ${sc > 0 ? "+" : ""}${sc.toFixed(1)}` : "—"}</span>
      </div>
      <div className="verdict" style={d ? { color: v.color } : undefined}>{d ? v.text : "Đang lấy dữ liệu…"}</div>
      <div className="meter"><div className="needle" style={{ left: `${((sc + MAX) / (2 * MAX)) * 100}%` }} /></div>
      <div className="mlab"><span className="l">◀ Vàng GIẢM</span><span className="r">Vàng TĂNG ▶</span></div>
      {d && <Assessment d={d} />}
    </section>
  );
}
