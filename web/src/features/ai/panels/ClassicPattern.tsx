/** 📐 Mô hình giá cổ điển (price action) của khung đang xem. */
import type { Formation, Timeframe } from "../../../api/types";
import { px2 } from "../../../lib/format";
import { biasArrow } from "./LensPanel";

export function ClassicPattern({ tf, f }: { tf: Timeframe; f: Formation | null | undefined }) {
  return (
    <section className="master">
      <div className="eyebrow">📐 Mô hình giá cổ điển (price action)</div>
      {!f ? (
        <div className="ai-formation-box neutral">Chưa rõ mô hình giá cổ điển ở khung {tf}.</div>
      ) : (
        <div className={"ai-formation-box " + f.dir}>
          <b>{biasArrow(f.dir)} {f.name}</b> · <b>{f.completion}%</b>
          {f.confirm != null && <> · xác nhận khi phá <b>{px2(f.confirm)}</b></>}
          {f.up_break != null && <> · phá lên <b>{px2(f.up_break)}</b> / xuống <b>{px2(f.down_break)}</b></>}
          {f.invalidate != null && <> · hủy <b>{px2(f.invalidate)}</b></>}
          <div className="ai-note">{f.note}</div>
        </div>
      )}
    </section>
  );
}
