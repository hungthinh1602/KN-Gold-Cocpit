/**
 * Cho 1 khung (ref) lên toàn màn hình.
 * Trình duyệt hỗ trợ Fullscreen API → dùng toàn màn hình thật (ẩn cả thanh trình duyệt).
 * Không hỗ trợ (vd iPhone Safari) → phủ khung lên toàn cửa sổ bằng CSS; Esc để thoát.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [native, setNative] = useState(false);     // đang toàn màn hình thật
  const [overlay, setOverlay] = useState(false);   // đang phủ bằng CSS (dự phòng)

  useEffect(() => {
    const onChange = () => {
      const on = !!ref.current && document.fullscreenElement === ref.current;
      setNative(on);
      if (on) setOverlay(false);                   // toàn màn hình thật đã vào → bỏ lớp phủ dự phòng
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOverlay(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";       // không cuộn trang phía sau
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [overlay]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => undefined);
    if (overlay) return setOverlay(false);
    if (!el.requestFullscreen) return setOverlay(true);
    // Bị từ chối, hoặc trình duyệt treo yêu cầu (trang nhúng/khung webview) → sau 0,4 giây tự phủ bằng CSS
    el.requestFullscreen().catch(() => setOverlay(true));
    window.setTimeout(() => {
      if (!document.fullscreenElement) setOverlay(true);
    }, 400);
  }, [overlay]);

  return { ref, full: native || overlay, overlay, toggle };
}
