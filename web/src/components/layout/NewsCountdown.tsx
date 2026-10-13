/**
 * Thanh đếm ngược tới tin kinh tế MẠNH (High) kế tiếp — ngay dưới thanh phiên.
 *   > 30 phút: bình thường · ≤ 30 phút: vàng · ≤ 10 phút: đỏ nhấp nháy · vừa ra (≤ 15 phút trước): báo "vừa ra"
 * Nhiều tin cùng giờ gộp 1 dòng. Không có tin mạnh sắp tới → ẩn.
 */
import { useEffect, useState } from "react";
import type { CalEvent } from "../../api/types";
import { useLang } from "../../i18n/lang";
import { weekdayEn } from "../../features/macro/calendarText";

const JUST_RELEASED_SEC = 15 * 60;

function fmtLeft(sec: number, en: boolean) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h >= 24) { const d = Math.floor(h / 24); return en ? `${d}d ${h % 24}h` : `${d} ngày ${h % 24} giờ`; }
  if (h > 0) return en ? `${h}h ${m}m` : `${h} giờ ${m} phút`;
  return en ? `${m}m ${String(s).padStart(2, "0")}s` : `${m} phút ${String(s).padStart(2, "0")} giây`;
}

export function NewsCountdown({ events }: { events: CalEvent[] | undefined }) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [lang] = useLang();
  const en = lang === "en";
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => window.clearInterval(id);
  }, []);

  const high = (events ?? []).filter((e) => e.impact === "High" && e.ts > now - JUST_RELEASED_SEC).sort((a, b) => a.ts - b.ts);
  if (!high.length) return null;
  const ts = high[0].ts;
  const group = high.filter((e) => e.ts === ts);           // các tin ra cùng giờ
  const left = ts - now;
  const level = left <= 0 ? "out" : left <= 600 ? "red" : left <= 1800 ? "amber" : "calm";
  const titles = group.map((e) => e.title).join(" · ");
  const when = `${en ? weekdayEn(group[0].wd) : group[0].wd} ${group[0].day} ${group[0].time}`;

  return (
    <div className={"news-cd " + level} role="status">
      <span className="news-cd-ic">{level === "out" ? "📢" : "⏰"}</span>
      <span className="news-cd-main">
        {level === "out"
          ? <>{en ? "Just released:" : "Vừa ra tin:"} <b>{titles}</b> — {en ? `${Math.max(1, Math.round(-left / 60))} min ago, expect volatility` : `${Math.max(1, Math.round(-left / 60))} phút trước, cẩn thận biến động`}</>
          : <><b>{titles}</b> {en ? "in" : "còn"} <b className="news-cd-left">{fmtLeft(left, en)}</b></>}
      </span>
      <span className="news-cd-when">
        {when} {en ? "(VN time)" : "(giờ VN)"}
        {level === "red" && <> · {en ? "avoid new entries" : "hạn chế vào lệnh mới"}</>}
      </span>
    </div>
  );
}
