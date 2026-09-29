/** Tin vàng mới nhất từ Google News RSS. */
import { fetchText } from "../lib/http.js";

const NEWS_URL = "https://news.google.com/rss/search?q=gold%20price%20XAUUSD&hl=en-US&gl=US&ceid=US:en";

export interface NewsItem {
  title: string;
  source: string;
  link: string;
  ago: string;
}

function ago(d: Date): string {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

/** Giải mã thực thể XML/HTML (&amp; &quot; &#39;…) để giao diện hiện chữ thường. */
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m);

export async function fetchNews(): Promise<NewsItem[]> {
  const xml = await fetchText(NEWS_URL);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((m) => m[1]);
  const grab = (it: string, tag: string) =>
    decode((it.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim());
  const out: NewsItem[] = [];
  for (const it of items) {
    let title = grab(it, "title");
    let source = "";
    const cut = title.lastIndexOf(" - ");            // Google News: "Tiêu đề - Nguồn"
    if (cut > 0) {
      source = title.slice(cut + 3).trim();
      title = title.slice(0, cut).trim();
    }
    const d = new Date(grab(it, "pubDate"));
    if (title) out.push({ title, source, link: grab(it, "link"), ago: Number.isNaN(d.getTime()) ? "" : ago(d) });
  }
  return out;
}
