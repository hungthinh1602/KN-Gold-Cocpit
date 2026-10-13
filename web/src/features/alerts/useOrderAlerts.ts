/**
 * Theo dõi danh sách lệnh (mỗi lần tải /api/orders): sự kiện MỚI so với lần trước → âm thanh + ô báo + thông báo hệ thống.
 * Lần tải đầu chỉ ghi nhận (không báo lại lịch sử cũ).
 */
import { useEffect, useRef, useState } from "react";
import type { OrdersData } from "../../api/types";
import { pick, useLang } from "../../i18n/lang";
import { beep, classify, orderLabel, systemNotify, type Tone } from "./alerts";

export interface Toast { id: string; tone: Tone; title: string; body: string }

const TOAST_MS = 9000;
const MAX_TOASTS = 4;

export function useOrderAlerts(data: OrdersData | null) {
  const [lang] = useLang();
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!data) return;
    const keys = new Set<string>();
    const fresh: Toast[] = [];
    for (const o of data.orders) {
      (o.events || []).forEach((e, i) => {
        const key = `${o.id}#${i}`;
        keys.add(key);
        if (!seen.current || seen.current.has(key) || o.test) return;
        const c = classify(e);
        if (c) fresh.push({ id: key, tone: c.tone, title: pick(lang, c.vi, c.en), body: `${orderLabel(o)} — ${e.text}` });
      });
    }
    seen.current = keys;
    if (!fresh.length) return;
    const worst: Tone = fresh.some((t) => t.tone === "bad") ? "bad" : fresh.some((t) => t.tone === "good") ? "good" : "info";
    beep(worst);
    fresh.forEach((t) => systemNotify(t.title, t.body));
    setToasts((cur) => [...fresh, ...cur].slice(0, MAX_TOASTS));
    const ids = fresh.map((t) => t.id);
    window.setTimeout(() => setToasts((cur) => cur.filter((t) => !ids.includes(t.id))), TOAST_MS);
  }, [data, lang]);

  const dismiss = (id: string) => setToasts((cur) => cur.filter((t) => t.id !== id));
  return { toasts, dismiss };
}
