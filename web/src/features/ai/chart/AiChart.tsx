/**
 * Chart nến tab AI (1500 nến của khung đang xem) + lớp phủ canvas + series lệnh/mô hình.
 * Tự lấy nến cuối & giá từ MT5 mỗi 2 giây (/api/ai/live) — phân tích vẫn quét 5 phút/lần.
 */
import { useCallback, useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type SeriesType, type UTCTimestamp } from "lightweight-charts";
import { api } from "../../../api/client";
import type { Candle, Formation, OrdersData, Schools, Timeframe, Wave, Zone, ZoneSet } from "../../../api/types";
import { TF_ORDER } from "../../../api/types";
import { usePolling } from "../../../hooks/usePolling";
import { activeSignature } from "../../orders/orders";
import { SCHOOL_LAYERS, SD_HTF, waveOn, type Layers } from "../layers";
import { drawSchool, drawWave, drawZones, type Painter } from "./overlay";
import { addOrderSeries, addPatternSeries } from "./series";

const LIVE_MS = 2000;
const VIEW_BARS = 160;     // khung nhìn mặc định: ~160 nến gần nhất
const RIGHT_GAP = 15;      // + 15 nến trống bên phải

export interface AiChartProps {
  tf: Timeframe;
  candles: Candle[];
  formation: Formation | null | undefined;
  wave: Wave | undefined;
  schools: Schools | undefined;
  zones: Partial<Record<Timeframe, ZoneSet>>;
  layers: Layers;
  orders: OrdersData | null;
  selectedOrder: string | null;
  onPrice: (bid: number) => void;
}

const toBar = (k: Candle) => ({ time: k.t as UTCTimestamp, open: k.o, high: k.h, low: k.l, close: k.c });

