/**
 * Chọn khung + tổng quan xu hướng 9 khung: mỗi nút có ▲ xanh (tăng) / ▼ đỏ (giảm) theo Cấu trúc sóng chính
 * của khung đó. Bấm nút = chuyển chart sang khung đó.
 */
import { TIMEFRAMES, type Timeframe, type Wave } from "../../api/types";
import { useT } from "../../i18n/lang";

export function TfSelector({ tf, onChange, wave }: {
  tf: Timeframe; onChange: (tf: Timeframe) => void; wave: Partial<Record<Timeframe, Wave>> | undefined;
}) {
  const t = useT();
  const trendOf = (x: Timeframe) => wave?.[x]?.E?.trend ?? 0;

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
    </div>
  );
}
