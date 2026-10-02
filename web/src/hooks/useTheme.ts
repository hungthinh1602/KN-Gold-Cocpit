/**
 * Chế độ màu Tối / Sáng — dùng chung toàn app (nút ở tiêu đề, chart đổi màu theo).
 * Lưu localStorage "theme"; gắn <html data-theme="light|dark"> để CSS đổi bộ biến màu.
 * index.html đã đặt sẵn data-theme trước khi React chạy (không bị nháy màu khi tải trang).
 */
import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function read(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("theme", t);
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
  listeners.forEach((fn) => fn());
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
  );
  return [theme, setTheme];
}
