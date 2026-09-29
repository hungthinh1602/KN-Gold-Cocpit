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

export const api = {
  macro: () => request<MacroData>("/api/data"),
  ai: (tf: Timeframe) => request<AiData>(`/api/ai?tf=${encodeURIComponent(tf)}`),
  aiLive: (tf: Timeframe) => request<AiLive>(`/api/ai/live?tf=${encodeURIComponent(tf)}`),
  orders: () => request<OrdersData>("/api/orders"),
  clearTestOrders: () => request<{ ok: boolean }>("/api/orders/clear-test", { method: "POST" }),
};
