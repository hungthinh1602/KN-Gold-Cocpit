/** Góc nhìn SMC / ICT / CRT của khung đang xem: nhận định, setup, tín hiệu chi tiết. */
import type { Bias, Finding, LensKey, LensSetup, TfData, Timeframe } from "../../../api/types";
import { px2 } from "../../../lib/format";
import { useStoredState } from "../../../hooks/useStoredState";
import { Segmented } from "../../../components/common/Segmented";
import { Collapsible } from "../../../components/common/Collapsible";
import { useLang, useT } from "../../../i18n/lang";

const LENS_TITLE: Record<LensKey, string> = { smc: "💧 SMC (dòng tiền)", ict: "⏱️ ICT", crt: "🕯️ CRT" };
const LENS_TITLE_EN: Record<LensKey, string> = { smc: "💧 SMC (smart money)", ict: "⏱️ ICT", crt: "🕯️ CRT" };
const LENS_OPTIONS: { value: LensKey; label: string }[] = [
  { value: "smc", label: "💧 SMC" }, { value: "ict", label: "⏱️ ICT" }, { value: "crt", label: "🕯️ CRT" },
];

export const biasArrow = (d: Bias | null | undefined) => (d === "bull" ? "🟢" : d === "bear" ? "🔴" : "🟡");
const biasCls = (d: Bias) => (d === "bull" ? "up" : d === "bear" ? "dn" : "sw");

/** Các mức của setup: [nhãn, giá] — Entry (vùng), SL, TP1, TP2. */
function setupParts(su: LensSetup): [string, string][] {
  const parts: [string, string][] = [];
  if (su.entry_low != null) {
    const range = su.entry_high != null && su.entry_high !== su.entry_low ? "–" + px2(su.entry_high) : "";
    parts.push(["Entry", px2(su.entry_low) + range]);
  }
  if (su.sl != null) parts.push(["SL", px2(su.sl)]);
  if (su.tp1 != null) parts.push(["TP1", px2(su.tp1)]);
  if (su.tp2 != null) parts.push(["TP2", px2(su.tp2)]);
  return parts;
}

function SetupBox({ su }: { su: LensSetup | null | undefined }) {
  const t = useT();
  if (!su) return <div className="ai-formation-box neutral">{t("Chưa có setup vào lệnh rõ — xem điều kiện ở phần nhận định.", "No clear trade setup — see the conditions in the analysis.")}</div>;
  return (
    <div className={"ai-formation-box " + su.dir}>
      <b>{biasArrow(su.dir)} {su.style || "Setup"}</b>
      <div style={{ marginTop: 4 }}>
        {setupParts(su).map(([k, v], i) => <span key={k}>{i > 0 && " · "}{k} <b>{v}</b></span>)}
      </div>
    </div>
  );
}

function Signals({ list }: { list: Finding[] | undefined }) {
  const t = useT();
  if (!list?.length) return <div className="ai-note">{t("Không có tín hiệu nổi bật.", "No notable signals.")}</div>;
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
  const t = useT();
  const [lang] = useLang();
  const [lens, setLens] = useStoredState<LensKey>("ailens", "smc");
  const L = data[lens] ?? {};
  return (
    <Collapsible
      id="lens"
      title={`${(lang === "en" ? LENS_TITLE_EN : LENS_TITLE)[lens]} · ${tf}`}
      extra={<Segmented options={LENS_OPTIONS} value={lens} onChange={setLens} />}
      summary={<SetupLine su={L.setup} />}
    >
      {/* note do bộ máy phân tích sinh ra (có thẻ <b> định dạng) */}
      <div className="verdict ai-text" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: L.note || "—" }} />
      <div style={{ marginTop: 8 }}><SetupBox su={L.setup} /></div>
      <div className="eyebrow" style={{ fontSize: ".76rem", marginTop: 12, display: "block" }}>{t("Tín hiệu chi tiết", "Signal details")}</div>
      <div style={{ marginTop: 4 }}><Signals list={L.signals} /></div>
    </Collapsible>
  );
}

/** 1 dòng setup khi khung đang thu gọn — giữ lại Entry/SL/TP (chart không vẽ các mức này). */
function SetupLine({ su }: { su: LensSetup | null | undefined }) {
  const t = useT();
  if (!su) return <>{t("Chưa có setup vào lệnh rõ", "No clear trade setup")}</>;
  return (
    <>
      {biasArrow(su.dir)} {su.style || "Setup"}
      {setupParts(su).map(([k, v]) => <span key={k}> · {k} <b>{v}</b></span>)}
    </>
  );
}
