/** Nhận định vàng tự sinh từ 5 yếu tố vĩ mô + đà tuần/tháng + tin mạnh sắp tới. */
import type { MacroData } from "../../api/types";
import { pct1 } from "../../lib/format";
import { useLang } from "../../i18n/lang";
import { weekdayEn } from "./calendarText";
import { DRIVER_ORDER, contribution } from "./drivers";

export function Assessment({ d }: { d: MacroData }) {
  const [lang] = useLang();
  const en = lang === "en";
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
  const lean = en
    ? (sc <= -3 ? "clearly BEARISH" : sc <= -1 ? "bearish" : sc >= 3 ? "clearly BULLISH" : sc >= 1 ? "bullish" : "neutral, range-bound")
    : (sc <= -3 ? "nghiêng GIẢM rõ" : sc <= -1 ? "nghiêng giảm" : sc >= 3 ? "nghiêng TĂNG rõ" : sc >= 1 ? "nghiêng tăng" : "trung lập, giằng co");
  const tail = en
    ? (press.length && supp.length ? ` — ${press.join(", ")} ${press.length > 1 ? "weigh" : "weighs"} on it, while ${supp.join(", ")} ${supp.length > 1 ? "support" : "supports"} it.`
      : press.length ? ` — ${press.join(", ")} ${press.length > 1 ? "all add" : "adds"} selling pressure.`
      : supp.length ? ` — ${supp.join(", ")} ${supp.length > 1 ? "are" : "is"} supportive.` : ".")
    : (press.length && supp.length ? ` — ${press.join(", ")} đè, còn ${supp.join(", ")} đỡ.`
      : press.length ? ` — ${press.join(", ")} cùng gây áp lực bán.`
      : supp.length ? ` — ${supp.join(", ")} đang hỗ trợ.` : ".");

  const w = d.gold?.pct5;
  const m = d.gold?.pctM;
  let trend: JSX.Element | null = null;
  if (w != null && m != null) {
    const U = (v: number) => <b className="up">{pct1(v)}</b>;
    const D = (v: number) => <b className="down">{pct1(v)}</b>;
    if (m > 0 && w < 0) trend = en
      ? <>Gold is still {U(m)} on the month but {D(w)} this week → looks more like a pullback in an uptrend than a reversal.</>
      : <>Cả tháng vàng vẫn {U(m)} nhưng tuần này {D(w)} → giống nhịp điều chỉnh trong xu hướng tăng hơn là đảo chiều.</>;
    else if (m < 0 && w < 0) trend = en
      ? <>Gold is down on both the week ({D(w)}) and the month ({D(m)}) → the downtrend is intact.</>
      : <>Vàng giảm ở cả nhịp tuần ({D(w)}) lẫn tháng ({D(m)}) → đà giảm còn nguyên.</>;
    else if (m > 0 && w > 0) trend = en
      ? <>Gold is up on both the week ({U(w)}) and the month ({U(m)}) → the uptrend is in control.</>
      : <>Vàng tăng cả tuần ({U(w)}) và tháng ({U(m)}) → xu hướng tăng đang chiếm ưu thế.</>;
    else if (m < 0 && w > 0) trend = en
      ? <>The month is still negative ({D(m)}) but this week is rebounding ({U(w)}) → possible short-term bottom, needs confirmation.</>
      : <>Tháng còn âm ({D(m)}) nhưng tuần này hồi ({U(w)}) → có dấu hiệu tạo đáy ngắn hạn, cần thêm xác nhận.</>;
  }
  const hi = (d.calendar || []).find((e) => e.impact === "High");

  return (
    <div className="assess">
      <span className="lb">{en ? "Gold outlook" : "Nhận định vàng"}</span>
      {en ? <>Macro is <b className={cls}>{lean}</b> for gold{tail} {trend}</>
        : <>Vĩ mô đang <b className={cls}>{lean}</b> với vàng{tail} {trend}</>}
      {hi && (
        <span className="watch">
          ⏰ {en ? "Key event:" : "Mốc cần canh:"} <b>{hi.title}</b> — {en ? weekdayEn(hi.wd) : hi.wd} {hi.day} {hi.time} {en ? "(Vietnam time)." : "(giờ VN)."}
        </span>
      )}
    </div>
  );
}
