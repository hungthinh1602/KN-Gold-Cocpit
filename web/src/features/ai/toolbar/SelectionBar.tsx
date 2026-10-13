/** Thanh nhỏ chỉ hiện khi đang chọn 1 hình vẽ trên chart: ghi chú + xoá. (Cảnh báo được sửa trong bảng 🔔.) */
import { useEffect, useState } from "react";
import { useT } from "../../../i18n/lang";
import { deleteDrawing, noteDrawing, setSelected, useDrawings, useSelected } from "../../draw/drawStore";

export function SelectionBar() {
  const t = useT();
  const sel = useSelected();
  const drawings = useDrawings();
  const d = sel?.type === "drawing" ? drawings.find((x) => x.id === sel.id) : undefined;
  const [note, setNote] = useState("");
  useEffect(() => setNote(d?.note ?? ""), [d?.id, d?.note]);
  if (!d) return null;

  const label = d.kind === "hline" ? `${t("Đường", "Line")} ${d.price?.toFixed(2)}` : `${t("Hộp", "Box")} ${d.p2?.toFixed(2)} – ${d.p1?.toFixed(2)}`;
  return (
    <div className="sel-bar">
      <span>{t("Đang chọn:", "Selected:")} <b className="num">{label}</b></span>
      <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú cho hình", "Note for this drawing")}
        onKeyDown={(e) => e.key === "Enter" && void noteDrawing(d.id, note)} />
      <button type="button" className="btn-gold" onClick={() => void noteDrawing(d.id, note)}>{t("Lưu", "Save")}</button>
      <button type="button" className="btn-danger" onClick={() => void deleteDrawing(d.id)}>{t("Xoá", "Delete")}</button>
      <button type="button" onClick={() => setSelected(null)}>{t("Bỏ chọn", "Deselect")}</button>
      <span className="pop-hint">{t("Kéo đường ngang để dời · phím Delete để xoá", "Drag a line to move it · press Delete to remove")}</span>
    </div>
  );
}
