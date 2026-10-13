/**
 * Thông báo Lệnh Live: phân loại sự kiện lệnh, âm thanh (Web Audio — không cần file), thông báo hệ thống.
 * Cài đặt bật/tắt lưu localStorage "alertSound" (dùng chung toàn app như useTheme).
 */
import { useSyncExternalStore } from "react";
import type { Order, OrderEvent } from "../../api/types";

export type Tone = "good" | "bad" | "info";

/** Sự kiện nào cần báo + kiểu âm. EDIT (sửa SL/TP) không báo. */
export function classify(e: OrderEvent): { tone: Tone; vi: string; en: string } | null {
  const c = e.code;
  if (c === "NEW") return { tone: "info", vi: "📥 Lệnh mới", en: "📥 New order" };
  if (c.startsWith("ENTRY")) return { tone: "info", vi: "✅ Khớp Entry", en: "✅ Entry filled" };
  if (c === "PIP50") return { tone: "good", vi: "💰 Đạt +50 pip", en: "💰 +50 pips reached" };
  if (c === "PIP100") return { tone: "good", vi: "🏆 Đạt +100 pip", en: "🏆 +100 pips reached" };
  if (c.startsWith("TP")) return { tone: "good", vi: "🎯 Đạt TP", en: "🎯 Take profit hit" };
  if (c === "SL") return { tone: "bad", vi: "❌ Dính SL", en: "❌ Stop loss hit" };
  if (c === "CLOSE") return { tone: "info", vi: "🔒 Đóng lệnh", en: "🔒 Order closed" };
  if (c === "CANCEL") return { tone: "info", vi: "🚫 Hủy lệnh", en: "🚫 Order cancelled" };
  return null;
}

export const orderLabel = (o: Order) => `${o.side} ${o.indi}${o.tf ? " · " + o.tf : ""}`;

// ------------------------------------------------------------------ bật/tắt (store dùng chung)
const listeners = new Set<() => void>();
let soundOn = (() => {
  try {
    return localStorage.getItem("alertSound") !== "0";
  } catch {
    return true;
  }
})();

export function setSoundOn(on: boolean) {
  soundOn = on;
  try {
    localStorage.setItem("alertSound", on ? "1" : "0");
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((fn) => fn());
  if (on) {
    unlockAudio();
    askNotifyPermission();
  }
}

export function useSoundOn(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, () => soundOn);
  return [on, setSoundOn];
}

// ------------------------------------------------------------------ âm thanh
let ctx: AudioContext | null = null;

/** Trình duyệt chỉ cho phát âm sau khi người dùng bấm/chạm trang 1 lần → mở khoá ở lần bấm đầu. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* trình duyệt không hỗ trợ */
  }
}
if (typeof window !== "undefined") window.addEventListener("pointerdown", unlockAudio, { once: true });

const TONES: Record<Tone, number[]> = {
  good: [660, 880, 1175],    // đi lên — tin vui
  bad: [523, 392, 262],      // đi xuống — dính SL
  info: [784, 784],          // 2 tiếng ngắn
};

export function beep(tone: Tone) {
  if (!soundOn || !ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  TONES[tone].forEach((f, i) => {
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const s = t0 + i * 0.16;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.25, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.14);
    osc.connect(g).connect(ctx!.destination);
    osc.start(s);
    osc.stop(s + 0.15);
  });
}

// ------------------------------------------------------------------ thông báo hệ thống (cần HTTPS hoặc localhost)
export const canNotify = () => typeof window !== "undefined" && "Notification" in window && window.isSecureContext;

export function askNotifyPermission() {
  if (canNotify() && Notification.permission === "default") void Notification.requestPermission();
}

export function systemNotify(title: string, body: string) {
  if (!soundOn || !canNotify() || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;   // đang xem web → đã có ô báo trong trang
  const opts = { body, tag: title + body, icon: "/icons/icon-192.png" };
  // Điện thoại (Android/app đã cài) chỉ cho báo qua service worker; máy tính dùng Notification trực tiếp.
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    void navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => undefined);
    return;
  }
  try {
    new Notification(title, opts);
  } catch {
    /* trình duyệt không cho → đã có âm thanh + ô báo trong trang */
  }
}

// ------------------------------------------------------------------ ô báo trong trang (dùng chung: lệnh, cảnh báo giá, chạm vùng)
export interface Toast { id: string; tone: Tone; title: string; body: string }

const TOAST_MS = 9000;
const MAX_TOASTS = 4;
const toastListeners = new Set<() => void>();
let toasts: Toast[] = [];
let toastSeq = 0;

function setToasts(next: Toast[]) {
  toasts = next;
  toastListeners.forEach((fn) => fn());
}

export function dismissToast(id: string) {
  setToasts(toasts.filter((t) => t.id !== id));
}

/** Báo 1 việc: ô báo trong trang + thông báo hệ thống (+ âm thanh nếu sound = true). */
export function notify(tone: Tone, title: string, body: string, sound = true) {
  const id = `t${++toastSeq}`;
  setToasts([{ id, tone, title, body }, ...toasts].slice(0, MAX_TOASTS));
  window.setTimeout(() => dismissToast(id), TOAST_MS);
  systemNotify(title, body);
  if (sound) beep(tone);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore((fn) => {
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, () => toasts);
}
