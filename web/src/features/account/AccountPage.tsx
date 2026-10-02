import { useEffect, useState } from "react";
import { useT } from "../../i18n/lang";

type Account = { username: string; role: string };
type Payment = { payment_id: string; plan: string; amount_vnd: number; method: string; status: string; created_at: number };
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
const date = (n: number) => new Date(n * 1000).toLocaleString("vi-VN");

export function AccountPage({ account, onLogout }: { account: Account | null; onLogout: () => void }) {
  const t = useT();
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
      if (!r.ok) throw new Error(data.error ?? t("Không gửi được yêu cầu", "Could not send the request"));
      setNotice(t(`Đã tạo yêu cầu ${data.payment_id} · ${money(data.amount_vnd)}. Trạng thái: chờ xác nhận.`, `Request ${data.payment_id} created · ${money(data.amount_vnd)}. Status: awaiting confirmation.`));
      const p = await fetch("/api/vip/my-payments", { credentials: "same-origin" }).then((x) => x.json()); setPayments(p.payments ?? []);
    } catch (e) { setError((e as Error).message); }
  }
  return <section className="master account-page"><div className="account-head"><div><span className="eyebrow">{t("TÀI KHOẢN", "ACCOUNT")}</span><h2>{account ? `${t("Xin chào", "Hello")}, ${account.username}` : t("Đăng nhập thành viên", "Member sign-in")}</h2><p>{account ? `${t("Vai trò", "Role")}: ${account.role}` : t("Đăng ký/đăng nhập được bật khi bạn cấu hình MONGODB_URI.", "Sign-up/sign-in is enabled once MONGODB_URI is configured.")}</p></div>{account ? <button className="account-btn" onClick={onLogout}>{t("Đăng xuất", "Sign out")}</button> : <a className="account-btn" href="/auth">{t("Đăng nhập / Đăng ký", "Sign in / Sign up")}</a>}</div>
  {account && <><h3>{t("Gói thành viên", "Membership plans")}</h3><div className="plan-grid"><article><b>STARTER · {t("30 ngày", "30 days")}</b><strong>{money(1_200_000)}</strong><button onClick={() => buy("STARTER", "vietqr")}>{t("Yêu cầu VietQR", "Request VietQR")}</button><button className="secondary" onClick={() => buy("STARTER", "TRC20")}>{t("Yêu cầu Crypto", "Request Crypto")}</button></article><article className="featured"><b>PRO TRADER · {t("90 ngày", "90 days")}</b><strong>{money(2_880_000)}</strong><button onClick={() => buy("PRO TRADER", "vietqr")}>{t("Yêu cầu VietQR", "Request VietQR")}</button><button className="secondary" onClick={() => buy("PRO TRADER", "TRC20")}>{t("Yêu cầu Crypto", "Request Crypto")}</button></article><article><b>LIFETIME VIP</b><strong>{money(9_990_000)}</strong><button onClick={() => buy("LIFETIME VIP", "vietqr")}>{t("Yêu cầu VietQR", "Request VietQR")}</button><button className="secondary" onClick={() => buy("LIFETIME VIP", "BEP20")}>{t("Yêu cầu Crypto", "Request Crypto")}</button></article></div><p className="account-msg">{notice || error}</p><h3>{t("Lịch sử thanh toán", "Payment history")}</h3>{payments.length ? <div className="table-wrap"><table><thead><tr><th>{t("Mã giao dịch", "Payment ID")}</th><th>{t("Gói", "Plan")}</th><th>{t("Số tiền", "Amount")}</th><th>{t("Phương thức", "Method")}</th><th>{t("Trạng thái", "Status")}</th><th>{t("Thời gian", "Time")}</th></tr></thead><tbody>{payments.map((p) => <tr key={p.payment_id}><td>{p.payment_id}</td><td>{p.plan}</td><td>{money(p.amount_vnd)}</td><td>{p.method}</td><td>{p.status}</td><td>{date(p.created_at)}</td></tr>)}</tbody></table></div> : <p className="empty-state">{t("Chưa có yêu cầu thanh toán.", "No payment requests yet.")}</p>}</>}
  </section>;
}
