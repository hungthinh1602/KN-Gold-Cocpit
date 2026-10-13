/**
 * Bảng cảnh báo giá (mở từ nút 🔔 ở hàng công cụ chart):
 *   thêm theo giá + ghi chú · các mức đang chờ (↑/↓, khoảng cách tới giá, ghi chú; bấm để sửa/xoá) · bật/tắt báo chạm vùng.
 * Đặt nhanh: nút 🔔+ rồi bấm lên chart. Dời giá: kéo đường cảnh báo trên chart.
 */
import { useState } from "react";
import type { ServerAlert } from "../../../api/client";
import type { Timeframe } from "../../../api/types";
import { useT } from "../../../i18n/lang";
import { addPriceAlert, removePriceAlert, setZoneAlerts, updatePriceAlert, useLiveBid, usePriceAlerts, useZoneAlerts } from "../../alerts/priceAlerts";
import { setSelected, useSelected } from "../../draw/drawStore";

function AlertItem({ a, bid }: { a: ServerAlert; bid: number | null }) {
  const t = useT();
  const sel = useSelected();
  const editing = sel?.type === "alert" && sel.id === a.id;
  const [price, setPrice] = useState(a.price.toFixed(2));
  const [note, setNote] = useState(a.note);
  const gap = bid != null ? a.price - bid : null;

  if (!editing) {
    return (
      <button type="button" className={"alert-item " + a.dir} onClick={() => { setPrice(a.price.toFixed(2)); setNote(a.note); setSelected({ type: "alert", id: a.id }); }}
        title={a.dir === "up" ? t("Chờ giá LÊN tới mức này — bấm để sửa", "Waiting for price to RISE here — click to edit") : t("Chờ giá XUỐNG tới mức này — bấm để sửa", "Waiting for price to FALL here — click to edit")}>
        <b className="num">{a.dir === "up" ? "↑" : "↓"} {a.price.toFixed(2)}</b>
        <span className="gap num">{gap != null ? `${t("còn", "to go")} ${gap > 0 ? "+" : ""}${gap.toFixed(1)}` : ""}</span>
        <span className="note">{a.note}</span>
      </button>
    );
  }
  const save = () => {
    const p = parseFloat(price.replace(",", "."));
    void updatePriceAlert(a.id, { ...(Number.isFinite(p) && p !== a.price ? { price: p } : {}), note });
    setSelected(null);
  };
  return (
    <div className="alert-item editing">
      <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={t("Giá", "Price")} />
      <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú (vd đỉnh phiên Á)", "Note (e.g. Asia high)")}
        onKeyDown={(e) => e.key === "Enter" && save()} />
      <div className="row-btns">
        <button type="button" className="btn-gold" onClick={save}>{t("Lưu", "Save")}</button>
        <button type="button" className="btn-danger" onClick={() => { void removePriceAlert(a.id); setSelected(null); }}>{t("Xoá", "Delete")}</button>
        <button type="button" onClick={() => setSelected(null)}>{t("Huỷ", "Cancel")}</button>
      </div>
    </div>
  );
}

export function AlertsPanel({ price, tf }: { price: number | null; tf: Timeframe }) {
  const t = useT();
  const alerts = usePriceAlerts();
  const bid = useLiveBid() ?? price;
  const zoneOn = useZoneAlerts();
  const [val, setVal] = useState("");
  const [note, setNote] = useState("");

  const add = () => {
    const v = parseFloat((val || (bid != null ? bid.toFixed(2) : "")).replace(",", "."));
    if (Number.isFinite(v) && v > 0) {
      void addPriceAlert(v, note);
      setVal("");
      setNote("");
    }
  };

  return (
    <div className="alerts-panel">
      <div className="pop-grp">{t("Cảnh báo giá đang chờ", "Pending price alerts")}</div>
      {alerts.length ? alerts.map((a) => <AlertItem key={a.id + a.price + a.note} a={a} bid={bid} />)
        : <div className="pop-hint">{t("Chưa có cảnh báo. Bấm 🔔+ rồi bấm lên chart, hoặc nhập giá bên dưới.", "No alerts yet. Click 🔔+ then click the chart, or enter a price below.")}</div>}
      <form className="alert-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input type="number" step="0.01" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder={bid != null ? bid.toFixed(2) : t("Giá", "Price")} aria-label={t("Mức giá cảnh báo", "Alert price")} />
        <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú", "Note")} />
        <button type="submit" className="btn-gold">{t("+ Thêm", "+ Add")}</button>
      </form>
      <div className="pop-grp">{t("Tự báo", "Automatic alerts")}</div>
      <label className="check">
        <input type="checkbox" checked={zoneOn} onChange={() => setZoneAlerts(!zoneOn)} />
        {t("Báo khi giá vào vùng Cung/Cầu, OTE, chạm Strong/Weak", "Alert when price enters supply/demand, OTE, or hits Strong/Weak")} · {tf}
      </label>
      <div className="pop-hint">{t("Mẹo: kéo đường cảnh báo trên chart để dời giá. Server canh giá 24/7.", "Tip: drag an alert line on the chart to move it. The server watches 24/7.")}</div>
    </div>
  );
}
