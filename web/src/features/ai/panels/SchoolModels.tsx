/** Mô hình SMC / ICT / CRT đang hình thành: trạng thái, checklist, đang chờ gì, việc cần làm. */
import type { SchoolState, Schools, Timeframe } from "../../../api/types";
import { SCHOOL_LAYERS, type Layers } from "../layers";
import { useLang } from "../../../i18n/lang";

const STATE_LABEL_EN: Record<SchoolState, [string, string]> = {
  forming: ["⚪", "Forming"],
  ready: ["🟡", "Formed — watch for entry"],
  active: ["🟢", "Price in entry zone — awaiting confirmation"],
  running: ["🟢", "Running"],
  done: ["✅", "Completed"],
  fail: ["❌", "Failed"],
};

const STATE_LABEL: Record<SchoolState, [string, string]> = {
  forming: ["⚪", "Đang hình thành"],
  ready: ["🟡", "Đã hình thành — canh vào lệnh"],
  active: ["🟢", "Giá ở vùng vào — chờ xác nhận"],
  running: ["🟢", "Đang chạy"],
  done: ["✅", "Hoàn thành"],
  fail: ["❌", "Hỏng"],
};

export function SchoolModels({ tf, schools, layers }: { tf: Timeframe; schools: Schools | undefined; layers: Layers }) {
  const [lang] = useLang();
  const on = SCHOOL_LAYERS.filter((x) => layers[x.layer] && schools?.[x.key]);
  if (!on.length) return null;
  return (
    <div className="ai-schoolbox">
      {on.map((x) => {
        const m = schools![x.key]!;
        const state = m.state || "forming";
        const [icon, text] = (lang === "en" ? STATE_LABEL_EN : STATE_LABEL)[state] ?? ["⚪", ""];
        return (
          <div key={x.key} className={"sch st-" + state}>
            <div className={"sch-h " + (m.dir || "")}>
              {x.icon} {lang === "en" ? "Model" : "Mô hình"} {m.title} · {tf} <span className="sch-badge">{icon} {text}</span>
            </div>
            {(m.steps || []).map((st, i) => (
              <div key={i} className={"sch-st" + (st.ok ? " ok" : "")}>{st.ok ? "✅ " : "⬜ "}{st.text}</div>
            ))}
            {m.wait && <div className="sch-w">⏳ {m.wait}</div>}
            {m.todo && <div className="sch-todo">👉 {m.todo}</div>}
          </div>
        );
      })}
    </div>
  );
}
