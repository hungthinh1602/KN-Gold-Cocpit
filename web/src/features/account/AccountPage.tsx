import { useEffect, useState } from "react";

type Account = { username: string; role: string };
type Payment = { payment_id: string; plan: string; amount_vnd: number; method: string; status: string; created_at: number };
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
const date = (n: number) => new Date(n * 1000).toLocaleString("vi-VN");

export function AccountPage({ account, onLogout }: { account: Account | null; onLogout: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!account) return;
    fetch("/api/vip/my-payments", { credentials: "same-origin" }).then((r) => r.json()).then((d) => { if (Array.isArray(d.payments)) setPayments(d.payments); }).catch(() => undefined);
  }, [account]);
  async function buy(plan: string, method: string) {
    setError(""); setNotice("");
    try {
      const r = await fetch("/api/vip/submit", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ plan, method }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Không gửi được yêu cầu");
      setNotice(`Đã tạo yêu cầu ${data.payment_id} · ${money(data.amount_vnd)}. Trạng thái: chờ xác nhận.`);
      const p = await fetch("/api/vip/my-payments", { credentials: "same-origin" }).then((x) => x.json()); setPayments(p.payments ?? []);
    } catch (e) { setError((e as Error).message); }
  }
  return <section className="master account-page"><div className="account-head"><div><span className="eyebrow">TÀI KHOẢN</span><h2>{account ? `Xin chào, ${account.username}` : "Đăng nhập thành viên"}</h2><p>{account ? `Vai trò: ${account.role}` : "Đăng ký/đăng nhập được bật khi bạn cấu hình MONGODB_URI."}</p></div>{account ? <button className="account-btn" onClick={onLogout}>Đăng xuất</button> : <a className="account-btn" href="/auth">Đăng nhập / Đăng ký</a>}</div>
  {account && <><h3>Gói thành viên</h3><div className="plan-grid"><article><b>STARTER · 30 ngày</b><strong>{money(1_200_000)}</strong><button onClick={() => buy("STARTER", "vietqr")}>Yêu cầu VietQR</button><button className="secondary" onClick={() => buy("STARTER", "TRC20")}>Yêu cầu Crypto</button></article><article className="featured"><b>PRO TRADER · 90 ngày</b><strong>{money(2_880_000)}</strong><button onClick={() => buy("PRO TRADER", "vietqr")}>Yêu cầu VietQR</button><button className="secondary" onClick={() => buy("PRO TRADER", "TRC20")}>Yêu cầu Crypto</button></article><article><b>LIFETIME VIP</b><strong>{money(9_990_000)}</strong><button onClick={() => buy("LIFETIME VIP", "vietqr")}>Yêu cầu VietQR</button><button className="secondary" onClick={() => buy("LIFETIME VIP", "BEP20")}>Yêu cầu Crypto</button></article></div><p className="account-msg">{notice || error}</p><h3>Lịch sử thanh toán</h3>{payments.length ? <div className="table-wrap"><table><thead><tr><th>Mã giao dịch</th><th>Gói</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>{payments.map((p) => <tr key={p.payment_id}><td>{p.payment_id}</td><td>{p.plan}</td><td>{money(p.amount_vnd)}</td><td>{p.method}</td><td>{p.status}</td><td>{date(p.created_at)}</td></tr>)}</tbody></table></div> : <p className="empty-state">Chưa có yêu cầu thanh toán.</p>}</>}
  </section>;
}
