/**
 * API chính (đều sau lớp đăng nhập):
 *   GET  /api/data                 vĩ mô: giá vàng, 5 yếu tố, điểm, lịch kinh tế, tin
 *   GET  /api/orders               Lệnh Live + trạng thái MT5
 *   POST /api/orders/clear-test    xóa lệnh test
 *   POST /api/ai/note              Claude đẩy bài phân tích {ai_text, macro} (header X-AI-Key)
 */
import express, { Router } from "express";
import { aiKeyOk } from "../auth/auth.js";
import { writeJson } from "../lib/store.js";
import { macro } from "../macro/service.js";
import { clearTestOrders, ordersPayload } from "../orders/service.js";
import { aiLive, aiPayload } from "../ai/service.js";

export const apiRouter = Router();

apiRouter.get("/data", (_req, res) => res.json(macro));

apiRouter.get("/orders", (_req, res) => res.json(ordersPayload()));

apiRouter.post("/orders/clear-test", (_req, res) => {
  clearTestOrders();
  res.json({ ok: true });
});

apiRouter.get("/ai/live", async (req, res) => {
  try {
    res.json(await aiLive(String(req.query.tf ?? "M15").toUpperCase()));
  } catch (e) {
    res.json({ error: (e as Error).message });
  }
});

apiRouter.get("/ai", (req, res) => res.json(aiPayload(req.query.tf ? String(req.query.tf) : undefined)));

apiRouter.post("/ai/note", express.json({ limit: "200kb" }), (req, res) => {
  if (!aiKeyOk(req)) {
    res.status(401).json({ error: "sai khoá" });
    return;
  }
  const aiText = String(req.body?.ai_text ?? "");
  if (!aiText) {
    res.status(400).json({ error: "thiếu ai_text" });
    return;
  }
  writeJson("ai_note.json", { ai_text: aiText, macro: String(req.body?.macro ?? ""), ts: Date.now() / 1000 });
  res.json({ ok: true });
});
