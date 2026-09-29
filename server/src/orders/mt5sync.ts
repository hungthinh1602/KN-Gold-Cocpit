/**
 * Đồng bộ lệnh anh TỰ ĐẶT trên MT5 (XAUUSD, có đủ SL + TP) vào danh sách Lệnh Live — CHỈ ĐỌC.
 * Trạng thái theo đúng MT5: chờ khớp → khớp (vị thế xuất hiện) → đóng (deal: reason 5 = TP, 4 = SL, khác = đóng tay)
 * hoặc hủy (lệnh chờ biến mất, không có deal).
 */
import { mt5 } from "../mt5/client.js";
import { orderEvent } from "./engine.js";
import { PIP_SIZE, type Order } from "./types.js";

const PENDING_TYPES: Record<number, ["BUY" | "SELL", string]> = {
  2: ["BUY", "Buy Limit"], 3: ["SELL", "Sell Limit"], 4: ["BUY", "Buy Stop"],
  5: ["SELL", "Sell Stop"], 6: ["BUY", "Buy Stop Limit"], 7: ["SELL", "Sell Stop Limit"],
};

export interface Mt5Status {
  ok: boolean;
  login: number | null;
  server: string;
  company: string;
  tick: number | null;   // giờ thật của tick cuối (epoch giây)
  off: number | null;    // giờ server MT5 − giờ thật (giây), GTC = +10800
  err: string | null;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const f2 = (x: number) => x.toFixed(2);

function newOrder(ticket: number, side: "BUY" | "SELL", kind: string, entry: number, sl: number, tp: number,
  volume: number, comment: string, ts: number, state: "pending" | "open", symbol: string): Order {
  return {
    id: `mt5-${ticket}`, src: "mt5", ticket, kind, indi: `MT5 · ${kind}`, side, tf: "", symbol, test: false,
    entries: [r2(entry)], filled: [state === "open"], sl: sl ? r2(sl) : null, tps: tp ? [r2(tp)] : [], pip: PIP_SIZE,
    volume, comment: comment ?? "", recv_ts: ts, raw: null, state, fill_bar_t: null, last_t: null, tp_hit: 0,
    pip50: false, pip100: false, mfe: 0, mae: 0, cur_pip: null, result: null, close_pip: null,
    events: [], status: "", status_text: "",
  };
}

function setStatus(o: Order, code: string, text: string, price: number | null = null) {
  orderEvent(o, code, text, price);
  o._st = [code, text];
}

/** Anh sửa SL/TP/Entry trên MT5 → cập nhật + ghi sự kiện (trạng thái chính giữ nguyên). */
function syncLevels(o: Order, sl: number, tp: number, entry?: number): boolean {
  let ch = false;
  const nsl = sl ? r2(sl) : null;
  const ntp = tp ? r2(tp) : null;
  if (entry != null && r2(entry) !== o.entries[0]) {
    orderEvent(o, "EDIT", `✏️ Sửa Entry → ${f2(entry)}`);
    o.entries[0] = r2(entry);
    ch = true;
  }
  if (nsl !== o.sl) {
    orderEvent(o, "EDIT", `✏️ Dời SL → ${nsl ? f2(nsl) : "bỏ SL"}`);
    o.sl = nsl;
    ch = true;
  }
  if ((o.tps[0] ?? null) !== ntp) {
    orderEvent(o, "EDIT", `✏️ Dời TP → ${ntp ? f2(ntp) : "bỏ TP"}`);
    o.tps = ntp ? [ntp] : [];
    ch = true;
  }
  if (ch && o._st) [o.status, o.status_text] = o._st;
  return ch;
}

/** Cập nhật `status` (trạng thái MT5) và danh sách `orders` (thêm/sửa lệnh MT5). Trả true nếu có thay đổi. */
export async function mt5Sync(orders: Order[], status: Mt5Status): Promise<boolean> {
  let h;
  try {
    h = await mt5.health();
  } catch (e) {
    Object.assign(status, { ok: false, login: null, err: (e as Error).message });
    return false;
  }
  const now = Date.now() / 1000;
  let off = status.off;
  if (h.tick_time && (off == null || Math.abs(now - h.tick_time + off) < 120)) {
    off = Math.round((h.tick_time - now) / 1800) * 1800;     // giờ server MT5 lệch giờ thật (múi giờ)
  }
  Object.assign(status, {
    ok: h.connected, login: h.login, server: h.server, company: h.company,
    tick: h.tick_time ? h.tick_time - (off ?? 0) : null, off, err: null,
  });
  const o0 = off ?? 0;
  const symbol = h.symbol ?? "XAUUSD";
  const known = new Map(orders.filter((o) => o.src === "mt5" && (o.state === "pending" || o.state === "open"))
    .map((o) => [o.ticket!, o]));
  const seen = new Set<number>();
  let changed = false;

  for (const od of await mt5.orders()) {
    const pt = PENDING_TYPES[od.type];
    if (!pt) continue;
    const [side, kind] = pt;
    let o = known.get(od.ticket);
    if (!o) {
      if (!(od.sl && od.tp)) continue;                      // chỉ lấy lệnh có đủ Entry/SL/TP
      o = newOrder(od.ticket, side, kind, od.price_open, od.sl, od.tp, od.volume, od.comment, od.time_setup - o0, "pending", symbol);
      setStatus(o, "NEW", `⏳ Chờ khớp (${kind} ${od.volume.toFixed(2)} lot)`);
      orders.push(o);
      changed = true;
    } else {
      changed = syncLevels(o, od.sl, od.tp, od.price_open) || changed;
    }
    seen.add(od.ticket);
  }

  for (const ps of await mt5.positions()) {
    const side = ps.type === 0 ? "BUY" : "SELL";
    let o = known.get(ps.ticket);
    if (!o) {
      if (!(ps.sl && ps.tp)) continue;
      o = newOrder(ps.ticket, side, "Market", ps.price_open, ps.sl, ps.tp, ps.volume, ps.comment, ps.time - o0, "open", symbol);
      o.fill_bar_t = o.last_t = ps.time - (ps.time % 60);
      setStatus(o, "ENTRY1", `🎯 Đang chạy · vào ${f2(ps.price_open)} (${ps.volume.toFixed(2)} lot)`, ps.price_open);
      orders.push(o);
      changed = true;
    } else {
      if (o.state === "pending") {                           // lệnh chờ vừa khớp
        o.state = "open";
        o.filled = [true];
        o.entries = [r2(ps.price_open)];
        o.fill_bar_t = o.last_t = ps.time - (ps.time % 60);
        setStatus(o, "ENTRY1", `🎯 Khớp Entry ${f2(ps.price_open)}`, ps.price_open);
        changed = true;
      }
      changed = syncLevels(o, ps.sl, ps.tp) || changed;
    }
    o.profit = r2(ps.profit);
    seen.add(ps.ticket);
  }

  for (const [ticket, o] of known) {                        // lệnh biến mất khỏi MT5 → xem lịch sử
    if (seen.has(ticket)) continue;
    const deals = await mt5.deals(ticket);
    const outs = deals.filter((d) => d.entry === 1 || d.entry === 3);
    if (outs.length) {
      const d = outs[outs.length - 1];
      const ins = deals.find((x) => x.entry === 0);
      if (ins) o.entries = [r2(ins.price)];
      o.state = "closed";
      o.filled = [true];
      const sgn = o.side === "BUY" ? 1 : -1;
      o.close_pip = Math.round(((d.price - o.entries[0]) * sgn / PIP_SIZE) * 10) / 10;
      o.profit = r2(deals.reduce((s, x) => s + x.profit + x.swap + x.commission, 0));
      let txt: string;
      let win: boolean;
      if (d.reason === 5) {
        o.tp_hit = 1;
        txt = "✅ Đạt TP - Đóng lệnh";
        win = true;
      } else if (d.reason === 4) {
        txt = "❌ Dính SL - Đóng lệnh";
        win = o.pip100;
      } else {
        txt = `🔒 Đóng tay ${f2(d.price)} (${o.close_pip >= 0 ? "+" : ""}${o.close_pip.toFixed(0)} pip)`;
        win = o.close_pip > 0 || o.pip100;
      }
      o.result = win ? "win" : "loss";
      setStatus(o, d.reason === 5 ? "TP" : d.reason === 4 ? "SL" : "CLOSE", txt, d.price);
      o.cur_pip = null;
      changed = true;
    } else if (o.state === "pending" && !deals.length) {
      o.state = "cancelled";
      o.result = "cancel";
      setStatus(o, "CANCEL", "⛔ Lệnh chờ đã hủy / hết hạn");
      changed = true;
    }
    // còn lại: vừa khớp/đóng nhưng lịch sử chưa kịp về → đợi vòng sau
  }
  return changed;
}
