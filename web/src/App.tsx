/** Khung ứng dụng: tiêu đề, thanh phiên, 2 tab (Vĩ mô / AI phân tích), chân trang. */
import { useState } from "react";
import { api } from "./api/client";
import type { MacroData } from "./api/types";
import { usePolling } from "./hooks/usePolling";
import { useStoredState } from "./hooks/useStoredState";
import { Header } from "./components/layout/Header";
import { SessionBar } from "./components/layout/SessionBar";
import { MacroPage } from "./features/macro/MacroPage";
import { AiPage } from "./features/ai/AiPage";

type Page = "macro" | "ai";
const MACRO_MS = 30_000;

export function App() {
  const [stored, setPage] = useStoredState<string>("page", "macro");
  const page: Page = stored === "ai" ? "ai" : "macro";
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [netErr, setNetErr] = useState(false);

  usePolling(async () => {
    try {
      setMacro(await api.macro());
      setNetErr(false);
    } catch {
      setNetErr(true);
    }
  }, MACRO_MS);

  return (
    <div className="wrap">
      <Header />
      <SessionBar />
      <div className="tabs">
        <button type="button" className="tab" aria-pressed={page === "macro"} onClick={() => setPage("macro")}>📊 VĨ MÔ</button>
        <button type="button" className="tab" aria-pressed={page === "ai"} onClick={() => setPage("ai")}>🧠 AI PHÂN TÍCH</button>
      </div>

      {page === "macro" ? <MacroPage data={macro} /> : <AiPage />}

      <p className="foot">
        <span>Cập nhật lúc <b>{macro?.updated || "—"}</b></span> ·{" "}
        {netErr ? <span className="err">Mất kết nối tới app.</span> : macro?.error && <span className="err">⚠ {macro.error}</span>}
      </p>
    </div>
  );
}
