/**
 * Dịch vụ Lệnh Live: nhận tín hiệu webhook, theo dõi mỗi 2 giây bằng nến M1 + tick MT5,
 * đồng bộ lệnh MT5, lưu orders.json.
 */
import { mt5 } from "../mt5/client.js";
import { readJson, writeJson } from "../lib/store.js";
import { vnStamp } from "../lib/time.js";
import { avgEntry, mt5BarMfe, orderEvent, orderStep } from "./engine.js";
import { mt5Sync, type Mt5Status } from "./mt5sync.js";
import { knRank, parseKn, parseSignal, type KnEvent, type KnMessage } from "./parse.js";
import { PIP_SIZE, type Order } from "./types.js";
import { mongo } from "../db/mongo.js";

const FILE = "orders.json";
const POLL_MS = 2000;
const PENDING_MAX_SEC = 24 * 3600;        // lệnh chờ quá 24h chưa khớp → hủy
const TICK_TIMEOUT_MS = 60_000;           // 1 vòng theo dõi kẹt quá mức này thì bỏ

const orders: Order[] = readJson<Order[]>(FILE, []);
const mt5Status: Mt5Status = { ok: false, login: null, server: "", company: "", tick: null, off: null, err: null };
export const webhookStatus: { port80: string | null; last: unknown; err: string | null } = { port80: null, last: null, err: null };

const save = () => {
  writeJson(FILE, orders);
  if (mongo.configured) void mongo.ordersSave(orders as unknown as Record<string, unknown>[]).catch((e) => console.warn(`[mongo] order sync: ${(e as Error).message}`));
};
const isActive = (o: Order) => o.state === "pending" || o.state === "open";

// ───────────────  LỆNH THEO TIN TRADINGVIEW (chỉ báo KN: tin có mã setup, KHÔNG dùng giá MT5)  ───────────────
const KN_BUFFER_SEC = 600;                                        // tin sự kiện tới TRƯỚC setup: giữ tối đa 10 phút
const knBuffer = new Map<string, { ts: number; ev: KnEvent }[]>();   // mã lệnh → tin đang chờ setup

const r1 = (x: number) => Math.round(x * 10) / 10;
const f2 = (x: number) => x.toFixed(2);

/** Áp 1 tin sự kiện vào lệnh feed. Trả true nếu lệnh đổi (tin trùng/muộn → false). */
function applyKnEvent(o: Order, ev: KnEvent, ts: number): boolean {
  if (!isActive(o)) return false;                                   // lệnh đã đóng/hủy → bỏ tin muộn
  const sgn = o.side === "BUY" ? 1 : -1;
  const pip = o.pip || PIP_SIZE;
  const note = (code: string, text: string, price: number | null = null) => {
    orderEvent(o, code, text, price);
    o.events[o.events.length - 1].ts = ts;                          // giờ nhận tin (tin chờ setup giữ giờ tới thật)
  };
  const ensureFilled = () => {                                      // tin sau Entry tới trước tin "Khớp Entry" → coi như đã khớp
    if (o.filled[0]) return;
    o.filled[0] = true;
    o.state = "open";
    note("ENTRY1", `🎯 Khớp Entry ${f2(o.entries[0])}`, o.entries[0]);
  };
  const entry = o.entries[0];
  switch (ev.kind) {
    case "entry":
      if (o.filled[0]) return false;
      ensureFilled();
      return true;
    case "pip":
      if (o.ms?.includes(ev.pip)) return false;
      ensureFilled();
      o.ms = [...(o.ms ?? []), ev.pip].sort((a, b) => a - b);
      o.mfe = Math.max(o.mfe, ev.pip);
      if (ev.pip >= 50) o.pip50 = true;
      if (ev.pip >= 100) o.pip100 = true;
      note(`PIP${ev.pip}`, `💰 Đạt +${ev.pip} pip`, ev.price);
      return true;
    case "win":
      if (o.win) return false;
      ensureFilled();
      o.win = true;
      o.win_pip = ev.pip;
      o.mfe = Math.max(o.mfe, ev.pip);
      if (ev.pip >= 100) o.pip100 = true;
      note("WIN", `🏆 Đạt +${ev.pip} pip (thắng)`);
      return true;
    case "tp": {
      ensureFilled();
      const px = ev.price ?? o.tps[0];
      o.state = "closed";
      o.result = "win";
      o.tp_hit = o.tps.length;
      o.close_pip = r1(((px - entry) * sgn) / pip);
      note("TP", "✅ Đạt TP - Đóng lệnh", px);
      return true;
    }
    case "sl": {
      ensureFilled();
      const px = ev.price ?? o.sl!;
      o.state = "closed";
      o.result = o.win ? "win" : "loss";
      o.close_pip = r1(((px - entry) * sgn) / pip);
      note("SL", "❌ Dính SL - Đóng lệnh", px);
      return true;
    }
    case "cancel":
      if (o.state !== "pending") return false;                      // đã khớp thì không còn hủy chờ
      o.state = "cancelled";
      o.result = "cancel";
      o.why = ev.why;
      note("CANCEL", "⛔ Hủy");                                      // chỉ chữ "Hủy" — không hiện lý do
      return true;
    case "hide":
      if (o.state !== "open") return false;
      o.state = "closed";
      o.result = o.win ? "win" : "cancel";
      o.close_pip = o.win ? (o.win_pip ?? 100) : null;
      note("HIDE", "🙈 Ẩn lệnh — đã thắng, giá quay đầu sâu");
      return true;
  }
}

