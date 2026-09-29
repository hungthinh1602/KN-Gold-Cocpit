/** Kiểu dữ liệu trả về từ mt5-bridge. */

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1" | "MN";

export const TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];

/** Nến OHLC. `time` = giờ server MT5 (epoch giây, GTC lệch UTC +3h). */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Mt5Health {
  ok: boolean;
  login: number | null;
  server: string;
  company: string;
  connected: boolean;
  symbol: string | null;
  tick_time: number | null;
}

export interface Tick {
  bid: number;
  ask: number;
  time: number;
}

/** Lệnh chờ trên MT5 (type 2..7 = Buy/Sell Limit/Stop/StopLimit). */
export interface Mt5PendingOrder {
  ticket: number; type: number; price_open: number; sl: number; tp: number;
  volume: number; comment: string; time_setup: number;
}

/** Vị thế đang mở (type 0 = BUY, 1 = SELL). */
export interface Mt5Position {
  ticket: number; type: number; price_open: number; sl: number; tp: number;
  volume: number; profit: number; comment: string; time: number;
}

/** Deal lịch sử. entry: 0 vào, 1 ra, 3 ra ngược. reason: 4 SL, 5 TP. */
export interface Mt5Deal {
  ticket: number; entry: number; type: number; price: number; reason: number;
  profit: number; swap: number; commission: number; time: number;
}
