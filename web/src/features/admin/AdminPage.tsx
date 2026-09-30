import { useEffect, useState } from "react";

type User = { username: string; email?: string; full_name?: string; role: string; status: string; vip_tier?: string; vip_expiry?: number };
type Payment = { payment_id: string; username: string; plan: string; amount_vnd: number; method: string; status: string; created_at: number };
type Stats = Record<string, number>;
async function get<T>(url: string): Promise<T> { const r = await fetch(url, { credentials: "same-origin" }); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Không tải được dữ liệu"); return d; }
async function post(url: string, data: unknown) { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(data) }); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Không lưu được"); return d; }
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
const date = (n: number) => new Date(n * 1000).toLocaleString("vi-VN");

export function AdminPage() {
  const [tab, setTab] = useState<"users" | "payments">("users");
  const [users, setUsers] = useState<User[]>([]); const [payments, setPayments] = useState<Payment[]>([]); const [stats, setStats] = useState<Stats>({});
  const [search, setSearch] = useState(""); const [error, setError] = useState(""); const [note, setNote] = useState("");
  async function refresh() {
    setError("");
    try { const [u, p, s] = await Promise.all([get<{ users: User[] }>(`/api/users?search=${encodeURIComponent(search)}`), get<{ payments: Payment[] }>("/api/vip/payments"), get<Stats>("/api/admin/stats")]); setUsers(u.users); setPayments(p.payments); setStats(s); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void refresh(); }, []);
  async function userAction(u: User, action: "active" | "banned" | "delete") {
    try { if (action === "delete") await post("/api/users/delete", { username: u.username }); else await post("/api/users/status", { username: u.username, status: action }); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }
  async function paymentAction(p: Payment, status: "confirmed" | "rejected") {
    const text = status === "confirmed" ? `Xác nhận giao dịch ${p.payment_id} và cấp quyền VIP?` : `Từ chối giao dịch ${p.payment_id}?`;
    if (!window.confirm(text)) return;
    try { await post("/api/vip/update-status", { payment_id: p.payment_id, status, note }); setNote(""); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }
  return <section className="master admin-page"><div className="admin-head"><div><span className="eyebrow">QUẢN TRỊ</span><h2>KN Coffee Trading</h2></div><button className="account-btn" onClick={() => void refresh()}>Làm mới</button></div>{error && <p className="err">{error}</p>}
    <div className="stat-grid">{[["Thành viên", stats.users_total], ["VIP", stats.users_vip], ["Đơn hàng", stats.orders_total], ["Chờ thanh toán", stats.vip_pending]].map(([label, value]) => <div className="stat-card" key={String(label)}><span>{label}</span><b>{value ?? "—"}</b></div>)}</div>
    <div className="admin-toolbar"><div className="admin-tabs"><button aria-pressed={tab === "users"} onClick={() => setTab("users")}>Thành viên</button><button aria-pressed={tab === "payments"} onClick={() => setTab("payments")}>Thanh toán VIP</button></div>{tab === "users" && <form onSubmit={(e) => { e.preventDefault(); void refresh(); }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, email..."/><button>Tìm</button></form>}</div>
    {tab === "users" ? <div className="table-wrap"><table><thead><tr><th>Thành viên</th><th>Vai trò / Gói</th><th>Trạng thái</th><th>Ngày hết hạn</th><th>Thao tác</th></tr></thead><tbody>{users.map((u) => <tr key={u.username}><td><b>{u.full_name || u.username}</b><small>{u.username} · {u.email}</small></td><td>{u.role} / {u.vip_tier || "free"}</td><td>{u.status}</td><td>{u.vip_expiry ? date(u.vip_expiry) : "—"}</td><td><div className="row-actions"><button onClick={() => void userAction(u, u.status === "banned" ? "active" : "banned")}>{u.status === "banned" ? "Mở khóa" : "Khóa"}</button><button className="danger" onClick={() => void userAction(u, "delete")}>Xóa</button></div></td></tr>)}</tbody></table>{users.length === 0 && <p className="empty-state">Không có thành viên phù hợp.</p>}</div> : <><label className="admin-note">Ghi chú duyệt <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tùy chọn"/></label><div className="table-wrap"><table><thead><tr><th>Mã</th><th>Thành viên</th><th>Gói / Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead><tbody>{payments.map((p) => <tr key={p.payment_id}><td>{p.payment_id}</td><td>{p.username}</td><td>{p.plan}<small>{money(p.amount_vnd)}</small></td><td>{p.method}</td><td>{p.status}</td><td>{date(p.created_at)}</td><td>{p.status === "pending" ? <div className="row-actions"><button onClick={() => void paymentAction(p, "confirmed")}>Duyệt</button><button className="danger" onClick={() => void paymentAction(p, "rejected")}>Từ chối</button></div> : "—"}</td></tr>)}</tbody></table>{payments.length === 0 && <p className="empty-state">Chưa có giao dịch.</p>}</div></>}
  </section>;
}
