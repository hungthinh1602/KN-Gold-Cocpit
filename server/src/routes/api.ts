/**
 * API chính (đều sau lớp đăng nhập):
 *   GET  /api/data                 vĩ mô: giá vàng, 5 yếu tố, điểm, lịch kinh tế, tin
 *   GET  /api/orders               Lệnh Live + trạng thái MT5
 *   POST /api/orders/clear-test    xóa lệnh test
 *   POST /api/orders/note          nhật ký: ghi chú cho 1 lệnh {id, note}
 *   GET  /api/ai/levels?tf=        vùng/mức của 1 khung cho cảnh báo giá chạm vùng
 *   POST /api/ai/note              Claude đẩy bài phân tích {ai_text, macro} (header X-AI-Key)
 */
import express, { Router } from "express";
import { aiKeyOk } from "../auth/auth.js";
import { writeJson } from "../lib/store.js";
import { macro } from "../macro/service.js";
import { clearTestOrders, ordersPayload, setOrderNote } from "../orders/service.js";
import { aiLevels, aiLive, aiPayload } from "../ai/service.js";
import { mongo } from "../db/mongo.js";

export const apiRouter = Router();

apiRouter.get("/data", (_req, res) => res.json(macro));

apiRouter.get("/orders", (_req, res) => res.json(ordersPayload()));

apiRouter.post("/orders/clear-test", (_req, res) => {
  clearTestOrders();
  res.json({ ok: true });
});

apiRouter.post("/orders/note", express.json({ limit: "20kb" }), (req, res) => {
  const id = String(req.body?.id ?? "");
  if (!id) {
    res.status(400).json({ error: "thiếu id lệnh" });
    return;
  }
  if (!setOrderNote(id, String(req.body?.note ?? ""))) {
    res.status(404).json({ error: "không có lệnh này" });
    return;
  }
  res.json({ ok: true });
});

apiRouter.get("/ai/levels", (req, res) => res.json(aiLevels(String(req.query.tf ?? "H1").toUpperCase())));

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
  const note = { ai_text: aiText, macro: String(req.body?.macro ?? ""), ts: Date.now() / 1000 };
  writeJson("ai_note.json", note);
  if (mongo.configured) void mongo.noteSave(note).catch((e) => console.warn(`[mongo] AI note sync: ${(e as Error).message}`));
  res.json({ ok: true });
});
