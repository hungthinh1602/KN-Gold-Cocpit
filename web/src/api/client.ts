/** Gọi API server Node. Kiểu dữ liệu nằm ở ./types. */
import type { AiData, AiLive, MacroData, OrdersData, Timeframe } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (res.status === 401) {
    // hết phiên đăng nhập → tải lại trang để server hiện form đăng nhập
    window.location.reload();
    throw new Error("chưa đăng nhập");
  }
  return (await res.json()) as T;
}

const postJson = <T>(url: string, body: unknown) =>
  request<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Vùng/mức của 1 khung cho cảnh báo "giá chạm vùng" (/api/ai/levels). */
export interface AiLevels {
  error?: string;
  tf: string;
  updated: string;
  zones: { kind: "demand" | "supply"; top: number; bottom: number }[];
  levels: { kind: string; price: number }[];
  ote: { school: string; top: number; bottom: number }[];
}

export const api = {
  macro: () => request<MacroData>("/api/data"),
  ai: (tf: Timeframe) => request<AiData>(`/api/ai?tf=${encodeURIComponent(tf)}`),
  aiLive: (tf: Timeframe) => request<AiLive>(`/api/ai/live?tf=${encodeURIComponent(tf)}`),
  aiLevels: (tf: string) => request<AiLevels>(`/api/ai/levels?tf=${encodeURIComponent(tf)}`),
  tick: () => request<{ bid: number | null; ask: number | null; time: number; error?: string }>("/api/tick"),
  orders: () => request<OrdersData>("/api/orders"),
  clearTestOrders: () => request<{ ok: boolean }>("/api/orders/clear-test", { method: "POST" }),
  saveOrderNote: (id: string, note: string) => postJson<{ ok?: boolean; error?: string }>("/api/orders/note", { id, note }),
};
