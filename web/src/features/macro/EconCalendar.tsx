/** Lịch kinh tế Mỹ (tin High/Medium) — rê chuột / chạm để xem giải thích + dự đoán tác động lên vàng. */
import type { CalEvent } from "../../api/types";

function Event({ e }: { e: CalEvent }) {
  const meta = [e.forecast && "DB: " + e.forecast, e.previous && "Trước: " + e.previous].filter(Boolean);
  const opp = e.hot === "giảm" ? "tăng" : "giảm";
  const hotC = e.hot === "giảm" ? "down" : "up";
  const oppC = opp === "giảm" ? "down" : "up";
  return (
    <div className="evt" tabIndex={0}>
      <div className="when">{e.wd} {e.day}<small>{e.time}</small></div>
      <div>
        <div className="etitle">{e.title} <span className="ic">ⓘ</span></div>
        {meta.length > 0 && <div className="emeta">{meta.join(" · ")}</div>}
      </div>
      <span className={"imp " + e.impact}>{e.impact === "High" ? "MẠNH" : "Vừa"}</span>
      <div className="tip">
        <div className="tip-h">{e.title}</div>
        <p>{e.desc}</p>
        <p><b>Ảnh hưởng vàng:</b> {e.mech}</p>
        <p className="tip-pred">
          <b>🎯 Dự đoán:</b> Số thực tế cao hơn dự báo{e.forecast ? ` (${e.forecast})` : ""} → vàng <b className={hotC}>{e.hot}</b>;
          thấp hơn → vàng <b className={oppC}>{opp}</b>.
        </p>
      </div>
    </div>
  );
}

export function EconCalendar({ events, stamp }: { events: CalEvent[] | undefined; stamp: string | null | undefined }) {
  return (
    <section className="cal">
      <h2>Lịch kinh tế Mỹ · tin dễ giật vàng</h2>
      <p className="note">
        Giờ Việt Nam (GMT+7) · <b>High</b> = tác động mạnh · tự cập nhật mỗi tuần. {stamp ? `· lấy lúc ${stamp}` : ""}
      </p>
      {events == null ? <p className="note">Đang tải lịch…</p>
        : events.length === 0 ? <p className="note">Chưa có tin sắp tới (hoặc đang tải).</p>
        : events.map((e) => <Event key={e.ts + e.title} e={e} />)}
    </section>
  );
}
