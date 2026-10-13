/**
 * Tab 🧠 AI PHÂN TÍCH: thanh điều khiển 2 hàng + chart nhiều lớp + giải thích các lớp đang bật,
 * tab phân tích bên dưới, Lệnh Live bên phải.
 *   /api/ai?tf=   mỗi 60 giây (bộ quét server chạy 5 phút/lần) và khi đổi khung
 *   /api/orders   do App tải (mỗi 3 giây, dùng chung cho thông báo lệnh)
 *   /api/ai/live  mỗi 2 giây (trong AiChart)
 */
import { useState } from "react";
import { api } from "../../api/client";
import type { AiData, Candle, OrdersData, Timeframe } from "../../api/types";
import { usePolling } from "../../hooks/usePolling";
import { useStoredState } from "../../hooks/useStoredState";
import { useT } from "../../i18n/lang";
import { useFullscreen } from "../../hooks/useFullscreen";
import { OrdersPanel } from "../orders/OrdersPanel";
import { AiChart } from "./chart/AiChart";
import { ChartToolbar } from "./toolbar/ChartToolbar";
import { AnalysisTabs } from "./AnalysisTabs";
import type { Layers } from "./layers";
import { SchoolModels } from "./panels/SchoolModels";
import { StructureBox } from "./panels/StructureBox";

const AI_MS = 60_000;
const STALE_SEC = 900;
const NO_CANDLES: Candle[] = [];

export function AiPage({ orders, reloadOrders }: { orders: OrdersData | null; reloadOrders: () => Promise<void> }) {
  const t = useT();
  const fs = useFullscreen<HTMLElement>();
  const [tfPref, setTf] = useStoredState<Timeframe>("aitf", "H1");
  const [layers, setLayers] = useStoredState<Layers>("ailayers", {}, true);
  const [data, setData] = useState<AiData | null>(null);
  const [loadErr, setLoadErr] = useState("");
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
            <ChartToolbar data={data} tf={tf} price={price} layers={layers} onLayers={setLayers}
              onTf={(v) => { setTf(v); setLivePrice(null); }} full={fs.full} onFull={fs.toggle} />
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

          {ok && td && <AnalysisTabs data={data} td={td} tf={tf} price={price} />}
        </div>

        <OrdersPanel data={orders} selected={selected} onSelect={selectOrder} onCleared={reloadOrders} />
      </div>
    </div>
  );
}
