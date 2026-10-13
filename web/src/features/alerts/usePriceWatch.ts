/**
 * Canh giá ở MỌI tab (chạy trong App):
 *   - giá MT5 mỗi 3 giây (/api/tick) — chỉ khi có mức tự đặt hoặc bật "chạm vùng"
 *   - vùng/mức của khung đang chọn ở tab AI mỗi 60 giây (/api/ai/levels)
 * Mức tự đặt: giá đi QUA mức → báo 1 lần rồi xoá. Vùng: giá ĐI VÀO vùng (Cung/Cầu, OTE) hoặc đi qua mức
 * Strong/Weak → báo; cùng 1 vùng/mức không báo lại trong 15 phút.
 */
import { useEffect, useRef } from "react";
import { api, type AiLevels } from "../../api/client";
import { pick, useLang } from "../../i18n/lang";
import { notify } from "./alerts";
import { getPriceAlerts, getZoneAlerts, removePriceAlert, usePriceAlerts, useZoneAlerts } from "./priceAlerts";

const TICK_MS = 3000;
const LEVELS_MS = 60_000;
const COOLDOWN_SEC = 15 * 60;

const f2 = (x: number) => x.toFixed(2);
const crossed = (prev: number, cur: number, level: number) => (prev - level) * (cur - level) <= 0 && prev !== cur;

export function usePriceWatch() {
  const [lang] = useLang();
  const alerts = usePriceAlerts();
  const zoneOn = useZoneAlerts();
  const active = alerts.length > 0 || zoneOn;
  const prev = useRef<number | null>(null);
  const levels = useRef<AiLevels | null>(null);
  const fired = useRef(new Map<string, number>());      // vùng/mức → lần báo cuối (giây)
  const langRef = useRef(lang);
  langRef.current = lang;

  // vùng/mức của khung đang xem ở tab AI
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

  // giá + kiểm tra chạm
  useEffect(() => {
    if (!active) {
      prev.current = null;
      return;
    }
    const check = async () => {
      let cur: number;
      try {
        const tk = await api.tick();
        if (tk.bid == null) return;
        cur = tk.bid;
      } catch {
        return;
      }
      const p = prev.current;
      prev.current = cur;
      if (p == null) return;                                   // lần đầu: chỉ ghi nhận giá
      const t = (vi: string, en: string) => pick(langRef.current, vi, en);
      const dir = cur > p ? t("đi lên", "rising") : t("đi xuống", "falling");

      for (const a of getPriceAlerts()) {
        if (!crossed(p, cur, a.price)) continue;
        notify("info", `🔔 ${t("Giá chạm", "Price hit")} ${f2(a.price)}`, `XAUUSD ${f2(cur)} · ${dir}`);
        removePriceAlert(a.id);
      }

      const L = levels.current;
      if (!getZoneAlerts() || !L) return;
      const now = Date.now() / 1000;
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
    const id = window.setInterval(check, TICK_MS);
    void check();
    return () => window.clearInterval(id);
  }, [active]);
}