/** Nhận 1 tin có mã setup: setup → tạo lệnh; sự kiện → ghép vào đúng lệnh (chưa có setup thì giữ chờ). */
function handleKn(m: KnMessage, raw: string, test: boolean): string {
  const uid = `${m.indi}|${m.side}|${m.sid}`;
  const now = Date.now() / 1000;
  const cur = orders.find((o) => o.uid === uid);
  if (m.setup) {
    if (cur) return `đã có lệnh ${cur.id} (tin gửi lại — bỏ qua)`;
    const st = m.setup;
    const o: Order = {
      id: `${vnStamp()}-${orders.length % 1000}`, indi: m.indi, side: m.side, tf: m.tf, symbol: m.symbol, test,
      entries: [st.entry], filled: [false], sl: st.sl, tps: [st.tp], pip: PIP_SIZE,
      recv_ts: now, raw: raw.slice(0, 1000), state: "pending", fill_bar_t: null, last_t: null,
      tp_hit: 0, pip50: false, pip100: false, mfe: 0, mae: 0, cur_pip: null, result: null, close_pip: null,
      events: [], status: "", status_text: "", feed: "tv", uid, ms: [],
    };
    orderEvent(o, "NEW", "⏳ Chờ khớp Entry");
    orders.push(o);
    const early = knBuffer.get(uid) ?? [];                          // tin tới trước setup → áp theo thứ tự hợp lý
    knBuffer.delete(uid);
    early.sort((a, b) => knRank(a.ev) - knRank(b.ev) || a.ts - b.ts).forEach((b) => applyKnEvent(o, b.ev, b.ts));
    save();
    return `đã nhận lệnh ${o.id}${early.length ? ` (+${early.length} tin đến trước)` : ""}`;
  }
  const ev = m.event!;
  if (cur) {
    const ch = applyKnEvent(cur, ev, now);
    if (ch) save();
    return ch ? `đã cập nhật lệnh ${cur.id}` : `tin trùng hoặc lệnh ${cur.id} đã xong — bỏ qua`;
  }
  const q = knBuffer.get(uid) ?? [];                                // chưa có setup → giữ chờ
  q.push({ ts: now, ev });
  knBuffer.set(uid, q);
  return "chưa có setup — giữ tin chờ";
}

/** Dọn: lệnh feed chờ khớp quá 24h → hủy (phòng mất tin Hủy); bỏ tin chờ setup quá hạn. */
function expireKn(): boolean {
  const now = Date.now() / 1000;
  let ch = false;
  for (const o of orders) {
    if (o.feed === "tv" && o.state === "pending" && now - o.recv_ts > PENDING_MAX_SEC) {
      o.state = "cancelled";
      o.result = "cancel";
      o.why = "quá 24 giờ chưa có tin khớp Entry";
      orderEvent(o, "CANCEL", "⛔ Hủy");
      ch = true;
    }
  }
  for (const [k, q] of knBuffer) {
    const keep = q.filter((b) => now - b.ts <= KN_BUFFER_SEC);
    if (keep.length) knBuffer.set(k, keep);
    else knBuffer.delete(k);
  }
  return ch;
}

/** Nhận 1 tin webhook. Trả thông báo; lỗi thì ném Error. `test` = đánh dấu lệnh test (URL ?test=1). */
export function addSignal(raw: string, opts: { test?: boolean } = {}): string {
  const kn = parseKn(raw);
  if (kn) return handleKn(kn, raw, !!opts.test);
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
    id: `${vnStamp()}-${orders.length % 1000}`, indi: s.indi, side: s.side!, tf: s.tf, symbol: s.symbol, test: s.test || !!opts.test,
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

/** Soi nến M1 cho các lệnh đang chờ/chạy (KHÔNG gồm lệnh theo tin TradingView — lệnh đó chỉ đổi theo tin). */
async function ordersTick(): Promise<boolean> {
  const active = orders.filter((o) => isActive(o) && o.feed !== "tv");
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
      if (expireKn()) save();                              // dọn lệnh theo tin — không cần MT5, MT5 sập vẫn chạy
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
  const bootstrap = async () => {
    if (!mongo.configured) { run(); return; }
    try {
      const stored = await mongo.ordersLoad();
      if (stored.length) {
        orders.splice(0, orders.length, ...(stored as unknown as Order[]));
        writeJson(FILE, orders);
      } else if (orders.length) {
        await mongo.ordersSave(orders as unknown as Record<string, unknown>[]);
      }
    } catch (e) { console.warn(`[mongo] order restore: ${(e as Error).message}`); }
    run();
  };
  void bootstrap();
}

/** Dữ liệu cho GET /api/orders (giống bản Python). */
export function ordersPayload() {
  return {
    orders: orders.slice(-500).map((o) => ({ ...o, raw: null })),
    now: Date.now() / 1000, webhook: webhookStatus, pip: PIP_SIZE, mt5: { ...mt5Status },
  };
}

/** Nhật ký: ghi chú cho 1 lệnh (rỗng = xoá). Trả false nếu không có lệnh. */
export function setOrderNote(id: string, note: string): boolean {
  const o = orders.find((x) => x.id === id);
  if (!o) return false;
  const text = note.trim().slice(0, 2000);
  if (text) {
    o.note = text;
    o.note_ts = Date.now() / 1000;
  } else {
    delete o.note;
    delete o.note_ts;
  }
  save();
  return true;
}

export function clearTestOrders() {
  const keep = orders.filter((o) => !o.test);
  orders.length = 0;
  orders.push(...keep);
  save();
  if (mongo.configured) void mongo.ordersDeleteTest().catch((e) => console.warn(`[mongo] delete test orders: ${(e as Error).message}`));
}

/** Lệnh đã đóng (thắng/thua) của tín hiệu TradingView, không gồm lệnh test và lệnh MT5 cá nhân — cho trang giới thiệu công khai. */
export const publicClosedOrders = () => orders.filter((o) => !o.test && o.src !== "mt5" && (o.result === "win" || o.result === "loss"));
