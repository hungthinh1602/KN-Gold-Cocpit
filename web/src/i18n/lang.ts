/**
 * Ngôn ngữ giao diện: Tiếng Việt (bản chính) / English.
 * Dùng trong component:  const t = useT();  t("Tiếng Việt", "English")
 * Ngoài component (hàm thuần): nhận `t` làm tham số, hoặc dùng pick(lang, vi, en).
 * Lưu localStorage "lang"; gắn <html lang>.
 */
import { useSyncExternalStore } from "react";

export type Lang = "vi" | "en";
export type T = (vi: string, en: string) => string;

const listeners = new Set<() => void>();
let current: Lang = (() => {
  try {
    return localStorage.getItem("lang") === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
})();
document.documentElement.lang = current;

export function setLang(l: Lang) {
  current = l;
  document.documentElement.lang = l;
  try {
    localStorage.setItem("lang", l);
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
  listeners.forEach((fn) => fn());
}

export const pick = (lang: Lang, vi: string, en: string) => (lang === "en" ? en : vi);

export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
  return [lang, setLang];
}

/** Hàm dịch cho component: t("vi", "en"). */
export function useT(): T {
  const [lang] = useLang();
  return (vi, en) => (lang === "en" ? en : vi);
}

/** Định dạng ngày giờ theo ngôn ngữ (vi-VN / en-GB, giờ Việt Nam). */
export const locale = (lang: Lang) => (lang === "en" ? "en-GB" : "vi-VN");
