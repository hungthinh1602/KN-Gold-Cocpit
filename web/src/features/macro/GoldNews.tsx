/** Tin vàng mới nhất (Google News) — bấm để tìm bài gốc. */
import type { NewsItem } from "../../api/types";

export function GoldNews({ news, stamp }: { news: NewsItem[] | undefined; stamp: string | null | undefined }) {
  return (
    <section className="news">
      <h2>Tin vàng mới nhất</h2>
      <p className="note">Nguồn Google News · tự cập nhật 30 phút/lần {stamp ? `· lúc ${stamp}` : ""}</p>
      {news == null ? <p className="note">Đang tải tin…</p>
        : news.length === 0 ? <p className="note">Chưa có tin (đang tải).</p>
        : news.map((n) => (
          <a key={n.title} className="nitem" target="_blank" rel="noopener"
            href={"https://www.google.com/search?q=" + encodeURIComponent(n.title + " " + (n.source || ""))}>
            <div className="ntitle">{n.title}</div>
            <div className="nmeta">{[n.source, n.ago, "🔍 tìm để đọc"].filter(Boolean).join(" · ")}</div>
          </a>
        ))}
    </section>
  );
}
