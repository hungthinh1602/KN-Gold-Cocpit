/**
 * Hàng tuỳ chọn của lớp 🔔 Cảnh báo giá:
 *   🎯 bấm chart để đặt · ô nhập giá + ghi chú · các mức đang chờ (↑/↓, khoảng cách tới giá, ghi chú; bấm để sửa/xoá)
 *   · bật/tắt báo giá chạm vùng của khung đang xem.
 * Kéo đường cảnh báo trên chart để dời giá.
 */
import { useState } from "react";
import type { ServerAlert } from "../../api/client";
import type { Timeframe } from "../../api/types";
import { useT } from "../../i18n/lang";
import { addPriceAlert, removePriceAlert, setZoneAlerts, updatePriceAlert, useLiveBid, usePriceAlerts, useZoneAlerts } from "../alerts/priceAlerts";
import { setSelected, setTool, useSelected, useTool } from "../draw/drawStore";

function AlertChip({ a, bid }: { a: ServerAlert; bid: number | null }) {
  const t = useT();
  const sel = useSelected();
  const editing = sel?.type === "alert" && sel.id === a.id;
  const [price, setPrice] = useState(a.price.toFixed(2));
  const [note, setNote] = useState(a.note);
  const gap = bid != null ? a.price - bid : null;

  if (!editing) {
    return (
      <button type="button" className={"alert-chip " + a.dir} onClick={() => { setPrice(a.price.toFixed(2)); setNote(a.note); setSelected({ type: "alert", id: a.id }); }}
        title={a.dir === "up" ? t("Chờ giá LÊN tới mức này", "Waiting for price to RISE to this level") : t("Chờ giá XUỐNG tới mức này", "Waiting for price to FALL to this level")}>
        {a.dir === "up" ? "↑" : "↓"} <b>{a.price.toFixed(2)}</b>
        {gap != null && <span className="gap">{t("còn", "to go")} {gap > 0 ? "+" : ""}{gap.toFixed(1)}</span>}
        {a.note && <span className="note">· {a.note}</span>}
      </button>
    );
  }
  const save = () => {
    const p = parseFloat(price.replace(",", "."));
    void updatePriceAlert(a.id, { ...(Number.isFinite(p) && p !== a.price ? { price: p } : {}), note });
    setSelected(null);
  };
  return (
    <span className="alert-edit">
      <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={t("Giá", "Price")} />
      <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú (vd đỉnh phiên Á)", "Note (e.g. Asia high)")}
        onKeyDown={(e) => e.key === "Enter" && save()} />
      <button type="button" onClick={save}>{t("Lưu", "Save")}</button>
      <button type="button" className="danger" onClick={() => { void removePriceAlert(a.id); setSelected(null); }}>{t("Xoá", "Delete")}</button>
      <button type="button" onClick={() => setSelected(null)} aria-label={t("Đóng", "Close")}>✕</button>
    </span>
  );
}

export function AlertRow({ price, tf }: { price: number | null; tf: Timeframe }) {
  const t = useT();
  const alerts = usePriceAlerts();
  const bid = useLiveBid() ?? price;
  const zoneOn = useZoneAlerts();
  const tool = useTool();
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
    <div className="ai-layers ai-sdopts alert-row">
      <button type="button" aria-pressed={tool === "alert"} onClick={() => setTool(tool === "alert" ? null : "alert")}>
        🎯 {t("Bấm chart để đặt", "Click chart to set")}
      </button>
      {tool === "alert" && <span className="ai-sdsep tool-hint">{t("→ bấm vào mức giá trên chart", "→ click a price on the chart")}</span>}
      <form className="alert-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input type="number" step="0.01" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder={bid != null ? bid.toFixed(2) : t("Giá", "Price")} aria-label={t("Mức giá cảnh báo", "Alert price")} />
        <input type="text" className="note-in" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("Ghi chú", "Note")} />
        <button type="submit">{t("+ Thêm", "+ Add")}</button>
      </form>
      {alerts.map((a) => <AlertChip key={a.id + a.price + a.note} a={a} bid={bid} />)}
      <button type="button" aria-pressed={zoneOn} onClick={() => setZoneAlerts(!zoneOn)}
        title={t("Báo khi giá đi vào vùng Cung/Cầu, vùng OTE, hoặc chạm Strong/Weak của khung đang xem", "Alert when price enters a supply/demand or OTE zone, or touches Strong/Weak on the current timeframe")}>
        {t("Báo chạm vùng", "Zone touch alerts")} · {tf}
      </button>
    </div>
  );
}
