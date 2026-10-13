/**
 * Thanh điều khiển chart (2 hàng):
 *   Hàng 1: giá · killzone | chọn khung (▲▼) | công cụ: đường ngang, hộp, đặt cảnh báo, danh sách cảnh báo, xoá hình, toàn màn hình
 *   Hàng 2: nút lớp (bấm = bật/tắt, ▾ = tuỳ chọn con)
 *   (+ thanh sửa hình đang chọn — chỉ hiện khi có hình được chọn)
 */
import { useEffect, useState } from "react";
import { IconBellPlus, IconBellRinging, IconEraser, IconMaximize, IconMinimize, IconMinus, IconSquare } from "@tabler/icons-react";
import type { AiData, Timeframe } from "../../../api/types";
import { px2 } from "../../../lib/format";
import { useT } from "../../../i18n/lang";
import { Popover } from "../../../components/common/Popover";
import { usePriceAlerts } from "../../alerts/priceAlerts";
import { deleteDrawing, setTool, useDrawings, useSelected, useTool, type Tool } from "../../draw/drawStore";
import { TfSelector } from "../TfSelector";
import type { Layers } from "../layers";
import { AlertsPanel } from "./AlertsPanel";
import { LayerChips } from "./LayerChips";
import { SelectionBar } from "./SelectionBar";

export function ChartToolbar({ data, tf, price, layers, onTf, onLayers, full, onFull }: {
  data: AiData | null; tf: Timeframe; price: number | null; layers: Layers;
  onTf: (tf: Timeframe) => void; onLayers: (l: Layers) => void; full: boolean; onFull: () => void;
}) {
  const t = useT();
  const tool = useTool();
  const alerts = usePriceAlerts();
  const drawings = useDrawings();
  const sel = useSelected();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const ok = !!data && !data.error;

  // bấm vào 1 đường cảnh báo trên chart → mở bảng cảnh báo để sửa
  useEffect(() => {
    if (sel?.type === "alert") setAlertsOpen(true);
  }, [sel]);

  /** Chọn công cụ vẽ → tự bật lớp Hình vẽ để thấy kết quả. */
  const pickTool = (x: Exclude<Tool, null>) => {
    setTool(tool === x ? null : x);
    if ((x === "hline" || x === "box") && !layers.draw) onLayers({ ...layers, draw: true });
  };
  const erase = () => {
    if (sel?.type === "drawing") void deleteDrawing(sel.id);
    else if (drawings.length && window.confirm(t(`Xoá hết ${drawings.length} hình đã vẽ?`, `Delete all ${drawings.length} drawings?`))) void deleteDrawing("all");
  };

  return (
    <div className="chart-toolbar">
      <div className="ctb-row">
        <span className="ctb-px" title={ok && data.updated ? t("Quét lúc ", "Scanned at ") + data.updated : ""}>
          <b className="num">{px2(price)}</b>
          {ok && <span className="ctb-kz">{data.killzone}</span>}
        </span>
        <span className="ctb-spacer" />
        <TfSelector tf={tf} wave={ok ? data.wave : undefined} onChange={onTf} />
        <span className="ctb-sep" />
        <button type="button" className={"tool-btn" + (tool === "hline" ? " on" : "")} data-tip={t("Kẻ đường ngang", "Horizontal line")} aria-label={t("Kẻ đường ngang", "Horizontal line")} onClick={() => pickTool("hline")}>
          <IconMinus size={18} stroke={1.75} />
        </button>
        <button type="button" className={"tool-btn" + (tool === "box" ? " on" : "")} data-tip={t("Vẽ hộp vùng", "Draw box")} aria-label={t("Vẽ hộp vùng", "Draw box")} onClick={() => pickTool("box")}>
          <IconSquare size={17} stroke={1.75} />
        </button>
        <button type="button" className={"tool-btn" + (tool === "alert" ? " on" : "")} data-tip={t("Bấm chart để đặt cảnh báo", "Click chart to set alert")} aria-label={t("Đặt cảnh báo giá", "Set price alert")} onClick={() => pickTool("alert")}>
          <IconBellPlus size={18} stroke={1.75} />
        </button>
        <span className="pop-anchor">
          <button type="button" className={"tool-btn" + (alertsOpen ? " on" : "")} data-tip={t("Cảnh báo đang chờ", "Pending alerts")} aria-label={t("Cảnh báo đang chờ", "Pending alerts")} onClick={() => setAlertsOpen(!alertsOpen)}>
            <IconBellRinging size={18} stroke={1.75} />{alerts.length > 0 && <span className="tool-cnt num">{alerts.length}</span>}
          </button>
          <Popover open={alertsOpen} onClose={() => setAlertsOpen(false)} align="right" className="wide">
            <AlertsPanel price={price} tf={tf} />
          </Popover>
        </span>
        <button type="button" className="tool-btn" data-tip={sel?.type === "drawing" ? t("Xoá hình đang chọn", "Delete selected drawing") : t("Xoá hết hình vẽ", "Delete all drawings")}
          aria-label={t("Xoá hình vẽ", "Delete drawings")} onClick={erase}>
          <IconEraser size={18} stroke={1.75} />
        </button>
        <button type="button" className="tool-btn" data-tip={full ? t("Thoát toàn màn hình (Esc)", "Exit full screen (Esc)") : t("Toàn màn hình", "Full screen")}
          aria-label={t("Toàn màn hình", "Full screen")} onClick={onFull}>
          {full ? <IconMinimize size={18} stroke={1.75} /> : <IconMaximize size={18} stroke={1.75} />}
        </button>
      </div>
      <LayerChips layers={layers} tf={tf} onChange={onLayers} />
      <SelectionBar />
    </div>
  );
}
