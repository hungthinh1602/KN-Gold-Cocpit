/**
 * Các series phụ trên chart (không phải canvas): đường Entry/SL/TP + vùng lời/lỗ của Lệnh Live,
 * đường mô hình giá cổ điển. Trả về danh sách series để gỡ khi vẽ lại.
 */
import type { IChartApi, ISeriesApi, LineStyle, SeriesType, UTCTimestamp } from "lightweight-charts";
import type { Candle, Formation, Order } from "../../../api/types";

type AnySeries = ISeriesApi<SeriesType>;
const T = (t: number) => t as UTCTimestamp;

/** Thời gian bất kỳ → thời gian nến gần nhất phía trước (kẹp trong đoạn nến đã tải). */
function snapper(cds: Candle[]) {
  const n = cds.length;
  return (tm: number): number => {
    if (tm <= cds[0].t) return cds[0].t;
    if (tm >= cds[n - 1].t) return cds[n - 1].t;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (cds[m].t <= tm) lo = m;
      else hi = m - 1;
    }
    return cds[lo].t;
  };
}

/**
 * Lệnh đang chọn (có vùng lời/lỗ) — hoặc nếu không chọn: mọi lệnh đang chạy/chờ.
 * Chỉ vẽ trong khoảng thời gian của lệnh (từ lúc nhận tới lúc đóng). `off` = giờ server MT5 − giờ thật.
 */
export function addOrderSeries(chart: IChartApi, cds: Candle[], orders: Order[], selectedId: string | null, off: number, pendingWord = "chờ"): AnySeries[] {
  if (!cds.length) return [];
  const out: AnySeries[] = [];
  const snap = snapper(cds);
  const lastT = cds[cds.length - 1].t;

  const span = (o: Order): [number, number] => {
    const a = snap(o.recv_ts + off);
    const done = o.state === "closed" || o.state === "cancelled";
    const ev = o.events || [];
    const b = done && ev.length ? snap(ev[ev.length - 1].ts + off) : lastT;
    return [a, Math.max(a, b)];
  };
  const points = (v: number, ta: number, tb: number) =>
    ta === tb ? [{ time: T(ta), value: v }] : [{ time: T(ta), value: v }, { time: T(tb), value: v }];

  const band = (base: number | null, level: number | null | undefined, col: string, ta: number, tb: number) => {
    if (base == null || level == null) return;
    const s = chart.addBaselineSeries({
      baseValue: { type: "price", price: base },
      topLineColor: "rgba(0,0,0,0)", bottomLineColor: "rgba(0,0,0,0)",
      topFillColor1: col, topFillColor2: col, bottomFillColor1: col, bottomFillColor2: col,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    });
    s.setData(points(level, ta, tb));
    out.push(s);
  };
  const seg = (price: number | null | undefined, color: string, style: LineStyle, title: string, ta: number, tb: number) => {
    if (price == null) return;
    const s = chart.addLineSeries({
      color, lineWidth: 1, lineStyle: style, lastValueVisible: true, priceLineVisible: false, crosshairMarkerVisible: false, title,
    });
    s.setData(points(price, ta, tb));
    out.push(s);
  };
  const draw = (o: Order, prefix: string) => {
    const [ta, tb] = span(o);
    const es = o.entries || [];
    const em = es.length ? es.reduce((x, y) => x + y, 0) / es.length : null;
    band(em, o.tps?.[0], "rgba(34,197,94,.16)", ta, tb);
    band(em, o.sl, "rgba(239,68,68,.16)", ta, tb);
    for (const e of es) seg(e, "#f59e0b", (o.state === "pending" ? 2 : 0) as LineStyle, prefix + "Entry", ta, tb);
    seg(o.sl, "#ef4444", 0 as LineStyle, prefix + "SL", ta, tb);
    for (const tp of o.tps || []) seg(tp, "#3b82f6", 0 as LineStyle, prefix + "TP", ta, tb);
  };

  const sel = selectedId ? orders.find((o) => o.id === selectedId) : null;
  if (sel) draw(sel, "");
  else {
    for (const o of orders) {
      if (o.state === "open" || o.state === "pending") draw(o, o.side + (o.state === "pending" ? ` ${pendingWord} ` : " "));
    }
  }
  return out;
}

/** Đường mô hình giá cổ điển (cổ, cạnh tam giác, kênh…). */
export function addPatternSeries(chart: IChartApi, fm: Formation | null | undefined): AnySeries[] {
  const out: AnySeries[] = [];
  for (const L of fm?.lines ?? []) {
    if (!L.pts || L.pts.length < 2) continue;
    const [a, b] = L.pts;
    if (a[0] >= b[0]) continue;
    const s = chart.addLineSeries({
      color: L.color || "#a855f7", lineWidth: 2, lineStyle: 0 as LineStyle,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    });
    s.setData([{ time: T(a[0]), value: a[1] }, { time: T(b[0]), value: b[1] }]);
    out.push(s);
  }
  return out;
}
