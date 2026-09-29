/** 🧱 Cấu trúc (dưới chart, chỉ khi bật lớp Cấu trúc): sóng chính + nội bộ, Strong/Weak, mô hình giá. */
import type { Formation, Timeframe, Wave, WaveLayer } from "../../../api/types";
import { px2 } from "../../../lib/format";

function Part({ L, name }: { L: WaveLayer | undefined; name: string }) {
  if (!L) return null;
  const up = L.trend === 1;
  return (
    <>
      <span className={"pill " + (up ? "up" : "dn")}>{name}: {up ? "TĂNG ▲" : "GIẢM ▼"}</span>{" "}
      <span className="ai-z">{up ? "Strong Low " : "Strong High "}{px2(L.strong)}</span>{" "}
      <span className="ai-z">{up ? "Weak High " : "Weak Low "}{px2(L.weak)}</span>{" "}
      <span className="ai-note">· hồi {L.valid ? "hợp lệ" : "chưa"} · {L.event}</span>
    </>
  );
}

export function StructureBox({ tf, wave, formation }: { tf: Timeframe; wave: Wave | undefined; formation: Formation | null | undefined }) {
  return (
    <div className="ai-structbox">
      <div className="eyebrow">🧱 Cấu trúc</div>
      <div>
        {wave && <><Part L={wave.E} name={"Sóng chính " + tf} /><br /><Part L={wave.I} name="Nội bộ" /></>}
        {formation && <span className="ai-note"> · MH giá: {formation.name.split(" (")[0]} {formation.completion}%</span>}
      </div>
    </div>
  );
}
