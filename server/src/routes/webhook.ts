/**
 * Webhook TradingView → Lệnh Live.  POST /webhook?token=<tv_webhook_token.txt>
 * (TradingView không gửi được header nên khoá nằm trên URL.) Thân tin: JSON hoặc chữ tự do.
 */
import express, { Router } from "express";
import { config } from "../config.js";
import { addSignal, webhookStatus } from "../orders/service.js";

export const webhookRouter = Router();

webhookRouter.post("/webhook", express.text({ type: "*/*", limit: "20kb" }), async (req, res) => {
  const tok = config.tvToken();
  if (!tok || req.query.token !== tok) {
    await new Promise((r) => setTimeout(r, 1000));
    res.status(401).json({ error: "sai token" });
    return;
  }
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? "");
  try {
    const msg = addSignal(raw);
    webhookStatus.last = { ts: Date.now() / 1000, ok: true, msg };
    res.json({ ok: true, msg });
  } catch (e) {
    webhookStatus.last = { ts: Date.now() / 1000, ok: false, msg: (e as Error).message, raw: raw.slice(0, 300) };
    res.status(400).json({ error: (e as Error).message });
  }
});
