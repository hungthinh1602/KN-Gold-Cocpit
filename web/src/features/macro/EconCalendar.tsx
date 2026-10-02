/** Lịch kinh tế Mỹ (tin High/Medium) — rê chuột / chạm để xem giải thích + dự đoán tác động lên vàng. */
import type { CalEvent } from "../../api/types";
import { useLang, useT } from "../../i18n/lang";
import { weekdayEn } from "./calendarText";

function Event({ e }: { e: CalEvent }) {
  const t = useT();
  const [lang] = useLang();
  const en = lang === "en";
  const meta = [e.forecast && t("DB: ", "Fcst: ") + e.forecast, e.previous && t("Trước: ", "Prev: ") + e.previous].filter(Boolean);
  const up = e.hot !== "giảm";                      // số cao hơn dự báo → vàng tăng?
  const word = (rise: boolean) => (en ? (rise ? "up" : "down") : rise ? "tăng" : "giảm");
  return (
    <div className="evt" tabIndex={0}>
      <div className="when">{en ? weekdayEn(e.wd) : e.wd} {e.day}<small>{e.time}</small></div>
      <div>
        <div className="etitle">{e.title} <span className="ic">ⓘ</span></div>
        {meta.length > 0 && <div className="emeta">{meta.join(" · ")}</div>}
      </div>
      <span className={"imp " + e.impact}>{e.impact === "High" ? t("MẠNH", "HIGH") : t("Vừa", "Medium")}</span>
      <div className="tip">
        <div className="tip-h">{e.title}</div>
        <p>{e.desc}</p>
        <p><b>{t("Ảnh hưởng vàng:", "Impact on gold:")}</b> {e.mech}</p>
        <p className="tip-pred">
          <b>🎯 {t("Dự đoán:", "Expectation:")}</b>{" "}
          {t("Số thực tế cao hơn dự báo", "Actual above forecast")}{e.forecast ? ` (${e.forecast})` : ""} → {t("vàng", "gold")}{" "}
          <b className={up ? "up" : "down"}>{word(up)}</b>; {t("thấp hơn → vàng", "below → gold")} <b className={up ? "down" : "up"}>{word(!up)}</b>.
        </p>
      </div>
    </div>
  );
}

export function EconCalendar({ events, stamp }: { events: CalEvent[] | undefined; stamp: string | null | undefined }) {
  const t = useT();
  return (
    <section className="cal">
      <h2>{t("Lịch kinh tế Mỹ · tin dễ giật vàng", "US economic calendar · gold-moving news")}</h2>
      <p className="note">
        {t("Giờ Việt Nam (GMT+7)", "Vietnam time (GMT+7)")} · <b>High</b> = {t("tác động mạnh · tự cập nhật mỗi tuần.", "high impact · updated weekly.")}{" "}
        {stamp ? `· ${t("lấy lúc", "fetched at")} ${stamp}` : ""}
      </p>
      {events == null ? <p className="note">{t("Đang tải lịch…", "Loading calendar…")}</p>
        : events.length === 0 ? <p className="note">{t("Chưa có tin sắp tới (hoặc đang tải).", "No upcoming events (or still loading).")}</p>
        : events.map((e) => <Event key={e.ts + e.title} e={e} />)}
    </section>
  );
}
