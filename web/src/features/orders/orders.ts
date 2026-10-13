/** Logic Lệnh Live phía giao diện: lọc theo kỳ, sắp xếp, thống kê. */
import type { Order } from "../../api/types";

/** Kỳ xem: hôm nay · 3 ngày · 7 ngày (tính theo ngày giờ Việt Nam, gồm cả hôm nay) · tất cả. */
export type Period = "day" | "3d" | "week" | "all";

export const isActive = (o: Order) => o.state === "open" || o.state === "pending";

/** Đang chạy lên trước, rồi mới nhất trước. */
export const sortOrders = (list: Order[]) =>
  list.slice().sort((a, b) => Number(!isActive(a)) - Number(!isActive(b)) || b.recv_ts - a.recv_ts);

/** Chữ ký các lệnh đang chạy — đổi thì vẽ lại lệnh trên chart. */
export const activeSignature = (list: Order[]) =>
  list.filter(isActive).map((o) => o.id + o.state + o.sl + o.tps.join() + o.entries.join()).join("|");

/** Mốc bắt đầu của kỳ (epoch giây): 0h giờ VN của hôm nay / 2 ngày trước / 6 ngày trước. */
export function periodStart(per: Period): number {
  if (per === "all") return 0;
  const now = Date.now() / 1000;
  const vn = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const todayStart = now - (vn.getHours() * 3600 + vn.getMinutes() * 60 + vn.getSeconds());   // 0h hôm nay giờ VN
  const back = per === "3d" ? 2 : per === "week" ? 6 : 0;
  return todayStart - back * 86400;
}

/** Lệnh thuộc kỳ đang xem (theo lúc nhận lệnh). Lệnh đang chạy / chờ khớp luôn hiện để không bị sót. */
export const inPeriod = (per: Period) => {
  const from = periodStart(per);
  return (o: Order) => o.recv_ts >= from || isActive(o);
};

export function orderStats(list: Order[], per: Period) {
  const from = periodStart(per);
  const os = list.filter((o) => !o.test && o.recv_ts >= from);
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
