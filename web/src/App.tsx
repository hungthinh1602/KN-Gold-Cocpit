/** Main shell: macro, AI analysis, member account and admin surfaces. */
import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { MacroData } from "./api/types";
import { usePolling } from "./hooks/usePolling";
import { useStoredState } from "./hooks/useStoredState";
import { Header } from "./components/layout/Header";
import { SessionBar } from "./components/layout/SessionBar";
import { MacroPage } from "./features/macro/MacroPage";
import { AiPage } from "./features/ai/AiPage";
import { AccountPage } from "./features/account/AccountPage";
import { AdminPage } from "./features/admin/AdminPage";
import "./styles/account.css";

type Page = "macro" | "ai" | "account" | "admin";
const MACRO_MS = 30_000;

export function App() {
  const [stored, setPage] = useStoredState<string>("page", "macro");
  const page: Page = stored === "ai" || stored === "account" || stored === "admin" ? stored : "macro";
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [netErr, setNetErr] = useState(false);
  const [account, setAccount] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" }).then(async (r) => r.ok ? r.json() : null)
      .then((d) => setAccount(d?.ok ? { username: d.username, role: d.role } : null)).catch(() => setAccount(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    setAccount(null);
    setPage("account");
  }

  usePolling(async () => {
    try { setMacro(await api.macro()); setNetErr(false); }
    catch { setNetErr(true); }
  }, MACRO_MS);

  return (
    <div className="wrap">
      <Header />
      <SessionBar />
      <div className="tabs">
        <button type="button" className="tab" aria-pressed={page === "macro"} onClick={() => setPage("macro")}>📊 VĨ MÔ</button>
        <button type="button" className="tab" aria-pressed={page === "ai"} onClick={() => setPage("ai")}>🧠 AI PHÂN TÍCH</button>
        <button type="button" className="tab" aria-pressed={page === "account"} onClick={() => setPage("account")}>👤 TÀI KHOẢN</button>
        {account?.role === "admin" && <button type="button" className="tab" aria-pressed={page === "admin"} onClick={() => setPage("admin")}>⚙ QUẢN TRỊ</button>}
      </div>

      {page === "macro" ? <MacroPage data={macro} /> : page === "ai" ? <AiPage /> : page === "admin" ? <AdminPage /> : <AccountPage account={account} onLogout={logout} />}

      <p className="foot">
        <span>Cập nhật lúc <b>{macro?.updated || "—"}</b></span> · {netErr ? <span className="err">Mất kết nối tới app.</span> : macro?.error && <span className="err">⚠ {macro.error}</span>}
      </p>
    </div>
  );
}
