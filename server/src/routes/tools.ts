/**
 * Công cụ chart (sau lớp đăng nhập):
 *   GET  /api/alerts                cảnh báo giá đang chờ + các lần đã chạm gần đây + giá hiện tại
 *   POST /api/alerts                thêm {price, note}
 *   POST /api/alerts/update         sửa {id, price?, note?}
 *   POST /api/alerts/delete         xoá {id}
 *   GET  /api/drawings              hình vẽ tay
 *   POST /api/drawings              thêm {kind: "hline", price} | {kind: "box", t1, t2, p1, p2}
 *   POST /api/drawings/update       sửa {id, price?, note?}
 *   POST /api/drawings/delete       xoá {id} (id = "all" → xoá hết)
 */
import express, { Router, type Request, type Response } from "express";
import {
  addAlert, addDrawing, alertsPayload, deleteAlert, deleteDrawing, drawingsPayload, updateAlert, updateDrawing,
} from "../tools/service.js";

export const toolsRouter = Router();
const json = express.json({ limit: "10kb" });

/** Bọc xử lý: lỗi dữ liệu → 400, không thấy → 404. */
const handle = (fn: (body: Record<string, unknown>) => unknown) => async (req: Request, res: Response) => {
  try {
    const out = await fn((req.body ?? {}) as Record<string, unknown>);
    if (out === false) res.status(404).json({ error: "không tìm thấy" });
    else res.json({ ok: true, item: out === true ? undefined : out });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

toolsRouter.get("/alerts", (_req, res) => res.json(alertsPayload()));
toolsRouter.post("/alerts", json, handle((b) => addAlert(b.price, b.note)));
toolsRouter.post("/alerts/update", json, handle((b) => updateAlert(String(b.id ?? ""), { price: b.price, note: b.note })));
toolsRouter.post("/alerts/delete", json, handle((b) => deleteAlert(String(b.id ?? ""))));

toolsRouter.get("/drawings", (_req, res) => res.json(drawingsPayload()));
toolsRouter.post("/drawings", json, handle((b) => addDrawing(b)));
toolsRouter.post("/drawings/update", json, handle((b) => updateDrawing(String(b.id ?? ""), { price: b.price, note: b.note })));
toolsRouter.post("/drawings/delete", json, handle((b) => deleteDrawing(String(b.id ?? ""))));
