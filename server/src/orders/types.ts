/** Lệnh Live — cấu trúc 1 lệnh (giữ đúng tên trường của bản Python để dùng chung orders.json). */

export const PIP_SIZE = 0.1; // vàng: 1 pip = 0.1 giá (50 pip = 5 giá, 100 pip = 10 giá)

export type OrderState = "pending" | "open" | "closed" | "cancelled";

export interface OrderEvent {
  ts: number;          // giờ thật (epoch giây)
  code: string;        // NEW, ENTRY1, PIP50, PIP100, TP, SL, CLOSE, CANCEL, EDIT…
  text: string;
  price: number | null;
}

export interface Order {
  id: string;
  src?: "mt5";                       // không có = lệnh TradingView
  ticket?: number;                   // lệnh MT5
  kind?: string;                     // "Buy Limit"…
  volume?: number;
  comment?: string;
  profit?: number;                   // lời/lỗ $ (lệnh MT5)
  indi: string;
  side: "BUY" | "SELL";
  tf: string;
  symbol: string;
  test: boolean;
  entries: number[];
  filled: boolean[];
  sl: number | null;
  tps: number[];
  pip: number;
  recv_ts: number;                   // giờ thật lúc nhận/đặt lệnh (epoch giây)
  raw?: string | null;
  state: OrderState;
  fill_bar_t: number | null;         // giờ server MT5 của nến M1 khớp Entry
  last_t: number | null;             // nến M1 (giờ server) đã soi tới
  tp_hit: number;
  pip50: boolean;
  pip100: boolean;
  mfe: number;                       // lời tối đa (pip)
  mae: number;                       // lỗ tối đa (pip)
  cur_pip: number | null;
  result: "win" | "loss" | "cancel" | null;
  close_pip: number | null;
  events: OrderEvent[];
  status: string;
  status_text: string;
  _st?: [string, string];            // trạng thái chính của lệnh MT5 (giữ khi có sự kiện sửa SL/TP)
}
