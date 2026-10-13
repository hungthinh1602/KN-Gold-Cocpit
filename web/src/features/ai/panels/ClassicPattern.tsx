/** 📐 Mô hình giá cổ điển (price action) của khung đang xem. */
import type { Formation, Timeframe } from "../../../api/types";
import { px2 } from "../../../lib/format";
import { biasArrow } from "./LensPanel";
import { useT } from "../../../i18n/lang";

/** Nội dung tab Mô hình giá. */
export function ClassicPattern({ tf, f }: { tf: Timeframe; f: Formation | null | undefined }) {
  const t = useT();
  return (
    <>
      <div className="tab-head"><span>{t("Mô hình giá cổ điển (price action)", "Classic chart patterns (price action)")} · {tf}</span></div>
      {!f ? (
        <div className="ai-formation-box neutral">{t("Chưa rõ mô hình giá cổ điển ở khung", "No clear classic pattern on")} {tf}.</div>
      ) : (
        <div className={"ai-formation-box " + f.dir}>
          <b>{biasArrow(f.dir)} {f.name}</b> · <b>{f.completion}%</b>
          {f.confirm != null && <> · {t("xác nhận khi phá", "confirmed on break of")} <b>{px2(f.confirm)}</b></>}
          {f.up_break != null && <> · {t("phá lên", "break up")} <b>{px2(f.up_break)}</b> / {t("xuống", "down")} <b>{px2(f.down_break)}</b></>}
          {f.invalidate != null && <> · {t("hủy", "invalid at")} <b>{px2(f.invalidate)}</b></>}
          <div className="ai-note">{f.note}</div>
        </div>
      )}
    </>
  );
}
