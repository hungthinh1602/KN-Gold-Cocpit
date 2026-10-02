/**
 * Tab 🧠 AI PHÂN TÍCH: chart nhiều lớp + các khung phân tích bên dưới, Lệnh Live bên phải.
 *   /api/ai?tf=   mỗi 60 giây (bộ quét server chạy 5 phút/lần) và khi đổi khung
 *   /api/orders   mỗi 3 giây
 *   /api/ai/live  mỗi 2 giây (trong AiChart)
 */
import { useState } from "react";
import { api } from "../../api/client";
import { TIMEFRAMES, type AiData, type Candle, type OrdersData, type Timeframe } from "../../api/types";
import { px2 } from "../../lib/format";
import { usePolling } from "../../hooks/usePolling";
import { useStoredState } from "../../hooks/useStoredState";
import { useT } from "../../i18n/lang";
import { useFullscreen } from "../../hooks/useFullscreen";
import { Segmented } from "../../components/common/Segmented";
import { OrdersPanel } from "../orders/OrdersPanel";
import { AiChart } from "./chart/AiChart";
import { LayerBar } from "./LayerBar";
import type { Layers } from "./layers";
import { ClassicPattern } from "./panels/ClassicPattern";
import { LensPanel } from "./panels/LensPanel";
import { SchoolModels } from "./panels/SchoolModels";
import { StructureBox } from "./panels/StructureBox";
import { SupplyDemand } from "./panels/SupplyDemand";
import { MacroTextPanel, NarrativePanel } from "./panels/TextPanels";

const AI_MS = 60_000;
const ORDERS_MS = 3_000;
const STALE_SEC = 900;
const TF_OPTIONS = TIMEFRAMES.map((x) => ({ value: x.tf, label: x.label }));
const NO_CANDLES: Candle[] = [];

export function AiPage() {
  const t = useT();
  const fs = useFullscreen<HTMLElement>();
  const [tfPref, setTf] = useStoredState<Timeframe>("aitf", "H1");
  const [layers, setLayers] = useStoredState<Layers>("ailayers", {}, true);
  const [data, setData] = useState<AiData | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [orders, setOrders] = useState<OrdersData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  usePolling(async () => {
    try {
      setData(await api.ai(tfPref));
      setLoadErr("");
    } catch (e) {
      setLoadErr(t("Lỗi tải /api/ai: ", "Failed to load /api/ai: ") + (e as Error).message);
    }
  }, AI_MS, true, [tfPref]);

  const loadOrders = async () => setOrders(await api.orders());
  usePolling(loadOrders, ORDERS_MS);

  const selectOrder = (id: string | null) => {
    setSelected(id);
    if (id && !layers.order) setLayers({ ...layers, order: true });   // chọn lệnh → tự bật lớp Lệnh Live
  };

  const ok = data && !data.error;
  // khung đã chọn chưa có dữ liệu (vd MT5 thiếu nến) → dùng khung đầu tiên có
  const tf: Timeframe = ok && !data.tf_data[tfPref] ? data.timeframes[0] ?? "H1" : tfPref;
  const td = ok ? data.tf_data[tf] : undefined;
  const price = livePrice ?? (ok ? data.price : null);

  return (
    <div className="page-ai">
      <div className="ai-grid">
        <div className="ai-main">
          <section ref={fs.ref} className={"master ai-chartsec" + (fs.full ? " is-full" : "") + (fs.overlay ? " is-full-fixed" : "")}>
            <div className="ai-pxline">
              <span>
                {t("Giá", "Price")} <b>{px2(price)}</b> · <span>{ok ? data.killzone : ""}</span> ·{" "}
                <span>{ok && data.updated ? t("quét ", "scanned ") + data.updated.replace(" (VN)", "").slice(11) : ""}</span>
              </span>
              <button type="button" className="fs-btn" onClick={fs.toggle}
                title={fs.full ? t("Thoát toàn màn hình (Esc)", "Exit full screen (Esc)") : t("Xem chart toàn màn hình", "View chart full screen")}>
                {fs.full ? t("✕ Thoát", "✕ Exit") : t("⛶ Toàn màn hình", "⛶ Full screen")}
              </button>
            </div>
            <div className="ai-note">
              {loadErr}
              {data?.error && <>{t("Chưa có dữ liệu quét — app tự quét MT5 mỗi 5 phút, cần MT5 đang mở và đăng nhập.", "No scan data yet — the app scans MT5 every 5 minutes; MT5 must be open and logged in.")}<div className="ai-note">{data.error}</div></>}
              {ok && data.age_sec > STALE_SEC && (
                <div className="ai-note dn">
                  ⚠️ {t(`Dữ liệu phân tích đã cũ ${Math.round(data.age_sec / 60)} phút (quét lúc ${data.updated}) — bộ quét đang tự thử lại.`, `Analysis data is ${Math.round(data.age_sec / 60)} min old (scanned ${data.updated}) — the scanner is retrying.`)}
                </div>
              )}
              {ok && data.scan_err && <div className="ai-note">⚠️ {t("Lần quét gần nhất lỗi:", "Last scan failed:")} {data.scan_err} {t("(đang hiện bản cũ)", "(showing previous data)")}</div>}
            </div>
            <div className="mtop" style={{ marginTop: 8 }}>
              <span className="eyebrow">{t("🕒 Chọn khung", "🕒 Timeframe")}</span>
              <Segmented options={TF_OPTIONS} value={tf} onChange={(v) => { setTf(v); setLivePrice(null); }} />
            </div>
            <LayerBar layers={layers} tf={tf} onChange={setLayers} />
            <AiChart
              tf={tf}
              candles={td?.candles ?? NO_CANDLES}
              formation={td?.structure.formation}
              wave={ok ? data.wave[tf] : undefined}
              schools={ok ? data.school[tf] : undefined}
              zones={ok ? data.cc : {}}
              layers={layers}
              orders={orders}
              selectedOrder={selected}
              onPrice={setLivePrice}
            />
            {layers.struct && ok && <StructureBox tf={tf} wave={data.wave[tf]} formation={td?.structure.formation} />}
            {ok && <SchoolModels tf={tf} schools={data.school[tf]} layers={layers} />}
          </section>

          {ok && td && (
            <>
              <SupplyDemand tf={tf} set={data.cc[tf]} price={price} />
              <LensPanel tf={tf} data={td} />
              <ClassicPattern tf={tf} f={td.structure.formation} />
              <NarrativePanel d={data} />
              <MacroTextPanel text={data.macro} />
            </>
          )}
        </div>

        <OrdersPanel data={orders} selected={selected} onSelect={selectOrder} onCleared={loadOrders} />
      </div>
    </div>
  );
}
