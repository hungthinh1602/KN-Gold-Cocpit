/** 🧠 Bài phân tích tổng hợp (chuyên sâu hoặc tự động) + 🌐 Vĩ mô — dàn trang bằng NarrativeBody. */
import type { AiData } from "../../../api/types";
import { NarrativeBody } from "./NarrativeBody";
import { useT } from "../../../i18n/lang";

/** "2026-10-02 17:41:02 (VN)" → "17:41 · 02/10" */
function shortStamp(s: string | undefined) {
  const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  return m ? `${m[4]}:${m[5]} · ${m[3]}/${m[2]}` : s || "";
}

export function NarrativePanel({ d }: { d: AiData }) {
  const t = useT();
  return (
    <section className="master">
      <div className="mtop">
        <span className="eyebrow">{t("🧠 AI phân tích tổng hợp", "🧠 AI market summary")}</span>
        {d.ai_src === "claude"
          ? <span className="ai-badge cl">✍️ {t("Phân tích chuyên sâu", "In-depth analysis")} · {d.ai_updated}</span>
          : <span className="ai-badge au">⚙️ {t("Tự động · cập nhật", "Auto · updated")} {shortStamp(d.updated)}</span>}
      </div>
      <NarrativeBody text={d.ai_text || ""} empty={t("(Chưa có nhận định.)", "(No analysis yet.)")} />
    </section>
  );
}

export function MacroTextPanel({ text }: { text: string }) {
  const t = useT();
  return (
    <section className="master">
      <div className="eyebrow">{t("🌐 Vĩ mô", "🌐 Macro")}</div>
      <NarrativeBody text={text || ""} empty={t("(Chưa có tóm tắt vĩ mô.)", "(No macro summary yet.)")} />
    </section>
  );
}
