/** Nhật ký lệnh: ô ghi chú (lý do vào lệnh, bài học) — lưu trên server, ai đăng nhập cũng xem được. */
import { useState } from "react";
import type { Order } from "../../api/types";
import { api } from "../../api/client";
import { vnTime } from "../../lib/format";
import { useT } from "../../i18n/lang";

export function OrderNote({ o, onSaved }: { o: Order; onSaved: () => void }) {
  const t = useT();
  const [text, setText] = useState(o.note ?? "");
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const dirty = text.trim() !== (o.note ?? "").trim();

  const save = async () => {
    setState("saving");
    try {
      const r = await api.saveOrderNote(o.id, text);
      if (r.error) throw new Error(r.error);
      setState("saved");
      onSaved();
    } catch {
      setState("error");
    }
  };

  return (
    // bấm vào vùng ghi chú không làm thu gọn thẻ lệnh
    <div className="lo-note" onClick={(e) => e.stopPropagation()}>
      <label className="lo-note-lb">📝 {t("Nhật ký lệnh", "Trade journal")}</label>
      <textarea value={text} maxLength={2000} rows={3} onChange={(e) => { setText(e.target.value); setState(""); }}
        placeholder={t("Lý do vào lệnh, cảm xúc, bài học…", "Why you entered, emotions, lessons…")} />
      <div className="lo-note-bar">
        <span className="lo-note-st">
          {state === "saving" ? t("Đang lưu…", "Saving…")
            : state === "saved" ? t("✓ Đã lưu", "✓ Saved")
            : state === "error" ? <span className="dn">{t("Lưu lỗi — thử lại", "Save failed — retry")}</span>
            : o.note_ts ? `${t("Sửa lúc", "Edited")} ${vnTime(o.note_ts)}` : ""}
        </span>
        <button type="button" className="ai-btn sm" disabled={!dirty || state === "saving"} onClick={save}>{t("Lưu ghi chú", "Save note")}</button>
      </div>
    </div>
  );
}
