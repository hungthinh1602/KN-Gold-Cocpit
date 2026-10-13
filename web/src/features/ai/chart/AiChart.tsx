/**
 * Chart nến tab AI (1500 nến của khung đang xem) + lớp phủ canvas + series lệnh/mô hình.
 * Tự lấy nến cuối & giá từ MT5 mỗi 2 giây (/api/ai/live) — phân tích vẫn quét 5 phút/lần.
 * Thao tác tay: vẽ đường ngang / hộp, bấm chart đặt cảnh báo giá, kéo đường (cảnh báo / đường ngang) để dời,
 * bấm vào hình để chọn, phím Delete để xoá hình đang chọn.
 */
import { useCallback, useEffect, useRef } from "react";
import {
  createChart, type IChartApi, type IPriceLine, type ISeriesApi, type LineStyle, type SeriesType, type UTCTimestamp,
} from "lightweight-charts";
import { api } from "../../../api/client";
import type { Candle, Formation, OrdersData, Schools, Timeframe, Wave, Zone, ZoneSet } from "../../../api/types";
import { TF_ORDER } from "../../../api/types";
import { usePolling } from "../../../hooks/usePolling";
import { useTheme, type Theme } from "../../../hooks/useTheme";
import { useLang } from "../../../i18n/lang";
import { activeSignature } from "../../orders/orders";
import { addPriceAlert, removePriceAlert, updatePriceAlert, usePriceAlerts } from "../../alerts/priceAlerts";
import {
  addDrawing, deleteDrawing, moveDrawing, refreshDrawings, setSelected, setTool, useDrawings, useSelected, useTool,
} from "../../draw/drawStore";
import { SCHOOL_LAYERS, SD_HTF, waveOn, type Layers } from "../layers";
import { drawSchool, drawSessions, drawUserShapes, drawWave, drawZones, hitShape, type Painter, type UserShape } from "./overlay";
import { addOrderSeries, addPatternSeries, closedOrderMarkers } from "./series";

const LIVE_MS = 2000;
const DRAWINGS_MS = 30_000;  // tải lại hình vẽ (để máy khác vẽ thì máy này cũng thấy)
const VIEW_BARS = 160;       // khung nhìn mặc định: ~160 nến gần nhất
const RIGHT_GAP = 15;        // + 15 nến trống bên phải
const HIT_PX = 6;            // bấm cách đường ≤ 6px là trúng

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

const CHART_COLORS: Record<Theme, { text: string; grid: string; border: string }> = {
  dark: { text: "#9aa4b2", grid: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.1)" },
  light: { text: "#5d6678", grid: "rgba(15,23,42,.06)", border: "rgba(15,23,42,.15)" },
};

const toBar = (k: Candle) => ({ time: k.t as UTCTimestamp, open: k.o, high: k.h, low: k.l, close: k.c });

/** Đổi toạ độ ⇄ thời gian/giá của chart đang hiện (dùng cho cả vẽ lẫn thao tác chuột). */
interface Geom extends Omit<Painter, "ctx"> {
  xToTime: (x: number) => number | null;
  yToPrice: (y: number) => number | null;
}

