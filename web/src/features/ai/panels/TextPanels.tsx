/** 🧠 Bài phân tích tổng hợp (Claude hoặc tự động) + 🌐 Vĩ mô. */
import type { AiData } from "../../../api/types";

export function NarrativePanel({ d }: { d: AiData }) {
  return (
    <section className="master">
      <div className="mtop">
        <span className="eyebrow">🧠 AI phân tích tổng hợp</span>
        <span>
          {d.ai_src === "claude" ? (
            <span className="ai-badge cl">✍️ Claude phân tích · {d.ai_updated}</span>
          ) : (
            <>
              <span className="ai-badge au">⚙️ Tự động từ số liệu · quét {(d.updated || "").replace(" (VN)", "")}</span>
              {d.ai_note_old && <span className="ai-note"> (bài Claude lúc {d.ai_note_old} đã quá 4 giờ)</span>}
            </>
          )}
        </span>
      </div>
      <div className="verdict ai-text pre">{d.ai_text || "(Chưa có nhận định.)"}</div>
    </section>
  );
}

export function MacroTextPanel({ text }: { text: string }) {
  return (
    <section className="master">
      <div className="eyebrow">🌐 Vĩ mô</div>
      <div className="verdict ai-text pre">{text || "(Chưa có tóm tắt vĩ mô.)"}</div>
    </section>
  );
}
