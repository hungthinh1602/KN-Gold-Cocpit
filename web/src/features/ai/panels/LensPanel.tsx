/** Góc nhìn SMC / ICT / CRT của khung đang xem: nhận định, setup, tín hiệu chi tiết. */
import type { Bias, Finding, LensKey, LensSetup, TfData, Timeframe } from "../../../api/types";
import { px2 } from "../../../lib/format";
import { useStoredState } from "../../../hooks/useStoredState";
import { Segmented } from "../../../components/common/Segmented";

const LENS_TITLE: Record<LensKey, string> = { smc: "💧 SMC (dòng tiền)", ict: "⏱️ ICT", crt: "🕯️ CRT" };
const LENS_OPTIONS: { value: LensKey; label: string }[] = [
  { value: "smc", label: "💧 SMC" }, { value: "ict", label: "⏱️ ICT" }, { value: "crt", label: "🕯️ CRT" },
];

export const biasArrow = (d: Bias | null | undefined) => (d === "bull" ? "🟢" : d === "bear" ? "🔴" : "🟡");
const biasCls = (d: Bias) => (d === "bull" ? "up" : d === "bear" ? "dn" : "sw");

function SetupBox({ su }: { su: LensSetup | null | undefined }) {
  if (!su) return <div className="ai-formation-box neutral">Chưa có setup vào lệnh rõ — xem điều kiện ở phần nhận định.</div>;
  const parts: [string, string][] = [];
  if (su.entry_low != null) {
    const range = su.entry_high != null && su.entry_high !== su.entry_low ? "–" + px2(su.entry_high) : "";
    parts.push(["Entry", px2(su.entry_low) + range]);
  }
  if (su.sl != null) parts.push(["SL", px2(su.sl)]);
  if (su.tp1 != null) parts.push(["TP1", px2(su.tp1)]);
  if (su.tp2 != null) parts.push(["TP2", px2(su.tp2)]);
  return (
    <div className={"ai-formation-box " + su.dir}>
      <b>{biasArrow(su.dir)} {su.style || "Setup"}</b>
      <div style={{ marginTop: 4 }}>
        {parts.map(([k, v], i) => <span key={k}>{i > 0 && " · "}{k} <b>{v}</b></span>)}
      </div>
    </div>
  );
}

function Signals({ list }: { list: Finding[] | undefined }) {
  if (!list?.length) return <div className="ai-note">Không có tín hiệu nổi bật.</div>;
  return (
    <>
      {list.map((p, i) => {
        const zone = p.low != null && p.high != null ? `${px2(p.low)}–${px2(p.high)}` : p.level != null ? px2(p.level) : "";
        return (
          <div key={i} className="ai-pat">
            <span className={"pill " + biasCls(p.dir)}>{p.group || p.kind || ""}</span> <b>{p.name}</b> <span className="ai-z">{zone}</span>
            {p.note && <div className="ai-note">{p.note}</div>}
          </div>
        );
      })}
    </>
  );
}

export function LensPanel({ tf, data }: { tf: Timeframe; data: TfData }) {
  const [lens, setLens] = useStoredState<LensKey>("ailens", "smc");
  const L = data[lens] ?? {};
  return (
    <section className="master">
      <div className="mtop">
        <span className="eyebrow">{LENS_TITLE[lens]} · {tf}</span>
        <Segmented options={LENS_OPTIONS} value={lens} onChange={setLens} />
      </div>
      {/* note do bộ máy phân tích sinh ra (có thẻ <b> định dạng) */}
      <div className="verdict ai-text" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: L.note || "—" }} />
      <div style={{ marginTop: 8 }}><SetupBox su={L.setup} /></div>
      <div className="eyebrow" style={{ fontSize: ".76rem", marginTop: 12, display: "block" }}>Tín hiệu chi tiết</div>
      <div style={{ marginTop: 4 }}><Signals list={L.signals} /></div>
    </section>
  );
}
