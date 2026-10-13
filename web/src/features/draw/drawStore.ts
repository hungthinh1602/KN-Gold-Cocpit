/**
 * Hình vẽ tay (lưu trên server) + công cụ đang chọn + hình đang chọn — dùng chung cho LayerBar và AiChart.
 *   tool: "hline" (bấm 1 lần) · "box" (kéo) · "alert" (bấm 1 lần → đặt cảnh báo giá) · null (bình thường)
 *   selected: hình/cảnh báo vừa bấm vào trên chart (để xoá / sửa ghi chú)
 */
import { useSyncExternalStore } from "react";
import { api, type Drawing } from "../../api/client";

export type Tool = "hline" | "box" | "alert" | null;
export type Selected = { type: "drawing" | "alert"; id: string } | null;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

let drawings: Drawing[] = [];
let tool: Tool = null;
let selected: Selected = null;

export async function refreshDrawings() {
  try {
    drawings = (await api.drawings()).drawings;
    if (selected?.type === "drawing" && !drawings.some((d) => d.id === selected!.id)) selected = null;
    emit();
  } catch {
    /* lần sau tải lại */
  }
}

export async function addDrawing(d: Partial<Drawing>) {
  await api.addDrawing(d);
  await refreshDrawings();
}

export async function moveDrawing(id: string, price: number) {
  drawings = drawings.map((d) => (d.id === id ? { ...d, price } : d));   // hiện ngay
  emit();
  await api.updateDrawing(id, { price });
  await refreshDrawings();
}

export async function noteDrawing(id: string, note: string) {
  await api.updateDrawing(id, { note });
  await refreshDrawings();
}

export async function deleteDrawing(id: string) {
  drawings = id === "all" ? [] : drawings.filter((d) => d.id !== id);
  if (selected && (id === "all" || selected.id === id)) selected = null;
  emit();
  await api.deleteDrawing(id);
  await refreshDrawings();
}

export function setTool(t: Tool) {
  tool = t;
  if (t) selected = null;
  emit();
}

export function setSelected(s: Selected) {
  selected = s;
  emit();
}

export const useDrawings = () => useSyncExternalStore(subscribe, () => drawings);
export const useTool = () => useSyncExternalStore(subscribe, () => tool);
export const useSelected = () => useSyncExternalStore(subscribe, () => selected);
