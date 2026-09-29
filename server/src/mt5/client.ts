/**
 * Client gọi mt5-bridge (Python) qua HTTP nội bộ.
 * Mọi lệnh gọi có giới hạn thời gian — bridge kẹt thì báo lỗi chứ không treo server.
 */
import { config } from "../config.js";
import type { Bar, Mt5Deal, Mt5Health, Mt5PendingOrder, Mt5Position, Tick, Timeframe } from "./types.js";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(config.bridgeUrl + path, { signal: AbortSignal.timeout(config.bridgeTimeoutMs) });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok || (body as { error?: string })?.error) throw new Error((body as { error?: string })?.error ?? `bridge HTTP ${res.status}`);
  return body;
}

export const mt5 = {
  health: () => get<Mt5Health>("/health"),
  tick: () => get<Tick>("/tick"),
  rates: (tf: Timeframe, count = 1500) => get<Bar[]>(`/rates?tf=${tf}&count=${count}`),
  orders: () => get<Mt5PendingOrder[]>("/orders"),
  positions: () => get<Mt5Position[]>("/positions"),
  deals: (position: number) => get<Mt5Deal[]>(`/deals?position=${position}`),
};
