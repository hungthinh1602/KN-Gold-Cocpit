/**
 * Cảnh báo giá — LƯU TRÊN SERVER (máy nào cũng thấy; server tự canh giá 24/7 kể cả khi không mở web).
 * Store phía web: danh sách mức đang chờ + giá hiện tại (cập nhật mỗi 3 giây bởi usePriceWatch).
 * Bật/tắt "báo chạm vùng" vẫn lưu theo từng máy (localStorage "zoneAlerts").
 */
import { useSyncExternalStore } from "react";
import { api, type AlertsData, type ServerAlert } from "../../api/client";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

let alerts: ServerAlert[] = [];
let bid: number | null = null;
let zoneOn: boolean = (() => {
  try {
    return localStorage.getItem("zoneAlerts") !== "false";
  } catch {
    return true;
  }
})();

/** usePriceWatch gọi mỗi lần tải /api/alerts. */
export function setAlertsData(d: AlertsData) {
  alerts = [...d.alerts].sort((a, b) => b.price - a.price);
  bid = d.bid;
  emit();
}

async function refresh() {
  try {
    setAlertsData(await api.alerts());
  } catch {
    /* lần tải sau sẽ cập nhật */
  }
}

export async function addPriceAlert(price: number, note = "") {
  if (!Number.isFinite(price) || price <= 0) return;
  await api.addAlert(Math.round(price * 100) / 100, note);
  await refresh();
}

export async function updatePriceAlert(id: string, patch: { price?: number; note?: string }) {
  alerts = alerts.map((a) => (a.id === id ? { ...a, ...patch } : a));   // hiện ngay, server xác nhận sau
  emit();
  await api.updateAlert(id, patch);
  await refresh();
}

export async function removePriceAlert(id: string) {
  alerts = alerts.filter((a) => a.id !== id);
  emit();
  await api.deleteAlert(id);
  await refresh();
}

export function setZoneAlerts(on: boolean) {
  zoneOn = on;
  try {
    localStorage.setItem("zoneAlerts", String(on));
  } catch {
    /* bỏ qua */
  }
  emit();
}

export const usePriceAlerts = () => useSyncExternalStore(subscribe, () => alerts);
export const useLiveBid = () => useSyncExternalStore(subscribe, () => bid);
export const useZoneAlerts = () => useSyncExternalStore(subscribe, () => zoneOn);
export const getZoneAlerts = () => zoneOn;
