/** 🧱 Cấu trúc (dưới chart, chỉ khi bật lớp Cấu trúc): sóng chính + nội bộ, Strong/Weak, mô hình giá. */
import type { Formation, Timeframe, Wave, WaveLayer } from "../../../api/types";
import { px2 } from "../../../lib/format";
import { useT } from "../../../i18n/lang";

function Part({ L, name }: { L: WaveLayer | undefined; name: string }) {
  const t = useT();
  if (!L) return null;
  const up = L.trend === 1;
  return (
    <>
      <span className={"pill " + (up ? "up" : "dn")}>{name}: {up ? t("TĂNG ▲", "UP ▲") : t("GIẢM ▼", "DOWN ▼")}</span>{" "}
      <span className="ai-z">{up ? "Strong Low " : "Strong High "}{px2(L.strong)}</span>{" "}
      <span className="ai-z">{up ? "Weak High " : "Weak Low "}{px2(L.weak)}</span>{" "}
      <span className="ai-note">· {t("hồi", "pullback")} {L.valid ? t("hợp lệ", "valid") : t("chưa", "not yet")} · {L.event}</span>
    </>
  );
}

export function StructureBox({ tf, wave, formation }: { tf: Timeframe; wave: Wave | undefined; formation: Formation | null | undefined }) {
  const t = useT();
  return (
    <div className="ai-structbox">
      <div className="eyebrow">{t("🧱 Cấu trúc", "🧱 Structure")}</div>
      <div>
        {wave && <><Part L={wave.E} name={t("Sóng chính ", "Main swing ") + tf} /><br /><Part L={wave.I} name={t("Nội bộ", "Internal")} /></>}
        {formation && <span className="ai-note"> · {t("MH giá:", "Pattern:")} {formation.name.split(" (")[0]} {formation.completion}%</span>}
      </div>
    </div>
  );
}
