/**
 * Dàn trang bài phân tích dạng chữ (bài tự động hoặc bài chuyên sâu đẩy lên):
 *   "① TIÊU ĐỀ" → mục có số · "• …" → dòng gạch đầu · "– …" → dòng con · "→ …" → dòng kết luận
 *   "• H1 : GIẢM (LH-LL) · … · HT x / KC y" → hàng bảng xu hướng đa khung
 * Tô màu: GIẢM/BÁN đỏ, TĂNG/MUA xanh, ĐI NGANG vàng; giá và % in đậm kiểu số (không tô màu theo dấu —
 * "US10Y giảm -1%" là TỐT cho vàng, tô đỏ sẽ gây hiểu nhầm).
 */
import type { ReactNode } from "react";

const TFS = "M1|M5|M15|M30|H1|H4|D1|W1|MN";
const TREND_RE = new RegExp(`^(${TFS})\\s*:\\s*(TĂNG|GIẢM|ĐI NGANG|SIDEWAY)\\s*(\\([^)]*\\))?\\s*(?:·\\s*(.*))?$`);
const TF_RE = new RegExp(`^(${TFS})\\s*:\\s*(.+)$`);
const TOKEN_RE = /(GIẢM|BÁN|TĂNG|MUA|ĐI NGANG|SIDEWAY|[+-]\d+(?:\.\d+)?%|\d{3,5}(?:\.\d+)?(?:\s*[–-]\s*\d{3,5}(?:\.\d+)?)?)/g;

/** Tô màu từ khoá + in đậm con số trong 1 dòng chữ. */
export function rich(text: string): ReactNode[] {
  return text.split(TOKEN_RE).map((part, i) => {
    if (i % 2 === 0) return part;
    if (part === "GIẢM" || part === "BÁN") return <b key={i} className="nv-dn">{part}</b>;
    if (part === "TĂNG" || part === "MUA") return <b key={i} className="nv-up">{part}</b>;
    if (part === "ĐI NGANG" || part === "SIDEWAY") return <b key={i} className="nv-sw">{part}</b>;
    return <b key={i} className="nv-num">{part}</b>;
  });
}

const trendCls = (t: string) => (t === "TĂNG" ? "up" : t === "GIẢM" ? "dn" : "sw");
const trendArrow = (t: string) => (t === "TĂNG" ? "▲" : t === "GIẢM" ? "▼" : "◆");

function TrendRow({ m }: { m: RegExpMatchArray }) {
  const [, tf, trend, structure, rest = ""] = m;
  const parts = rest.split(/\s*·\s*/).filter(Boolean);
  const levels = parts.find((p) => /^HT\s/.test(p));
  const notes = parts.filter((p) => p !== levels);
  return (
    <div className="nv-trend">
      <span className="nv-tf">{tf}</span>
      <span className={"nv-pill " + trendCls(trend)}>{trend} {trendArrow(trend)}</span>
      <span className="nv-struct">{structure?.replace(/[()]/g, "")}</span>
      <span className="nv-event">{notes.join(" · ")}</span>
      {levels && <span className="nv-levels">{rich(levels)}</span>}
    </div>
  );
}

function Line({ raw }: { raw: string }) {
  const t = raw.trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^•\s*(.+)$/))) {
    const body = m[1];
    const tr = body.match(TREND_RE);
    if (tr) return <TrendRow m={tr} />;
    const tfm = body.match(TF_RE);
    if (tfm) return <div className="nv-bullet"><span className="nv-tf">{tfm[1]}</span><span>{rich(tfm[2])}</span></div>;
    return <div className="nv-bullet"><span className="nv-dot" /><span>{rich(body)}</span></div>;
  }
  if ((m = t.match(/^[–-]\s*(.+)$/))) return <div className="nv-sub">{rich(m[1])}</div>;
  if ((m = t.match(/^→\s*(.+)$/))) return <div className="nv-arrow">→ {rich(m[1])}</div>;
  return <p className="nv-p">{rich(t)}</p>;
}

interface Section { num: string | null; title: string; lines: string[] }

function parse(text: string) {
  const sections: Section[] = [];
  let foot = "";
  let cur: Section = { num: null, title: "", lines: [] };
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    const h = t.match(/^([①-⑳])\s*(.+)$/);
    if (h) {
      if (cur.num || cur.lines.length) sections.push(cur);
      cur = { num: h[1], title: h[2], lines: [] };
    } else if (/lời khuyên đầu tư/i.test(t)) foot = t;
    else cur.lines.push(raw);
  }
  if (cur.num || cur.lines.length) sections.push(cur);
  return { sections, foot };
}

export function NarrativeBody({ text, empty }: { text: string; empty: string }) {
  if (!text.trim()) return <div className="nv-empty">{empty}</div>;
  const { sections, foot } = parse(text);
  return (
    <div className="nv">
      <div className="nv-grid">
        {sections.map((s, i) => {
          const wide = s.lines.some((l) => TREND_RE.test(l.trim().replace(/^•\s*/, "")));
          const key = /KỊCH BẢN/i.test(s.title);
          return (
            <section key={i} className={"nv-sec" + (wide ? " wide" : "") + (key ? " key" : "") + (s.num ? "" : " plain")}>
              {s.num && <div className="nv-h"><span className="nv-num-badge">{s.num}</span>{s.title}</div>}
              {s.lines.map((l, j) => <Line key={j} raw={l} />)}
            </section>
          );
        })}
      </div>
      {foot && <div className="nv-foot">{foot}</div>}
    </div>
  );
}