export function AiChart(props: AiChartProps) {
  const { tf, candles, formation, layers, orders, selectedOrder } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const extrasRef = useRef<ISeriesApi<SeriesType>[]>([]);
  const shownTfRef = useRef<Timeframe | null>(null);
  const lastTRef = useRef(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---------------------------------------------------------------- lớp phủ canvas
  const drawOverlay = useCallback(() => {
    const cv = canvasRef.current, el = boxRef.current, chart = chartRef.current, cs = seriesRef.current;
    if (!cv || !el || !chart || !cs) return;
    const P = propsRef.current;
    const r = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    cv.style.width = r.width + "px";
    cv.style.height = r.height + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const cds = P.candles, n = cds.length;
    if (!n || shownTfRef.current !== P.tf) return;

    const ts = chart.timeScale();
    const step = n > 1 ? cds[n - 1].t - cds[n - 2].t : 60;
    // thời gian → x (kể cả thời điểm ngoài đoạn nến đã tải: ngoại suy theo bước nến)
    const tx = (tm: number): number | null => {
      let idx: number;
      if (tm <= cds[0].t) idx = (tm - cds[0].t) / step;
      else if (tm >= cds[n - 1].t) idx = n - 1 + (tm - cds[n - 1].t) / step;
      else {
        let lo = 0, hi = n - 1;
        while (lo < hi) {
          const m = (lo + hi + 1) >> 1;
          if (cds[m].t <= tm) lo = m;
          else hi = m - 1;
        }
        idx = lo;
      }
      return ts.logicalToCoordinate(idx as never);
    };
    const p: Painter = { ctx, tx, Y: (price) => cs.priceToCoordinate(price), W: ts.width() };
    const L = P.layers;

    if (L.struct && P.wave) drawWave(p, P.wave, (k) => waveOn(L, k));
    for (const s of SCHOOL_LAYERS) {
      const m = P.schools?.[s.key];
      if (L[s.layer] && m?.draw) drawSchool(p, m.draw, s.key.toUpperCase());
    }
    if (L.sd) {
      const cur = TF_ORDER.indexOf(P.tf);
      const sets: { tf: Timeframe | null; zones: Zone[] }[] = SD_HTF.slice().reverse()   // khung lớn nhất vẽ trước (nằm dưới)
        .filter((h) => L[h.key] && TF_ORDER.indexOf(h.tf) > cur && P.zones[h.tf])
        .map((h) => ({ tf: h.tf, zones: P.zones[h.tf]!.zones }));
      if (P.zones[P.tf]) sets.push({ tf: null, zones: P.zones[P.tf]!.zones });
      drawZones(p, sets, !!L.sdSwept);
    }
  }, []);

  // ---------------------------------------------------------------- tạo chart 1 lần
  useEffect(() => {
    const chart = createChart(boxRef.current!, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#9aa4b2" },
      grid: { vertLines: { color: "rgba(255,255,255,.05)" }, horzLines: { color: "rgba(255,255,255,.05)" } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(255,255,255,.1)", rightOffset: RIGHT_GAP },
      rightPriceScale: { borderColor: "rgba(255,255,255,.1)" },
      crosshair: { mode: 0 },
    });
    seriesRef.current = chart.addCandlestickSeries({
      upColor: "#16a34a", downColor: "#dc2626", borderVisible: false, wickUpColor: "#16a34a", wickDownColor: "#dc2626",
    });
    chartRef.current = chart;
    chart.timeScale().subscribeVisibleLogicalRangeChange(drawOverlay);
    const ro = new ResizeObserver(() => drawOverlay());
    ro.observe(boxRef.current!);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      extrasRef.current = [];
      shownTfRef.current = null;
    };
  }, [drawOverlay]);

  // ---------------------------------------------------------------- nạp nến (giữ vùng đang xem nếu cùng khung)
  useEffect(() => {
    const chart = chartRef.current, cs = seriesRef.current;
    if (!chart || !cs) return;
    const keep = shownTfRef.current === tf ? chart.timeScale().getVisibleLogicalRange() : null;
    cs.setData(candles.map(toBar));
    const n = candles.length;
    lastTRef.current = n ? candles[n - 1].t : 0;
    shownTfRef.current = n ? tf : null;        // chưa có nến (đang tải khung mới) → lần sau đặt lại khung nhìn
    if (n) chart.timeScale().setVisibleLogicalRange(keep ?? { from: Math.max(0, n - VIEW_BARS), to: n + RIGHT_GAP });
  }, [candles, tf]);

  // ---------------------------------------------------------------- series phụ: Lệnh Live + mô hình giá
  const orderSig = orders ? activeSignature(orders.orders) : "";
  const selSig = selectedOrder ? selectedOrder + (orders?.orders.find((o) => o.id === selectedOrder)?.state ?? "") : "";
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const s of extrasRef.current) chart.removeSeries(s);
    const P = propsRef.current;
    const extra: ISeriesApi<SeriesType>[] = [];
    try {
      if (layers.order && P.orders) extra.push(...addOrderSeries(chart, candles, P.orders.orders, selectedOrder, P.orders.mt5?.off ?? 0));
      if (layers.pattern) extra.push(...addPatternSeries(chart, formation));
    } catch {
      /* dữ liệu vẽ lỗi → bỏ qua lớp này */
    }
    extrasRef.current = extra;
  }, [candles, formation, layers.order, layers.pattern, orderSig, selSig, selectedOrder]);

  // ---------------------------------------------------------------- vẽ lại lớp phủ sau mỗi lần đổi dữ liệu/lớp
  useEffect(() => {
    const id = requestAnimationFrame(drawOverlay);
    return () => cancelAnimationFrame(id);
  });

  // ---------------------------------------------------------------- nến cuối + giá trực tiếp
  usePolling(async () => {
    const d = await api.aiLive(tf);
    const cs = seriesRef.current;
    if (d.error || !cs || shownTfRef.current !== tf) return;
    for (const k of d.bars ?? []) {
      if (k.t >= lastTRef.current) {
        cs.update(toBar(k));
        lastTRef.current = k.t;
      }
    }
    if (d.bid != null) propsRef.current.onPrice(d.bid);
    drawOverlay();
  }, LIVE_MS, true, [tf]);

  return (
    <div className="ai-chartwrap">
      <div ref={boxRef} className="ai-chart" />
      <canvas ref={canvasRef} className="ai-ov" />
    </div>
  );
}
