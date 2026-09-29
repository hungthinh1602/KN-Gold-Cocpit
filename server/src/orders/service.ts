/**
 * Dịch vụ Lệnh Live: nhận tín hiệu webhook, theo dõi mỗi 2 giây bằng nến M1 + tick MT5,
 * đồng bộ lệnh MT5, lưu orders.json.
 */
import { mt5 } from "../mt5/client.js";
import { readJson, writeJson } from "../lib/store.js";
import { vnStamp } from "../lib/time.js";
import { avgEntry, mt5BarMfe, orderEvent, orderStep } from "./engine.js";
import { mt5Sync, type Mt5Status } from "./mt5sync.js";
import { parseSignal } from "./parse.js";
import { PIP_SIZE, type Order } from "./types.js";

const FILE = "orders.json";
const POLL_MS = 2000;
const PENDING_MAX_SEC = 24 * 3600;        // lệnh chờ quá 24h chưa khớp → hủy
const TICK_TIMEOUT_MS = 60_000;           // 1 vòng theo dõi kẹt quá mức này thì bỏ

const orders: Order[] = readJson<Order[]>(FILE, []);
const mt5Status: Mt5Status = { ok: false, login: null, server: "", company: "", tick: null, off: null, err: null };
export const webhookStatus: { port80: string | null; last: unknown; err: string | null } = { port80: null, last: null, err: null };

const save = () => writeJson(FILE, orders);
const isActive = (o: Order) => o.state === "pending" || o.state === "open";

/** Nhận 1 tin webhook. Trả thông báo; lỗi thì ném Error. */
export function addSignal(raw: string): string {
  const s = parseSignal(raw);
  if (s.cmd === "cancel") {                  // hủy lệnh CHỜ gần nhất cùng chỉ báo (+ cùng chiều nếu có)
    const x = [...orders].reverse().find((o) => o.state === "pending" && o.indi === s.indi && (!s.side || o.side === s.side));
    if (!x) return "không có lệnh chờ để hủy";
    x.state = "cancelled";
    x.result = "cancel";
    orderEvent(x, "CANCEL", "⛔ Hủy lệnh (tín hiệu hủy)");
    save();
    return `đã hủy lệnh ${x.id}`;
  }
  const o: Order = {
    id: `${vnStamp()}-${orders.length % 1000}`, indi: s.indi, side: s.side!, tf: s.tf, symbol: s.symbol, test: s.test,
    entries: s.entries, filled: s.entries.map(() => false), sl: s.sl, tps: s.tps, pip: s.pip,
    recv_ts: Date.now() / 1000, raw: raw.slice(0, 1000), state: "pending", fill_bar_t: null, last_t: null,
    tp_hit: 0, pip50: false, pip100: false, mfe: 0, mae: 0, cur_pip: null, result: null, close_pip: null,
    events: [], status: "", status_text: "",
  };
  orderEvent(o, "NEW", o.entries.length ? "⏳ Chờ khớp Entry" : "Lệnh thị trường");
  orders.push(o);
  save();
  return `đã nhận lệnh ${o.id}`;
}

/** Soi nến M1 cho các lệnh đang chờ/chạy. */
async function ordersTick(): Promise<boolean> {
  const active = orders.filter(isActive);
  if (!active.length) return false;
  const tk = await mt5.tick();
  const srvNow = tk.time;
  let changed = false;
  for (const o of active) {
    if (o.last_t == null) {                               // mốc bắt đầu = phút server lúc nhận lệnh
      o.last_t = srvNow - (srvNow % 60);
      if (!o.entries.length) {                            // lệnh thị trường: khớp ngay giá hiện tại
        const p = o.side === "BUY" ? tk.ask : tk.bid;
        o.entries = [Math.round(p * 100) / 100];
        o.filled = [true];
        o.state = "open";
        o.fill_bar_t = o.last_t;
        orderEvent(o, "ENTRY1", `🎯 Khớp giá thị trường ${p.toFixed(2)}`, p);
      }
      changed = true;
    }
  }
  // lấy M1 một lần, đủ dài cho lệnh cũ nhất
  const needMin = Math.min(...active.map((o) => o.last_t!));
  const bars = await mt5.rates("M1", Math.min(20000, Math.max(3, Math.floor((srvNow - needMin) / 60) + 3)));
  for (const o of active) {
    const isMt5 = o.src === "mt5";
    if (!isMt5 && o.state === "pending" && Date.now() / 1000 - o.recv_ts > PENDING_MAX_SEC) {
      o.state = "cancelled";
      o.result = "cancel";
      orderEvent(o, "CANCEL", "⛔ Hủy: quá 24 giờ chưa khớp");
      changed = true;
      continue;
    }
    if (isMt5 && o.state === "pending") continue;          // lệnh chờ MT5: khớp/hủy do MT5 báo
    for (const b of bars) {
      if (b.time < o.last_t!) continue;
      if (isMt5) {
        if (o.fill_bar_t == null || b.time >= o.fill_bar_t) changed = mt5BarMfe(o, b.high, b.low) || changed;
      } else if (orderStep(o, b.time, b.high, b.low)) {
        changed = true;
      }
      o.last_t = b.time;                                   // nến đang chạy sẽ được soi lại lần sau
      if (!isActive(o)) break;
    }
    const avg = avgEntry(o);
    if (o.state === "open" && avg) {
      const px = o.side === "BUY" ? tk.bid : tk.ask;
      o.cur_pip = Math.round((((px - avg) * (o.side === "BUY" ? 1 : -1)) / (o.pip || PIP_SIZE)) * 10) / 10;
    } else if (o.state !== "open") {
      o.cur_pip = null;
    }
  }
  return changed;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`quá ${ms / 1000}s không phản hồi`)), ms))]);

export function startOrders() {
  let lastSave = 0;
  const run = async () => {
    try {
      const ch = await withTimeout((async () => {
        const synced = await mt5Sync(orders, mt5Status);   // luôn chạy CẢ HAI bước
        const ticked = await ordersTick();
        return synced || ticked;
      })(), TICK_TIMEOUT_MS);
      if (ch || (Date.now() - lastSave > 60_000 && orders.some((o) => o.state === "open"))) {
        save();
        lastSave = Date.now();
      }
      webhookStatus.err = null;
    } catch (e) {
      webhookStatus.err = `theo dõi lệnh: ${(e as Error).message}`;
    }
    setTimeout(run, POLL_MS);                              // chạy tuần tự, không chồng vòng
  };
  run();
}

/** Dữ liệu cho GET /api/orders (giống bản Python). */
export function ordersPayload() {
  return {
    orders: orders.slice(-500).map((o) => ({ ...o, raw: null })),
    now: Date.now() / 1000, webhook: webhookStatus, pip: PIP_SIZE, mt5: { ...mt5Status },
  };
}

export function clearTestOrders() {
  const keep = orders.filter((o) => !o.test);
  orders.length = 0;
  orders.push(...keep);
  save();
}
