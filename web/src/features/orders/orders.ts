/** Logic Lệnh Live phía giao diện: lọc theo nguồn/kỳ, sắp xếp, thống kê. */
import type { Order } from "../../api/types";

export type Period = "day" | "week" | "all";
export type Source = "all" | "tv" | "mt5";

export const isActive = (o: Order) => o.state === "open" || o.state === "pending";

export const bySource = (src: Source) => (o: Order) => src === "all" || (src === "mt5") === (o.src === "mt5");

/** Đang chạy lên trước, rồi mới nhất trước. */
export const sortOrders = (list: Order[]) =>
  list.slice().sort((a, b) => Number(!isActive(a)) - Number(!isActive(b)) || b.recv_ts - a.recv_ts);

/** Chữ ký các lệnh đang chạy — đổi thì vẽ lại lệnh trên chart. */
export const activeSignature = (list: Order[]) =>
  list.filter(isActive).map((o) => o.id + o.state + o.sl + o.tps.join() + o.entries.join()).join("|");

function periodStart(per: Period): number {
  const now = Date.now() / 1000;
  if (per === "week") return now - 7 * 86400;
  if (per === "day") {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    return now - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());   // 0h hôm nay giờ VN
  }
  return 0;
}

export function orderStats(list: Order[], per: Period, src: Source) {
  const from = periodStart(per);
  const os = list.filter((o) => !o.test && o.recv_ts >= from && bySource(src)(o));
  let win = 0, loss = 0, cancel = 0, running = 0, pips = 0;
  for (const o of os) {
    if (o.result === "win") win++;
    else if (o.result === "loss") loss++;
    else if (o.result === "cancel") cancel++;
    else running++;
    if (o.close_pip != null) pips += o.close_pip;
  }
  return { total: os.length, win, loss, cancel, running, pips, winrate: win + loss ? Math.round((win * 100) / (win + loss)) + "%" : "—" };
}
