/**
 * Theo dõi danh sách lệnh (mỗi lần tải /api/orders): sự kiện MỚI so với lần trước → âm thanh + ô báo + thông báo hệ thống.
 * Lần tải đầu chỉ ghi nhận (không báo lại lịch sử cũ). Lệnh test không báo.
 */
import { useEffect, useRef } from "react";
import type { OrdersData } from "../../api/types";
import { pick, useLang } from "../../i18n/lang";
import { beep, classify, notify, orderLabel, type Tone } from "./alerts";

export function useOrderAlerts(data: OrdersData | null) {
  const [lang] = useLang();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const keys = new Set<string>();
    const fresh: { tone: Tone; title: string; body: string }[] = [];
    for (const o of data.orders) {
      (o.events || []).forEach((e, i) => {
        const key = `${o.id}#${i}`;
        keys.add(key);
        if (!seen.current || seen.current.has(key) || o.test) return;
        const c = classify(e);
        if (c) fresh.push({ tone: c.tone, title: pick(lang, c.vi, c.en), body: `${orderLabel(o)} — ${e.text}` });
      });
    }
    seen.current = keys;
    if (!fresh.length) return;
    beep(fresh.some((t) => t.tone === "bad") ? "bad" : fresh.some((t) => t.tone === "good") ? "good" : "info");   // 1 tiếng cho cả đợt
    fresh.forEach((t) => notify(t.tone, t.title, t.body, false));
  }, [data, lang]);
}