export function AiChart(props: AiChartProps) {
  const { tf, candles, formation, layers, orders, selectedOrder } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const extrasRef = useRef<ISeriesApi<SeriesType>[]>([]);
  const shownTfRef = useRef<Timeframe | null>(null);
  const lastTRef = useRef(0);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [theme] = useTheme();
  const [lang] = useLang();

  // công cụ tay (lưu server) — đọc qua ref trong hàm vẽ/thao tác
  const priceAlerts = usePriceAlerts();
  const drawings = useDrawings();
  const tool = useTool();
  const selected = useSelected();
  const alertsRef = useRef(priceAlerts);
  alertsRef.current = priceAlerts;
  const shapesRef = useRef<UserShape[]>(drawings);
  shapesRef.current = drawings;
  const selRef = useRef(selected);
  selRef.current = selected;
  const previewRef = useRef<UserShape | null>(null);
  const geomRef = useRef<Geom | null>(null);
  const alertLinesRef = useRef(new Map<string, IPriceLine>());

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
    if (!n || shownTfRef.current !== P.tf) {
      geomRef.current = null;
      return;
    }

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
    // x → thời gian (bắt vào nến; ngoài đoạn nến thì ngoại suy)
    const xToTime = (x: number): number | null => {
      const l = ts.coordinateToLogical(x);
      if (l == null) return null;
      if (l <= 0) return cds[0].t + Math.round(l) * step;
      if (l >= n - 1) return cds[n - 1].t + Math.round(l - (n - 1)) * step;
      return cds[Math.round(l)].t;
    };
    const geom: Geom = {
      tx, Y: (price) => cs.priceToCoordinate(price), W: ts.width(),
      light: document.documentElement.dataset.theme === "light", en: document.documentElement.lang === "en",
      xToTime, yToPrice: (y) => cs.coordinateToPrice(y),
    };
    geomRef.current = geom;
    const p: Painter = { ...geom, ctx };
    const L = P.layers;

    if (L.sess) {
      const idx = TF_ORDER.indexOf(P.tf);
      const vr = ts.getVisibleLogicalRange();
      const i0 = Math.min(n - 1, Math.max(0, Math.floor(vr?.from ?? 0)));
      const i1 = Math.max(i0, Math.min(n - 1, Math.ceil(vr?.to ?? n - 1)));
      drawSessions(p, cds, step, {
        bg: waveOn(L, "sessBg"), asia: waveOn(L, "sessAsia"), pd: waveOn(L, "sessPD") && idx <= TF_ORDER.indexOf("H4"),
        intraday: idx <= TF_ORDER.indexOf("H1"), off: P.orders?.mt5?.off ?? 10800,
        from: cds[i0].t, to: cds[i1].t + step,
      });
    }
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
    if (L.draw || previewRef.current) {
      const sel = selRef.current?.type === "drawing" ? selRef.current.id : null;
      drawUserShapes(p, L.draw ? shapesRef.current : [], sel, previewRef.current);
    }
  }, []);

  // ---------------------------------------------------------------- tạo chart 1 lần
  useEffect(() => {
    const chart = createChart(boxRef.current!, {
      autoSize: true,
      layout: { background: { color: "transparent" } },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: RIGHT_GAP },
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
      alertLinesRef.current.clear();
      shownTfRef.current = null;
    };
  }, [drawOverlay]);

  // ---------------------------------------------------------------- màu chữ/lưới/viền theo nền Tối/Sáng
  useEffect(() => {
    const c = CHART_COLORS[theme];
    chartRef.current?.applyOptions({
      layout: { textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      timeScale: { borderColor: c.border },
      rightPriceScale: { borderColor: c.border },
    });
  }, [theme, drawOverlay]);

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

  // ---------------------------------------------------------------- series phụ: Lệnh Live (Entry/SL/TP) + mô hình giá
  const orderSig = orders ? activeSignature(orders.orders) : "";
  const selSig = selectedOrder ? selectedOrder + (orders?.orders.find((o) => o.id === selectedOrder)?.state ?? "") : "";
  const showLevels = !!layers.order && (waveOn(layers, "ordLevels") || !!selectedOrder);   // chọn thẻ lệnh → luôn vẽ lệnh đó
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const s of extrasRef.current) chart.removeSeries(s);
    const P = propsRef.current;
    const extra: ISeriesApi<SeriesType>[] = [];
    try {
      if (showLevels && P.orders) extra.push(...addOrderSeries(chart, candles, P.orders.orders, selectedOrder, P.orders.mt5?.off ?? 0, lang === "en" ? "pending" : "chờ"));
      if (layers.pattern) extra.push(...addPatternSeries(chart, formation));
    } catch {
      /* dữ liệu vẽ lỗi → bỏ qua lớp này */
    }
    extrasRef.current = extra;
  }, [candles, formation, showLevels, layers.pattern, orderSig, selSig, selectedOrder, lang]);

  // ---------------------------------------------------------------- đường cảnh báo giá: ↑/↓ + ghi chú; đang chọn → đậm
  useEffect(() => {
    const cs = seriesRef.current;
    if (!cs) return;
    for (const l of alertLinesRef.current.values()) cs.removePriceLine(l);
    alertLinesRef.current.clear();
    for (const a of priceAlerts) {
      const sel = selected?.type === "alert" && selected.id === a.id;
      alertLinesRef.current.set(a.id, cs.createPriceLine({
        price: a.price, color: "#eab308", lineWidth: sel ? 2 : 1, lineStyle: (sel ? 0 : 2) as LineStyle, axisLabelVisible: true,
        title: `🔔${a.dir === "up" ? "↑" : "↓"}${a.note ? " " + a.note : ""}`,
      }));
    }
  }, [priceAlerts, selected]);

  // ---------------------------------------------------------------- lịch sử lệnh: ▲▼ ở nến vào, ● ở nến đóng + kết quả
  const showHist = !!layers.order && waveOn(layers, "ordHist");
  const closedSig = (orders?.orders ?? []).filter((o) => o.state === "closed").map((o) => o.id + o.status).join("|");
  useEffect(() => {
    const cs = seriesRef.current;
    if (!cs) return;
    const P = propsRef.current;
    cs.setMarkers(showHist && P.orders ? closedOrderMarkers(candles, P.orders.orders, P.orders.mt5?.off ?? 10800, lang === "en") : []);
  }, [candles, showHist, closedSig, lang]);

  // ---------------------------------------------------------------- hình vẽ: tải + tải lại định kỳ
  useEffect(() => {
    void refreshDrawings();
    const id = window.setInterval(refreshDrawings, DRAWINGS_MS);
    return () => window.clearInterval(id);
  }, []);

  // ---------------------------------------------------------------- kéo đường / chọn hình (khi không dùng công cụ)
  useEffect(() => {
    const wrap = wrapRef.current, box = boxRef.current;
    if (!wrap || !box) return;
    type Drag = { kind: "alert" | "drawing"; id: string; y0: number; moved: boolean; price: number };
    let drag: Drag | null = null;
    let block = false;              // chặn chart kéo/cuộn trong lúc đang kéo đường
    let down: { x: number; y: number } | null = null;

    const local = (e: PointerEvent | MouseEvent) => {
      const r = box.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    /** Thứ nằm dưới con trỏ: đường cảnh báo → hình vẽ (nếu lớp Vẽ đang bật). */
    const hitAt = (x: number, y: number): { kind: "alert" | "drawing"; id: string; price?: number; line: boolean } | null => {
      const g = geomRef.current;
      if (!g) return null;
      for (const a of alertsRef.current) {
        const yy = g.Y(a.price);
        if (yy != null && Math.abs(yy - y) <= HIT_PX) return { kind: "alert", id: a.id, price: a.price, line: true };
      }
      if (propsRef.current.layers.draw) {
        const s = hitShape({ ...g, ctx: null as never }, shapesRef.current, x, y);
        if (s) return { kind: "drawing", id: s.id, price: s.price, line: s.kind === "hline" };
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const { x, y } = local(e);
      down = { x, y };
      const h = hitAt(x, y);
      if (!h) return;
      e.stopPropagation();          // không cho chart nhận lần bấm này (không kéo chart)
      e.preventDefault();
      block = true;
      drag = { kind: h.kind, id: h.id, y0: y, moved: false, price: h.price ?? 0 };
      if (!h.line) drag = { ...drag, price: NaN };   // hộp: chỉ chọn, không kéo
    };
    const stopIfBlocked = (e: Event) => {
      if (block) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    /** Rê chuột (không bấm) lên đường kéo được → đổi con trỏ. */
    const onHover = (e: PointerEvent) => {
      if (drag || e.buttons !== 0) return;
      const { x, y } = local(e);
      const h = hitAt(x, y);
      wrap.style.cursor = h ? (h.line ? "ns-resize" : "pointer") : "";
    };
    /** Đang kéo đường → dời giá theo con trỏ (nghe trên window để kéo ra ngoài chart vẫn được). */
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const { y } = local(e);
      if (Number.isNaN(drag.price) || Math.abs(y - drag.y0) < 3) return;
      const pr = geomRef.current?.yToPrice(y);
      if (pr == null) return;
      drag.moved = true;
      drag.price = Math.round(pr * 100) / 100;
      if (drag.kind === "alert") alertLinesRef.current.get(drag.id)?.applyOptions({ price: drag.price });
      else {
        shapesRef.current = shapesRef.current.map((s) => (s.id === drag!.id ? { ...s, price: drag!.price } : s));
        drawOverlay();
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = drag;
      drag = null;
      window.setTimeout(() => (block = false), 0);
      const { x, y } = local(e);
      if (d) {
        if (d.moved) {
          if (d.kind === "alert") void updatePriceAlert(d.id, { price: d.price });
          else void moveDrawing(d.id, d.price);
        } else {
          setSelected({ type: d.kind, id: d.id });
        }
      } else if (down && Math.abs(x - down.x) < 3 && Math.abs(y - down.y) < 3 && selRef.current) {
        setSelected(null);          // bấm chỗ trống → bỏ chọn
      }
      down = null;
    };

    wrap.addEventListener("pointerdown", onDown, true);
    wrap.addEventListener("mousedown", stopIfBlocked, true);
    wrap.addEventListener("touchstart", stopIfBlocked, true);
    wrap.addEventListener("pointermove", onHover);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      wrap.removeEventListener("pointerdown", onDown, true);
      wrap.removeEventListener("mousedown", stopIfBlocked, true);
      wrap.removeEventListener("touchstart", stopIfBlocked, true);
      wrap.removeEventListener("pointermove", onHover);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drawOverlay]);

  // ---------------------------------------------------------------- phím Delete xoá hình/cảnh báo đang chọn, Esc bỏ công cụ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setTool(null);
        setSelected(null);
      }
      const s = selRef.current;
      if (s && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        if (s.type === "alert") void removePriceAlert(s.id);
        else void deleteDrawing(s.id);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------------------------------------------------------------- lớp công cụ: bấm đặt đường/cảnh báo, kéo vẽ hộp
  const start = useRef<{ x: number; y: number } | null>(null);
  const toolPoint = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onToolDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = toolPoint(e);
  };
  const onToolMove = (e: React.PointerEvent) => {
    const g = geomRef.current, s = start.current;
    if (tool !== "box" || !g || !s) return;
    const c = toolPoint(e);
    const t1 = g.xToTime(s.x), t2 = g.xToTime(c.x), p1 = g.yToPrice(s.y), p2 = g.yToPrice(c.y);
    previewRef.current = t1 != null && t2 != null && p1 != null && p2 != null ? { id: "preview", kind: "box", note: "", t1, t2, p1, p2 } : null;
    drawOverlay();
  };
  const onToolUp = (e: React.PointerEvent) => {
    const g = geomRef.current, s = start.current;
    start.current = null;
    previewRef.current = null;
    if (!g || !s) return;
    const c = toolPoint(e);
    const price = g.yToPrice(c.y);
    if (tool === "hline" && price != null) void addDrawing({ kind: "hline", price });
    if (tool === "alert" && price != null) void addPriceAlert(price);
    if (tool === "box" && Math.abs(c.x - s.x) > 6 && Math.abs(c.y - s.y) > 6) {
      const t1 = g.xToTime(s.x), t2 = g.xToTime(c.x), p1 = g.yToPrice(s.y), p2 = price;
      if (t1 != null && t2 != null && p1 != null && p2 != null) void addDrawing({ kind: "box", t1, t2, p1, p2 });
    }
    setTool(null);
    drawOverlay();
  };

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
    <div ref={wrapRef} className="ai-chartwrap">
      <div ref={boxRef} className="ai-chart" />
      <canvas ref={canvasRef} className="ai-ov" />
      {tool && <div className="ai-tool-layer" onPointerDown={onToolDown} onPointerMove={onToolMove} onPointerUp={onToolUp} />}
      {tool && (
        <div className="tool-hint-float">
          {tool === "box" ? (lang === "en" ? "Drag on the chart to draw a box" : "Kéo trên chart để vẽ hộp")
            : lang === "en" ? "Click a price level on the chart" : "Bấm vào mức giá trên chart"}
          <span> · Esc {lang === "en" ? "to cancel" : "để huỷ"}</span>
        </div>
      )}
    </div>
  );
}
