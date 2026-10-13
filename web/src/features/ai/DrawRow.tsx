/**
 * Hàng tuỳ chọn của lớp ✏️ Vẽ: chọn công cụ (đường ngang / hộp), sửa ghi chú + xoá hình đang chọn, xoá hết.
 * Hình lưu trên server (máy nào cũng thấy). Kéo đường ngang trên chart để dời giá.
 */
import { useEffect, useState } from "react";
import { useT } from "../../i18n/lang";
import { deleteDrawing, noteDrawing, setSelected, setTool, useDrawings, useSelected, useTool } from "../draw/drawStore";

export function DrawRow() {
  const t = useT();
  const tool = useTool();
  const drawings = useDrawings();
  const sel = useSelected();
  const d = sel?.type === "drawing" ? drawings.find((x) => x.id === sel.id) : undefined;
  const [note, setNote] = useState("");
  useEffect(() => setNote(d?.note ?? ""), [d?.id, d?.note]);

  const pick = (x: "hline" | "box") => setTool(tool === x ? null : x);
  const label = d ? (d.kind === "hline" ? `${t("Đường", "Line")} ${d.price?.toFixed(2)}` : `${t("Hộp", "Box")} ${d.p2?.toFixed(2)}–${d.p1?.toFixed(2)}`) : "";

  return (
    <div className="ai-layers ai-sdopts draw-row">
      <button type="button" aria-pressed={tool === "hline"} onClick={() => pick("hline")}>— {t("Đường ngang", "Horizontal line")}</button>
      <button type="button" aria-pressed={tool === "box"} onClick={() => pick("box")}>▭ {t("Hộp vùng", "Box")}</button>
      {tool && tool !== "alert" && (
        <span className="ai-sdsep tool-hint">
          {tool === "hline" ? t("→ bấm vào mức giá trên chart", "→ click a price on the chart") : t("→ kéo trên chart để vẽ hộp", "→ drag on the chart to draw a box")}
        </span>
      )}
      {d && (
        <span className="alert-edit">
          <span className="ai-sdsep">{t("Đang chọn:", "Selected:")} <b>{label}</b></span>
          <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú", "Note")}
            onKeyDown={(e) => e.key === "Enter" && void noteDrawing(d.id, note)} />
          <button type="button" onClick={() => void noteDrawing(d.id, note)}>{t("Lưu", "Save")}</button>
          <button type="button" className="danger" onClick={() => void deleteDrawing(d.id)}>{t("Xoá", "Delete")}</button>
          <button type="button" onClick={() => setSelected(null)} aria-label={t("Bỏ chọn", "Deselect")}>✕</button>
        </span>
      )}
      {!d && drawings.length > 0 && (
        <button type="button" className="danger" onClick={() => window.confirm(t(`Xoá hết ${drawings.length} hình đã vẽ?`, `Delete all ${drawings.length} drawings?`)) && void deleteDrawing("all")}>
          🗑 {t("Xoá hết", "Delete all")} ({drawings.length})
        </button>
      )}
      {!tool && !d && <span className="ai-sdsep">{t("Bấm vào hình để chọn · kéo đường để dời", "Click a drawing to select · drag lines to move")}</span>}
    </div>
  );
}
