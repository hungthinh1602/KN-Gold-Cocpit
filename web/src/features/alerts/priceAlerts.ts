/**
 * Cảnh báo giá: các mức giá người dùng tự đặt (chạm → báo 1 lần rồi tự xoá) + bật/tắt báo "giá chạm vùng".
 * Lưu localStorage của từng máy ("priceAlerts", "zoneAlerts") — mỗi người xem có danh sách riêng.
 */
import { useSyncExternalStore } from "react";

export interface PriceAlert { id: string; price: number; created: number }

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* bỏ qua */
  }
}

let alerts: PriceAlert[] = load<PriceAlert[]>("priceAlerts", []);
let zoneOn: boolean = load<boolean>("zoneAlerts", true);

export function addPriceAlert(price: number) {
  if (!Number.isFinite(price) || price <= 0) return;
  alerts = [...alerts, { id: `a${Date.now()}`, price: Math.round(price * 100) / 100, created: Date.now() / 1000 }]
    .sort((a, b) => b.price - a.price);
  save("priceAlerts", alerts);
  emit();
}

export function removePriceAlert(id: string) {
  alerts = alerts.filter((a) => a.id !== id);
  save("priceAlerts", alerts);
  emit();
}

export function setZoneAlerts(on: boolean) {
  zoneOn = on;
  save("zoneAlerts", on);
  emit();
}

export const usePriceAlerts = () => useSyncExternalStore(subscribe, () => alerts);
export const useZoneAlerts = () => useSyncExternalStore(subscribe, () => zoneOn);
export const getPriceAlerts = () => alerts;
export const getZoneAlerts = () => zoneOn;
