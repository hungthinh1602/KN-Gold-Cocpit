/**
 * Chạy trong App (mọi tab):
 *   - mỗi 3 giây tải /api/alerts: danh sách mức cảnh báo + các lần ĐÃ CHẠM (server tự canh 24/7) + giá hiện tại
 *     → lần chạm mới → âm thanh + ô báo + thông báo hệ thống (lần tải đầu chỉ ghi nhận, không báo lại cái cũ)
 *   - "báo chạm vùng": vùng/mức của khung đang chọn ở tab AI (/api/ai/levels mỗi 60 giây), so với giá mỗi 3 giây.
 *     Giá ĐI VÀO vùng Cung/Cầu, OTE hoặc đi qua Strong/Weak → báo; cùng 1 vùng/mức không báo lại trong 15 phút.
 */
import { useEffect, useRef } from "react";
import { api, type AiLevels } from "../../api/client";
import { pick, useLang } from "../../i18n/lang";
import { notify } from "./alerts";
import { getZoneAlerts, setAlertsData, useZoneAlerts } from "./priceAlerts";

const POLL_MS = 3000;
const LEVELS_MS = 60_000;
const COOLDOWN_SEC = 15 * 60;

const f2 = (x: number) => x.toFixed(2);
const crossed = (prev: number, cur: number, level: number) => (prev - level) * (cur - level) <= 0 && prev !== cur;

export function usePriceWatch() {
  const [lang] = useLang();
  const zoneOn = useZoneAlerts();
  const prev = useRef<number | null>(null);
  const seenHits = useRef<Set<string> | null>(null);
  const levels = useRef<AiLevels | null>(null);
  const fired = useRef(new Map<string, number>());
  const langRef = useRef(lang);
  langRef.current = lang;

  // vùng/mức của khung đang xem ở tab AI (chỉ khi bật "báo chạm vùng")
  useEffect(() => {
    if (!zoneOn) return;
    let stop = false;
    const load = async () => {
      let tf = "H1";
      try {
        tf = localStorage.getItem("aitf") || "H1";
      } catch {
        /* mặc định H1 */
      }
      try {
        const d = await api.aiLevels(tf);
        if (!stop && !d.error) levels.current = d;
      } catch {
        /* lần sau thử lại */
      }
    };
    void load();
    const id = window.setInterval(load, LEVELS_MS);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [zoneOn]);

  useEffect(() => {
    const t = (vi: string, en: string) => pick(langRef.current, vi, en);
    const poll = async () => {
      let d;
      try {
        d = await api.alerts();
      } catch {
        return;
      }
      setAlertsData(d);

      // 1) mức tự đặt đã chạm (server ghi lại)
      const ids = new Set(d.hits.map((h) => h.id));
      if (seenHits.current) {
        for (const h of d.hits) {
          if (seenHits.current.has(h.id)) continue;
          const arrow = h.dir === "up" ? "↑" : "↓";
          notify("info", `🔔 ${t("Giá chạm", "Price hit")} ${arrow} ${f2(h.price)}${h.note ? ` · ${h.note}` : ""}`,
            `XAUUSD ${f2(h.hit)} · ${new Date(h.ts * 1000).toLocaleTimeString(langRef.current === "en" ? "en-GB" : "vi-VN")}`);
        }
      }
      seenHits.current = ids;

      // 2) giá chạm vùng của khung đang xem
      const cur = d.bid;
      const p = prev.current;
      prev.current = cur;
      const L = levels.current;
      if (cur == null || p == null || !getZoneAlerts() || !L) return;
      const now = Date.now() / 1000;
      const dir = cur > p ? t("đi lên", "rising") : t("đi xuống", "falling");
      const once = (key: string, title: string, body: string) => {
        if (now - (fired.current.get(key) ?? 0) < COOLDOWN_SEC) return;
        fired.current.set(key, now);
        notify("info", title, body);
      };
      const inside = (x: number, lo: number, hi: number) => x >= lo && x <= hi;
      for (const z of L.zones) {
        if (inside(cur, z.bottom, z.top) && !inside(p, z.bottom, z.top)) {
          const name = z.kind === "demand" ? t("vùng Cầu", "demand zone") : t("vùng Cung", "supply zone");
          once(`z:${z.kind}:${z.top}:${z.bottom}`, `📦 ${t("Giá vào", "Price entered")} ${name} · ${L.tf}`,
            `${f2(z.bottom)} – ${f2(z.top)} · XAUUSD ${f2(cur)}`);
        }
      }
      for (const o of L.ote) {
        if (inside(cur, o.bottom, o.top) && !inside(p, o.bottom, o.top)) {
          once(`o:${o.school}:${o.top}:${o.bottom}`, `🎯 ${t("Giá vào vùng OTE", "Price entered OTE zone")} ${o.school.toUpperCase()} · ${L.tf}`,
            `${f2(o.bottom)} – ${f2(o.top)} · XAUUSD ${f2(cur)}`);
        }
      }
      for (const lv of L.levels) {
        if (!crossed(p, cur, lv.price)) continue;
        const name = lv.kind.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());   // strong_low → Strong Low
        once(`l:${lv.kind}:${lv.price}`, `🧱 ${t("Giá chạm", "Price hit")} ${name} · ${L.tf}`, `${f2(lv.price)} · XAUUSD ${f2(cur)} · ${dir}`);
      }
    };
    void poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, []);
}
