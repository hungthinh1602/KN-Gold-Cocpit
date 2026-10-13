/** Hàng tuỳ chọn của lớp 🔔 Cảnh báo giá: đặt mức giá, danh sách mức đang chờ, bật/tắt báo giá chạm vùng. */
import { useState } from "react";
import type { Timeframe } from "../../api/types";
import { useT } from "../../i18n/lang";
import { addPriceAlert, removePriceAlert, setZoneAlerts, usePriceAlerts, useZoneAlerts } from "../alerts/priceAlerts";

export function AlertRow({ price, tf }: { price: number | null; tf: Timeframe }) {
  const t = useT();
  const alerts = usePriceAlerts();
  const zoneOn = useZoneAlerts();
  const [val, setVal] = useState("");

  const add = () => {
    const v = parseFloat((val || (price != null ? price.toFixed(2) : "")).replace(",", "."));
    if (Number.isFinite(v) && v > 0) {
      addPriceAlert(v);
      setVal("");
    }
  };

  return (
    <div className="ai-layers ai-sdopts alert-row">
      <form className="alert-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input type="number" step="0.01" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder={price != null ? price.toFixed(2) : t("Giá", "Price")} aria-label={t("Mức giá cảnh báo", "Alert price")} />
        <button type="submit">{t("+ Thêm", "+ Add")}</button>
      </form>
      {alerts.map((a) => (
        <span key={a.id} className="alert-chip">
          🔔 {a.price.toFixed(2)}
          <button type="button" onClick={() => removePriceAlert(a.id)} aria-label={t("Xoá", "Remove")}>✕</button>
        </span>
      ))}
      <button type="button" aria-pressed={zoneOn} onClick={() => setZoneAlerts(!zoneOn)}
        title={t("Báo khi giá đi vào vùng Cung/Cầu, vùng OTE, hoặc chạm Strong/Weak của khung đang xem", "Alert when price enters a supply/demand or OTE zone, or touches Strong/Weak on the current timeframe")}>
        {t("Báo chạm vùng", "Zone touch alerts")} · {tf}
      </button>
    </div>
  );
}
