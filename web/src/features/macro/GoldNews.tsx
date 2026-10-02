/** Tin vàng mới nhất (Google News) — bấm để tìm bài gốc. */
import type { NewsItem } from "../../api/types";
import { useLang, useT } from "../../i18n/lang";
import { agoEn } from "./calendarText";

export function GoldNews({ news, stamp }: { news: NewsItem[] | undefined; stamp: string | null | undefined }) {
  const t = useT();
  const [lang] = useLang();
  return (
    <section className="news">
      <h2>{t("Tin vàng mới nhất", "Latest gold news")}</h2>
      <p className="note">
        {t("Nguồn Google News · tự cập nhật 30 phút/lần", "Source: Google News · refreshed every 30 min")} {stamp ? `· ${t("lúc", "at")} ${stamp}` : ""}
      </p>
      {news == null ? <p className="note">{t("Đang tải tin…", "Loading news…")}</p>
        : news.length === 0 ? <p className="note">{t("Chưa có tin (đang tải).", "No news yet (loading).")}</p>
        : news.map((n) => (
          <a key={n.title} className="nitem" target="_blank" rel="noopener"
            href={"https://www.google.com/search?q=" + encodeURIComponent(n.title + " " + (n.source || ""))}>
            <div className="ntitle">{n.title}</div>
            <div className="nmeta">
              {[n.source, lang === "en" ? agoEn(n.ago) : n.ago, t("🔍 tìm để đọc", "🔍 search to read")].filter(Boolean).join(" · ")}
            </div>
          </a>
        ))}
    </section>
  );
}
