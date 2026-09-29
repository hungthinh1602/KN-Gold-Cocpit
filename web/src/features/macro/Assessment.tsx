/** Nhận định vàng tự sinh từ 5 yếu tố vĩ mô + đà tuần/tháng + tin mạnh sắp tới. */
import type { MacroData } from "../../api/types";
import { pct1 } from "../../lib/format";
import { DRIVER_ORDER, contribution } from "./drivers";

export function Assessment({ d }: { d: MacroData }) {
  const press: string[] = [];
  const supp: string[] = [];
  for (const id of DRIVER_ORDER) {
    const x = d.drivers?.[id];
    if (!x || x.value == null) continue;
    const c = contribution(x);
    if (c < 0) press.push(x.name);
    else if (c > 0) supp.push(x.name);
  }
  const sc = d.score || 0;
  const cls = sc <= -1 ? "down" : sc >= 1 ? "up" : "flat";
  const lean = sc <= -3 ? "nghiêng GIẢM rõ" : sc <= -1 ? "nghiêng giảm" : sc >= 3 ? "nghiêng TĂNG rõ" : sc >= 1 ? "nghiêng tăng" : "trung lập, giằng co";
  const tail = press.length && supp.length ? ` — ${press.join(", ")} đè, còn ${supp.join(", ")} đỡ.`
    : press.length ? ` — ${press.join(", ")} cùng gây áp lực bán.`
    : supp.length ? ` — ${supp.join(", ")} đang hỗ trợ.` : ".";

  const w = d.gold?.pct5;
  const m = d.gold?.pctM;
  let trend: JSX.Element | null = null;
  if (w != null && m != null) {
    const U = (v: number) => <b className="up">{pct1(v)}</b>;
    const D = (v: number) => <b className="down">{pct1(v)}</b>;
    if (m > 0 && w < 0) trend = <>Cả tháng vàng vẫn {U(m)} nhưng tuần này {D(w)} → giống nhịp điều chỉnh trong xu hướng tăng hơn là đảo chiều.</>;
    else if (m < 0 && w < 0) trend = <>Vàng giảm ở cả nhịp tuần ({D(w)}) lẫn tháng ({D(m)}) → đà giảm còn nguyên.</>;
    else if (m > 0 && w > 0) trend = <>Vàng tăng cả tuần ({U(w)}) và tháng ({U(m)}) → xu hướng tăng đang chiếm ưu thế.</>;
    else if (m < 0 && w > 0) trend = <>Tháng còn âm ({D(m)}) nhưng tuần này hồi ({U(w)}) → có dấu hiệu tạo đáy ngắn hạn, cần thêm xác nhận.</>;
  }
  const hi = (d.calendar || []).find((e) => e.impact === "High");

  return (
    <div className="assess">
      <span className="lb">Nhận định vàng</span>
      Vĩ mô đang <b className={cls}>{lean}</b> với vàng{tail} {trend}
      {hi && <span className="watch">⏰ Mốc cần canh: <b>{hi.title}</b> — {hi.wd} {hi.day} {hi.time} (giờ VN).</span>}
    </div>
  );
}
