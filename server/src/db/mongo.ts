/** MongoDB persistence ported from D:\\Gold-Dashboard\\db_mongo.py.
 * The app remains usable without a URI; account and billing endpoints report
 * that the database is unavailable until MONGODB_URI is configured.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { MongoClient, type Collection, type Db } from "mongodb";
import { config } from "../config.js";

const DB_NAME = "gold_dashboard";
const COOKIE = "kn_session";

export interface Account {
  username: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: "admin" | "member" | "vip" | "ib";
  status: "active" | "banned" | "pending";
  vip_tier?: string;
  vip_expiry?: number | null;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
}

export interface Session { username: string; role: string; token: string; expires: number }
export interface PublicAccount { username: string; role: string; full_name?: string; email?: string; vip_tier?: string; vip_expiry?: number | null }

class MongoStore {
  private client?: MongoClient;
  private db?: Db;
  private connectionError = "";
  private connecting?: Promise<void>;

  get configured() { return Boolean(config.mongoUri()); }
  get ready() { return Boolean(this.db); }
  get error() { return this.connectionError || (this.configured ? "MongoDB chưa kết nối" : "Chưa cấu hình MONGODB_URI"); }

  async connect(): Promise<void> {
    if (!this.configured || this.db) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new MongoClient(config.mongoUri(), { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, socketTimeoutMS: 15000 });
      try {
        await client.connect();
        const db = client.db(DB_NAME);
        await db.command({ ping: 1 });
        this.client = client;
        this.db = db;
        this.connectionError = "";
        await this.ensureIndexes();
        console.log(`[mongo] connected: ${DB_NAME}`);
      } catch (error) {
        await client.close().catch(() => undefined);
        this.connectionError = error instanceof Error ? error.message : String(error);
        console.warn(`[mongo] connection unavailable: ${this.connectionError}`);
      }
    })().finally(() => { this.connecting = undefined; });
    return this.connecting;
  }

  async ping() {
    await this.connect();
    if (!this.db) return { ok: false, error: this.error };
    try { await this.db.command({ ping: 1 }); return { ok: true }; }
    catch (error) { this.connectionError = error instanceof Error ? error.message : String(error); return { ok: false, error: this.error }; }
  }

  private col<T extends object>(name: string): Collection<T> {
    if (!this.db) throw new Error(this.error);
    return this.db.collection<T>(name);
  }

  private async ensureIndexes() {
    if (!this.db) return;
    await Promise.all([
      this.col("orders").createIndex({ id: 1 }, { unique: true }),
      this.col("orders").createIndex({ recv_ts: -1 }),
      this.col("ai_notes").createIndex({ _key: 1 }, { unique: true }),
      this.col("ai_notes_archive").createIndex({ ts: -1 }),
      this.col("users").createIndex({ username: 1 }, { unique: true }),
      // The legacy Python database created this as sparse but non-unique.
      this.col("users").createIndex({ email: 1 }, { sparse: true }),
      this.col("sessions").createIndex({ token: 1 }),
      this.col("sessions").createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
      this.col("vip_payments").createIndex({ username: 1 }),
      this.col("vip_payments").createIndex({ created_at: -1 }),
      this.col("permissions").createIndex({ username: 1 }, { unique: true }),
      this.col("webhook_configs").createIndex({ name: 1 }, { unique: true }),
      this.col("ib_configs").createIndex({ ib_code: 1 }, { unique: true }),
    ]).catch((error) => console.warn(`[mongo] index setup: ${error instanceof Error ? error.message : error}`));
  }

  async ordersLoad(): Promise<Record<string, unknown>[]> {
    await this.connect();
    return this.col<Record<string, unknown>>("orders").find({}, { projection: { _id: 0 } }).sort({ recv_ts: 1 }).toArray();
  }
  async ordersSave(orders: Record<string, unknown>[]) {
    await this.connect();
    const col = this.col<Record<string, unknown>>("orders");
    for (const order of orders) if (order.id) await col.replaceOne({ id: order.id }, order, { upsert: true });
  }
  async ordersDeleteTest() {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    return (await this.col("orders").deleteMany({ test: true })).deletedCount;
  }
  async noteLoad() {
    await this.connect();
    return this.col<Record<string, unknown>>("ai_notes").findOne({ _key: "latest" }, { projection: { _id: 0, _key: 0 } });
  }
  async noteSave(note: Record<string, unknown>) {
    await this.connect();
    const doc = { ...note, _key: "latest" };
    await this.col("ai_notes").replaceOne({ _key: "latest" }, doc, { upsert: true });
    const { _key: _omit, ...archive } = doc;
    await this.col("ai_notes_archive").insertOne(archive);
  }

  async findUser(login: string): Promise<Account | null> {
    await this.connect();
    const escaped = login.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.col<Account>("users").findOne({ $or: [{ username: { $regex: `^${escaped}$`, $options: "i" } }, { email: { $regex: `^${escaped}$`, $options: "i" } }] });
  }
  async register(username: string, email: string, password: string, fullName: string) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const normalized = username.trim();
    const emailNorm = email.trim().toLowerCase();
    const existing = await this.col<Account>("users").findOne({ $or: [{ username: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { email: emailNorm }] });
    if (existing) return { ok: false as const, conflict: true };
    const now = Date.now() / 1000;
    const user: Account = { username: normalized, email: emailNorm, full_name: fullName || normalized, password_hash: hashPassword(password), role: "member", status: "active", vip_tier: "free", created_at: now, updated_at: now };
    await this.col<Account>("users").insertOne(user);
    return { ok: true as const };
  }
  async login(login: string, password: string, remember: boolean) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const user = await this.findUser(login);
    if (!user || !verifyPassword(password, user.password_hash)) return { ok: false as const, error: "Tên đăng nhập/email hoặc mật khẩu không đúng" };
    if (user.status === "banned") return { ok: false as const, error: "Tài khoản đã bị khóa", forbidden: true as const };
    if (user.status === "pending") return { ok: false as const, error: "Tài khoản đang chờ duyệt", forbidden: true as const };
    const token = randomBytes(32).toString("hex");
    const ttl = (remember ? 30 * 24 : 24) * 3600;
    const expires = Date.now() / 1000 + ttl;
    await this.col<Session>("sessions").replaceOne({ username: user.username }, { username: user.username, role: user.role, token, expires }, { upsert: true });
    return { ok: true as const, token, ttl, user: publicUser(user) };
  }
  async session(token: string): Promise<Session | null> {
    if (!token) return null;
    await this.connect();
    if (!this.db) return null;
    return this.col<Session>("sessions").findOne({ token, expires: { $gt: Date.now() / 1000 } });
  }
  async logout(token: string) {
    await this.connect();
    if (this.db && token) await this.col<Session>("sessions").deleteOne({ token });
  }
  async users(page = 1, perPage = 50, search = "", vip = "", status = "") {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    page = Math.max(1, Math.floor(page)); perPage = Math.min(100, Math.max(1, Math.floor(perPage)));
    const clauses: Record<string, unknown>[] = [];
    if (search.trim()) { const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); clauses.push({ $or: [{ username: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }, { full_name: { $regex: safe, $options: "i" } }] }); }
    if (vip === "free") clauses.push({ $or: [{ vip_tier: { $exists: false } }, { vip_tier: null }, { vip_tier: "free" }] });
    else if (vip === "any_vip") clauses.push({ vip_tier: { $nin: [null, "free", ""] } });
    else if (vip) clauses.push({ vip_tier: vip });
    if (status === "expiring") clauses.push({ vip_expiry: { $gte: Date.now() / 1000, $lte: Date.now() / 1000 + 7 * 86400 } });
    else if (status) clauses.push({ status });
    const query = clauses.length > 1 ? { $and: clauses } : clauses[0] ?? {};
    const col = this.col<Account>("users");
    const [total, users] = await Promise.all([col.countDocuments(query), col.find(query, { projection: { _id: 0, password_hash: 0 } }).sort({ created_at: -1 }).skip((page - 1) * perPage).limit(perPage).toArray()]);
    return { users, total, page, per_page: perPage };
  }
  async updateUser(data: Record<string, unknown>) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const username = String(data.username ?? "").trim();
    const { password, password_hash: _hash, ...fields } = data;
    if (typeof password === "string" && password) fields.password_hash = hashPassword(password);
    delete fields._id;
    const current = await this.col<Account>("users").findOne({ username });
    const now = Date.now() / 1000;
    const onInsert: Partial<Account> = { created_at: now, role: "member", status: "active" };
    if (!current && typeof fields.password_hash === "string") onInsert.password_hash = fields.password_hash;
    await this.col<Account>("users").updateOne({ username }, { $set: { ...fields, updated_at: now }, $setOnInsert: onInsert }, { upsert: true });
    return true;
  }
  async updateStatus(username: string, status: Account["status"]) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const result = await this.col<Account>("users").updateOne({ username }, { $set: { status, updated_at: Date.now() / 1000 } });
    if (status !== "active") await this.col<Session>("sessions").deleteMany({ username });
    return result.matchedCount > 0;
  }
  async deleteUser(username: string) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    await this.col<Account>("users").deleteOne({ username });
    await this.col<Session>("sessions").deleteMany({ username });
  }

  async submitPayment(username: string, plan: string, method: string, txHash: string) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const plans: Record<string, { days: number; amount: number }> = { starter: { days: 30, amount: 1200000 }, pro: { days: 90, amount: 2880000 }, lifetime: { days: 3650, amount: 9990000 } };
    const normalized = ({ "starter": "starter", "buồng lái 1 tháng (starter)": "starter", "pro trader": "pro", "buồng lái 3 tháng (pro trader)": "pro", "lifetime vip": "lifetime", "lifetime vip (trọn đời pro)": "lifetime" } as Record<string, string>)[plan.trim().toLowerCase()] ?? plan.trim().toLowerCase();
    const tier = plans[normalized];
    if (!tier) throw new Error("Gói VIP không hợp lệ");
    if (!["vietqr", "TRC20", "BEP20"].includes(method)) throw new Error("Phương thức thanh toán không hợp lệ");
    const doc = { payment_id: `KN${String(Math.floor(Date.now() / 1000) % 1_000_000).padStart(6, "0")}-${randomBytes(3).toString("hex").toUpperCase()}`, username, plan: normalized, tier: normalized, days: tier.days, amount_vnd: tier.amount, method, tx_hash: txHash.slice(0, 128), status: "pending", created_at: Date.now() / 1000 };
    await this.col("vip_payments").insertOne(doc);
    return doc;
  }
  async paymentsFor(username: string) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    return this.col<Record<string, unknown>>("vip_payments").find({ username }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
  }
  async payments(page = 1, perPage = 50) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    page = Math.max(1, Math.floor(page)); perPage = Math.min(100, Math.max(1, Math.floor(perPage)));
    const col = this.col<Record<string, unknown>>("vip_payments");
    const [total, payments] = await Promise.all([col.countDocuments({}), col.find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).skip((page - 1) * perPage).limit(perPage).toArray()]);
    return { payments, total, page, per_page: perPage };
  }
  async updatePayment(paymentId: string, status: string, note = "") {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const col = this.col<Record<string, unknown>>("vip_payments");
    const payment = await col.findOne({ payment_id: paymentId });
    if (!payment) return false;
    await col.updateOne({ payment_id: paymentId }, { $set: { status, admin_note: note, updated_at: Date.now() / 1000 } });
    if (status === "confirmed" && payment.status !== "confirmed" && payment.username !== "legacy") {
      const username = String(payment.username ?? "");
      const user = await this.col<Account>("users").findOne({ username });
      if (user) {
        const days = Number(payment.days) || 30;
        const base = Math.max(Date.now() / 1000, Number(user.vip_expiry) || 0);
        await this.col<Account>("users").updateOne({ username: user.username }, { $set: { role: "vip", vip_tier: String(payment.plan || "vip"), vip_expiry: days >= 3650 ? null : base + days * 86400, updated_at: Date.now() / 1000 } });
      }
    }
    return true;
  }

  async permissionGet(username: string) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    return await this.col<Record<string, unknown>>("permissions").findOne({ username }, { projection: { _id: 0 } }) ?? {};
  }
  async permissionSet(username: string, permissions: Record<string, unknown>) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    await this.col<Record<string, unknown>>("permissions").replaceOne({ username }, { username, ...permissions, updated_at: Date.now() / 1000 }, { upsert: true });
  }
  async permissionList() {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    return this.col<Record<string, unknown>>("permissions").find({}, { projection: { _id: 0 } }).sort({ username: 1 }).toArray();
  }
  async webhookConfigs() {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    return this.col<Record<string, unknown>>("webhook_configs").find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
  }
  async saveWebhookConfig(name: string, data: Record<string, unknown>) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const { _id: _omit, ...fields } = data;
    await this.col<Record<string, unknown>>("webhook_configs").replaceOne({ name }, { ...fields, name, updated_at: Date.now() / 1000 }, { upsert: true });
  }
  async ibConfigs() {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    return this.col<Record<string, unknown>>("ib_configs").find({}, { projection: { _id: 0 } }).sort({ ib_code: 1 }).toArray();
  }
  async saveIbConfig(data: Record<string, unknown>) {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const ibCode = String(data.ib_code ?? "").trim();
    if (!ibCode) throw new Error("Thiếu ib_code");
    const { _id: _omit, ...fields } = data;
    const now = Date.now() / 1000;
    await this.col<Record<string, unknown>>("ib_configs").updateOne({ ib_code: ibCode }, { $set: { ...fields, ib_code: ibCode, updated_at: now }, $setOnInsert: { created_at: now } }, { upsert: true });
  }
  async stats() {
    await this.connect();
    if (!this.db) throw new Error(this.error);
    const [orders, openOrders, wins, losses, users, activeUsers, vipUsers, bannedUsers, payments, pendingPayments] = await Promise.all([
      this.col("orders").countDocuments({}), this.col("orders").countDocuments({ state: { $in: ["pending", "open"] } }),
      this.col("orders").countDocuments({ result: "win" }), this.col("orders").countDocuments({ result: "loss" }),
      this.col("users").countDocuments({}), this.col("users").countDocuments({ status: "active" }),
      this.col("users").countDocuments({ role: "vip" }), this.col("users").countDocuments({ status: "banned" }),
      this.col("vip_payments").countDocuments({}), this.col("vip_payments").countDocuments({ status: "pending" }),
    ]);
    return { orders_total: orders, orders_open: openOrders, orders_win: wins, orders_loss: losses, users_total: users, users_active: activeUsers, users_vip: vipUsers, users_banned: bannedUsers, vip_payments: payments, vip_pending: pendingPayments };
  }
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${createHash("sha256").update(`${salt}|${password}`).digest("hex")}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":", 2);
  if (!salt || !expected) return false;
  const actual = createHash("sha256").update(`${salt}|${password}`).digest();
  const want = Buffer.from(expected, "hex");
  return actual.length === want.length && timingSafeEqual(actual, want);
}
function publicUser(user: Account): PublicAccount {
  return { username: user.username, role: user.role, full_name: user.full_name, email: user.email, vip_tier: user.vip_tier, vip_expiry: user.vip_expiry };
}

export const mongo = new MongoStore();
export const sessionCookie = COOKIE;
export { publicUser };
