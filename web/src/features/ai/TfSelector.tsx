/**
 * Chọn khung + tổng quan xu hướng 9 khung: mỗi nút có ▲ xanh (tăng) / ▼ đỏ (giảm) theo Cấu trúc sóng chính
 * của khung đó, kèm dòng đồng thuận (vd "6/9 khung GIẢM"). Bấm nút = chuyển chart sang khung đó.
 */
import { TIMEFRAMES, type Timeframe, type Wave } from "../../api/types";
import { useT } from "../../i18n/lang";

export function TfSelector({ tf, onChange, wave }: {
  tf: Timeframe; onChange: (tf: Timeframe) => void; wave: Partial<Record<Timeframe, Wave>> | undefined;
}) {
  const t = useT();
  const trendOf = (x: Timeframe) => wave?.[x]?.E?.trend ?? 0;
  const ups = TIMEFRAMES.filter((x) => trendOf(x.tf) === 1).length;
  const downs = TIMEFRAMES.filter((x) => trendOf(x.tf) === -1).length;
  const known = ups + downs;
  const lead = ups > downs ? { n: ups, cls: "up", w: t("TĂNG", "UP") } : downs > ups ? { n: downs, cls: "dn", w: t("GIẢM", "DOWN") } : null;

  return (
    <div className="tf-sel-wrap">
      <span className="tfsel tf-trend" role="group" aria-label={t("Chọn khung", "Timeframe")}>
        {TIMEFRAMES.map((x) => {
          const tr = trendOf(x.tf);
          const name = tr === 1 ? t("tăng", "up") : tr === -1 ? t("giảm", "down") : t("chưa rõ", "unclear");
          return (
            <button key={x.tf} type="button" aria-pressed={x.tf === tf} onClick={() => onChange(x.tf)}
              title={`${x.label}: ${t("cấu trúc sóng chính", "main swing structure")} ${name}`}>
              {x.label}
              <i className={tr === 1 ? "up" : tr === -1 ? "dn" : "na"}>{tr === 1 ? "▲" : tr === -1 ? "▼" : "•"}</i>
            </button>
          );
        })}
      </span>
      {known > 0 && (
        <span className="tf-consensus">
          {lead ? <><b className={lead.cls}>{lead.n}/{TIMEFRAMES.length}</b> {t("khung", "TFs")} <b className={lead.cls}>{lead.w}</b></> : t("Các khung đang chia đôi", "Timeframes are split")}
        </span>
      )}
    </div>
  );
}
