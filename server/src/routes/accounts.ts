/** Multi-user, administration and VIP-payment API ported from the Python dashboard. */
import { Router, type Request, type Response } from "express";
import { mongo, sessionCookie, type Session } from "../db/mongo.js";

export const accountRouter = Router();
const userOf = (req: Request) => (req as Request & { account?: Session }).account;
const cookieToken = (req: Request) => (req.headers.cookie ?? "").split(";").map((x) => x.trim()).find((x) => x.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1) ?? "";
const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => { void fn(req, res).catch((e) => res.status(503).json({ error: e instanceof Error ? e.message : String(e) })); };
const requireAccount = async (req: Request, res: Response) => {
  const session = await mongo.session(cookieToken(req));
  if (!session) { res.status(401).json({ error: "Chưa đăng nhập" }); return false; }
  (req as Request & { account?: Session }).account = session;
  return true;
};
const requireAdmin = async (req: Request, res: Response) => {
  if (!await requireAccount(req, res)) return false;
  if (userOf(req)?.role !== "admin") { res.status(403).json({ error: "Không có quyền quản trị" }); return false; }
  return true;
};

accountRouter.post("/api/auth/register", asyncRoute(async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  const fullName = String(req.body?.full_name ?? username).trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    res.status(400).json({ error: "Tên đăng nhập 3–32 ký tự, email hợp lệ và mật khẩu tối thiểu 6 ký tự." }); return;
  }
  const result = await mongo.register(username, email, password, fullName);
  if (result.conflict) { res.status(409).json({ error: "Tên đăng nhập hoặc email đã được sử dụng" }); return; }
  res.status(201).json({ ok: true, message: "Đăng ký thành công" });
}));

accountRouter.post("/api/auth/login", asyncRoute(async (req, res) => {
  const login = String(req.body?.login ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!login || !password) { res.status(400).json({ error: "Thiếu thông tin đăng nhập" }); return; }
  const result = await mongo.login(login, password, Boolean(req.body?.remember));
  if (!result.ok) { res.status(result.forbidden ? 403 : 401).json({ error: result.error }); return; }
  res.cookie(sessionCookie, result.token, { maxAge: result.ttl * 1000, httpOnly: true, sameSite: "lax", path: "/" });
  res.json({ ok: true, user: result.user });
}));

accountRouter.post("/api/auth/logout", asyncRoute(async (req, res) => {
  await mongo.logout(cookieToken(req));
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: "lax", path: "/" });
  res.json({ ok: true });
}));

accountRouter.get("/api/auth/me", asyncRoute(async (req, res) => {
  const session = await mongo.session(cookieToken(req));
  if (!session) { res.status(401).json({ error: "Chưa đăng nhập" }); return; }
  res.json({ ok: true, username: session.username, role: session.role });
}));

accountRouter.get("/api/db/status", asyncRoute(async (_req, res) => { res.json(await mongo.ping()); }));

accountRouter.get("/api/users", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const page = Number(req.query.page ?? 1), perPage = Number(req.query.per_page ?? 50);
  res.json(await mongo.users(page, perPage, String(req.query.search ?? ""), String(req.query.vip ?? ""), String(req.query.status ?? "")));
}));

accountRouter.post("/api/users", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const data = req.body as Record<string, unknown>;
  const username = String(data?.username ?? "").trim();
  if (!username) { res.status(400).json({ error: "Thiếu username" }); return; }
  if (data.password && String(data.password).length < 6) { res.status(400).json({ error: "Mật khẩu tối thiểu 6 ký tự" }); return; }
  if (!data.password && !(await mongo.findUser(username))) { res.status(400).json({ error: "Tài khoản mới cần mật khẩu" }); return; }
  await mongo.updateUser({ ...data, username });
  res.json({ ok: true });
}));

accountRouter.post("/api/users/status", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const username = String(req.body?.username ?? "").trim(), status = String(req.body?.status ?? "");
  if (!username || !["active", "banned", "pending"].includes(status)) { res.status(400).json({ error: "Tham số không hợp lệ" }); return; }
  const ok = await mongo.updateStatus(username, status as "active" | "banned" | "pending");
  if (!ok) { res.status(404).json({ error: "Không tìm thấy tài khoản" }); return; }
  res.json({ ok });
}));

accountRouter.post("/api/users/delete", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const username = String(req.body?.username ?? "").trim();
  if (!username) { res.status(400).json({ error: "Thiếu username" }); return; }
  if (username === userOf(req)?.username) { res.status(400).json({ error: "Không thể xóa tài khoản đang đăng nhập" }); return; }
  await mongo.deleteUser(username);
  res.json({ ok: true });
}));

accountRouter.get("/api/admin/stats", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  res.json(await mongo.stats());
}));

accountRouter.get("/api/permissions", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const username = String(req.query.username ?? "").trim();
  res.json(username ? await mongo.permissionGet(username) : await mongo.permissionList());
}));
accountRouter.post("/api/permissions", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const username = String(req.body?.username ?? "").trim();
  if (!username || !req.body?.permissions || typeof req.body.permissions !== "object") { res.status(400).json({ error: "Thiếu username hoặc permissions" }); return; }
  await mongo.permissionSet(username, req.body.permissions as Record<string, unknown>);
  res.json({ ok: true });
}));
accountRouter.get("/api/webhook-configs", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  res.json({ configs: await mongo.webhookConfigs() });
}));
accountRouter.post("/api/webhook-configs", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const name = String(req.body?.name ?? "default").trim();
  await mongo.saveWebhookConfig(name, req.body as Record<string, unknown>);
  res.json({ ok: true });
}));
accountRouter.get("/api/ib-configs", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  res.json({ configs: await mongo.ibConfigs() });
}));
accountRouter.post("/api/ib-configs", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  await mongo.saveIbConfig(req.body as Record<string, unknown>);
  res.json({ ok: true });
}));

accountRouter.post("/api/vip/submit", asyncRoute(async (req, res) => {
  if (!await requireAccount(req, res)) return;
  const user = userOf(req)!;
  const method = String(req.body?.method ?? "vietqr");
  const payment = await mongo.submitPayment(user.username, String(req.body?.plan ?? ""), method, String(req.body?.tx_hash ?? ""));
  res.status(201).json({ ok: true, payment_id: payment.payment_id, amount_vnd: payment.amount_vnd, message: "Đã ghi nhận yêu cầu. Quản trị viên sẽ xác nhận sau khi đối soát." });
}));

accountRouter.get("/api/vip/my-payments", asyncRoute(async (req, res) => {
  if (!await requireAccount(req, res)) return;
  res.json({ payments: await mongo.paymentsFor(userOf(req)!.username) });
}));

accountRouter.get("/api/vip/payments", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  res.json(await mongo.payments(Number(req.query.page ?? 1), Number(req.query.per_page ?? 50)));
}));

accountRouter.post("/api/vip/update-status", asyncRoute(async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const paymentId = String(req.body?.payment_id ?? "").trim(), status = String(req.body?.status ?? "");
  if (!paymentId || !["pending", "confirmed", "rejected"].includes(status)) { res.status(400).json({ error: "Tham số không hợp lệ" }); return; }
  const ok = await mongo.updatePayment(paymentId, status, String(req.body?.note ?? "").slice(0, 500));
  if (!ok) { res.status(404).json({ error: "Không tìm thấy giao dịch" }); return; }
  res.json({ ok });
}));
