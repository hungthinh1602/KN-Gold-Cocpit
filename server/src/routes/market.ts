/**
 * API thị trường (giai đoạn 1 — chứng minh đường dữ liệu MT5 → bridge → Node → React).
 *   GET /api/health           trạng thái MT5
 *   GET /api/candles?tf=H1    nến của 1 khung
 *   GET /api/tick             giá hiện tại
 */
import { Router } from "express";
import { mt5 } from "../mt5/client.js";
import { TIMEFRAMES, type Timeframe } from "../mt5/types.js";

export const marketRouter = Router();

marketRouter.get("/health", async (_req, res) => {
  try {
    res.json(await mt5.health());
  } catch (e) {
    res.status(503).json({ ok: false, error: (e as Error).message });
  }
});

marketRouter.get("/candles", async (req, res) => {
  const tf = String(req.query.tf ?? "H1").toUpperCase() as Timeframe;
  if (!TIMEFRAMES.includes(tf)) {
    res.status(400).json({ error: `tf không hợp lệ: ${tf}` });
    return;
  }
  try {
    res.json({ tf, bars: await mt5.rates(tf) });
  } catch (e) {
    res.status(503).json({ error: (e as Error).message });
  }
});

marketRouter.get("/tick", async (_req, res) => {
  try {
    res.json(await mt5.tick());
  } catch (e) {
    res.status(503).json({ error: (e as Error).message });
  }
});
