/** Định dạng số / giờ dùng chung. */

/** Số có dấu phẩy nghìn, `d` chữ số thập phân. */
export const fmt = (v: number | null | undefined, d: number) =>
  v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Giá 2 chữ số (làm tròn 0.01). */
export const px2 = (x: number | null | undefined) => (x == null ? "—" : (Math.round(x * 100) / 100).toFixed(2));

/** % có dấu, 1 chữ số: +1.2% */
export const pct1 = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

/** Lớp màu theo dấu: up / down / flat */
export const signCls = (v: number | null | undefined) => (v == null ? "flat" : v > 0 ? "up" : v < 0 ? "down" : "flat");

/** "HH:MM dd/mm" theo giờ Việt Nam. */
export const vnTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  });
