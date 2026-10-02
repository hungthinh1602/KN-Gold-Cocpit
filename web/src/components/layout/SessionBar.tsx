/** Khung phiên giao dịch 24h (giờ VN) + vạch giờ hiện tại. Tự làm mới mỗi 30 giây. */
import { useEffect, useState } from "react";
import { SESSIONS, sessionState } from "../../lib/sessions";
import { useLang } from "../../i18n/lang";

const pct = (min: number) => min / 14.4; // 1440 phút = 100%
const hh = (min: number) => String(Math.floor(min / 60)).padStart(2, "0");

export function SessionBar() {
  const [now, setNow] = useState(() => new Date());
  const [lang] = useLang();
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const s = sessionState(now, lang);
  const hasLon = s.open.includes("London");
  const hasNy = s.open.includes("New York");
  const liquidity = hasLon && hasNy ? t(" · giao phiên London–NY, thanh khoản cao nhất", " · London–NY overlap, highest liquidity")
    : hasLon || hasNy ? t(" · thanh khoản cao", " · high liquidity") : t(" · thanh khoản thấp", " · low liquidity");

  return (
    <section className="sess">
      <div className="sess-top">
        <span className="sess-now">🕒 {s.clock} {t("(giờ VN)", "(Vietnam time)")}</span>
        <span className="sess-st">
          {s.weekend ? t("Cuối tuần — thị trường nghỉ", "Weekend — market closed")
            : s.open.length ? <>{t("Đang mở:", "Open:")} <b>{s.open.join(" + ")}</b>{liquidity}</>
            : t("Giữa các phiên", "Between sessions")}
        </span>
      </div>
      <div className="sess-grid">
        <div className="sess-names">{SESSIONS.map((x) => <div key={x.name}>{x.name}</div>)}</div>
        <div className="sess-track">
          <div className="sess-ticks">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{h}</span>)}</div>
          <div className="sess-rows">
            {s.rows.map(({ def, start, end, on }) => {
              const parts = start < end ? [[start, end]] : [[start, 1440], [0, end]];
              return (
                <div key={def.name} className="sess-row" title={`${def.name} ${hh(start)}:00–${hh(end)}:00 ${t("(giờ VN)", "(Vietnam time)")}`}>
                  {parts.map(([a, b]) => (
                    <div key={a} className={"sess-bar" + (on ? " on" : "")}
                      style={{ left: `${pct(a)}%`, width: `${pct(b - a)}%`, background: def.color }} />
                  ))}
                </div>
              );
            })}
          </div>
          <div className="sess-mark" style={{ left: `calc(${pct(s.vnMin)}% - 1px)` }} />
        </div>
      </div>
    </section>
  );
}
