/**
 * Khoá web: có mật khẩu (web_password.txt / GOLD_WEB_PASS) → bắt đăng nhập, cookie nhớ 30 ngày.
 * Không có mật khẩu → mở tự do (máy dev).
 * Riêng /api/ai* chấp nhận header X-AI-Key (khóa đẩy bài phân tích từ chat).
 */
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { mongo, sessionCookie } from "../db/mongo.js";
import { LOGIN_PAGE } from "./loginPage.js";
import { ACCOUNT_PAGE } from "./accountPage.js";

const COOKIE = "kn_auth";
const DAYS = 30;

const token = (pw: string) => crypto.createHash("sha256").update("kn-gold|" + pw).digest("hex");

function cookieOf(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export function aiKeyOk(req: Request): boolean {
  const key = config.aiPushKey();
  // originalUrl: đường dẫn đầy đủ (trong router /api thì req.path đã bị cắt mất "/api")
  return Boolean(key) && req.originalUrl.startsWith("/api/ai") && req.get("X-AI-Key") === key;
}

export async function isAuthed(req: Request): Promise<boolean> {
  const pw = config.webPassword();
  if (aiKeyOk(req)) return true;
  if (!pw && !mongo.configured) return true;
  if (pw && cookieOf(req, COOKIE) === token(pw)) return true;
  const accountToken = cookieOf(req, sessionCookie);
  if (accountToken && await mongo.session(accountToken)) return true;
  return false;
}

const loginHtml = (err = "") => LOGIN_PAGE.replace("__ERR__", err ? `<div class="err">${err}</div>` : "");

/** Middleware: chặn khi chưa đăng nhập (API trả 401, trang trả form đăng nhập). */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  void isAuthed(req).then((ok) => {
    if (ok) return next();
    if (req.path.startsWith("/api/")) res.status(mongo.configured && !mongo.ready ? 503 : 401).json({ error: mongo.configured && !mongo.ready ? mongo.error : "Chưa đăng nhập" });
    else if (mongo.configured) res.redirect(302, "/auth");
    else res.type("html").send(loginHtml());
  }).catch(next);
}

export function accountPage(_req: Request, res: Response) { res.type("html").send(ACCOUNT_PAGE); }

/** POST /login — form đăng nhập. Sai mật khẩu chờ 1.5s (chống dò). */
export async function loginHandler(req: Request, res: Response) {
  const pw = config.webPassword();
  if (pw && req.body?.pw === pw) {
    res.setHeader("Set-Cookie", `${COOKIE}=${token(pw)}; Max-Age=${DAYS * 86400}; Path=/; HttpOnly; SameSite=Lax`);
    res.redirect(303, "/");
    return;
  }
  await new Promise((r) => setTimeout(r, 1500));
  res.status(401).type("html").send(loginHtml("Sai mật khẩu"));
}
