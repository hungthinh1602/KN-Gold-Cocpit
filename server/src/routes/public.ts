/**
 * Trang giới thiệu công khai (không cần đăng nhập):
 *   GET /gioi-thieu         trang giới thiệu (web/dist/landing.html)
 *   GET /api/public/home    số liệu cho trang: giá, băng giá vĩ mô, xu hướng các khung, nến M15,
 *                           thống kê + lệnh ĐÃ ĐÓNG của tín hiệu (không lộ lệnh đang chạy / chờ khớp — đó là phần VIP).
 */
import { Router } from "express";
import path from "node:path";
import { isAuthed } from "../auth/auth.js";
import { mongo } from "../db/mongo.js";
import { macro } from "../macro/service.js";
import { mt5 } from "../mt5/client.js";
import { avgEntry } from "../orders/engine.js";
import { publicClosedOrders } from "../orders/service.js";
import { PIP_SIZE, type Order } from "../orders/types.js";
import { scanCandles, scanTrends } from "../ai/service.js";

const CACHE_MS = 15_000;
const TREND_TFS = ["M15", "H1", "H4", "D1", "W1", "MN"];
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Giờ đóng lệnh (giờ thật) = sự kiện cuối. */
const closeTs = (o: Order) => o.events.at(-1)?.ts ?? o.recv_ts;

/** Mức "chốt thắng" của lệnh thắng: TP cuối đã chạm, không thì mốc +100 pip. */
function winLevel(o: Order) {
  const avg = avgEntry(o) ?? o.entries[0];
  const sgn = o.side === "BUY" ? 1 : -1;
  const pip = o.pip || PIP_SIZE;
  if (o.tp_hit > 0) {
    const tp = o.tps[o.tp_hit - 1];
    return { label: o.tp_hit === o.tps.length && o.tps.length === 1 ? "TP" : `TP${o.tp_hit}`, price: tp, pip: r1(((tp - avg) * sgn) / pip) };
  }
  return { label: "100 pip", price: r2(avg + sgn * 100 * pip), pip: 100 };
}

/** Đường giá từ lúc khớp tới lúc đóng (giá đóng nến, tối đa 40 điểm) — lấy ở khung nhỏ nhất còn đủ nến. */
function pricePath(o: Order): number[] {
  const from = o.fill_bar_t, to = o.last_t;
  if (from == null || to == null) return [];
  for (const tf of ["M5", "M15", "H1", "H4"]) {
    const cs = scanCandles(tf);
    if (!cs.length || cs[0].t > from) continue;
    const seg = cs.filter((c) => c.t >= from - 1 && c.t <= to);
    if (seg.length < 3) continue;
    const step = Math.max(1, Math.ceil(seg.length / 40));
    const pts = seg.filter((_, i) => i % step === 0).map((c) => c.c);
    pts.push(seg.at(-1)!.c);
    return pts;
  }
  return [];
}

const card = (o: Order) => {
  const w = o.result === "win" ? winLevel(o) : null;
  return {
    side: o.side, name: o.indi || `Tín hiệu ${o.tf}`, tf: o.tf,
    entry: r2(avgEntry(o) ?? o.entries[0]), sl: o.sl, ts: o.recv_ts, close_ts: closeTs(o),
    result: o.result, close_pip: o.close_pip,
    win: w,
  };
};

let cache: { at: number; body: Record<string, unknown> } | null = null;

async function build() {
  const closed = publicClosedOrders().slice().sort((a, b) => closeTs(b) - closeTs(a));
  const now = Date.now() / 1000;
  const in30 = closed.filter((o) => o.recv_ts >= now - 30 * 86400);
  const win = in30.filter((o) => o.result === "win").length;
  const loss = in30.length - win;
  const in7 = closed.filter((o) => o.recv_ts >= now - 7 * 86400);
  const wins = closed.filter((o) => o.result === "win").slice(0, 8).map((o) => ({ ...card(o), path: pricePath(o) }));

  const tick = await mt5.tick().catch(() => null);
  const gold = macro.gold as { value?: number; pct?: number } | null;
  const tape = Object.values(macro.drivers).filter((d) => d.ok && d.value != null).map((d) => ({ name: d.name, value: d.value, pct: d.pct }));
  const next = macro.calendar.find((e) => e.impact === "High" && e.ts * 1000 > Date.now());

  return {
    price: tick?.bid ?? gold?.value ?? null,
    pct: gold?.pct ?? null,
    tape,
    next: next ? { title: next.title, ts: next.ts } : null,
    trends: scanTrends(TREND_TFS),
    candles: scanCandles("M15").slice(-80),
    stats: {
      total: in30.length, win, loss, winrate: win + loss ? Math.round((win * 100) / (win + loss)) : null,
      pips: r1(in30.reduce((s, o) => s + (o.close_pip ?? 0), 0)),
    },
    week: { win: in7.filter((o) => o.result === "win").length, pips: r1(in7.reduce((s, o) => s + (o.close_pip ?? 0), 0)) },
    wins,
    recent: closed.slice(0, 6).map(card),
  };
}

export function publicRouter(webDist: string) {
  const r = Router();
  r.get("/gioi-thieu", (_req, res) => res.sendFile(path.join(webDist, "landing.html")));
  r.get("/api/public/home", async (req, res) => {
    try {
      if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), body: await build() };
      const login = mongo.configured ? "/auth" : "/dang-nhap";
      res.json({ ...cache.body, authed: await isAuthed(req), links: { login, register: login } });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
  return r;
}
