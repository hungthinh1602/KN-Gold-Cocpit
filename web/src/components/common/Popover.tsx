/**
 * Bảng bật ra cạnh 1 nút (tuỳ chọn con của lớp, danh sách cảnh báo…).
 * Bấm ra ngoài hoặc nhấn Esc → tự đóng. Mỗi lúc chỉ mở 1 bảng (do nơi dùng giữ id bảng đang mở).
 */
import { useEffect, useRef, type ReactNode } from "react";

export function Popover({ open, onClose, align = "left", className = "", children }: {
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      // bấm vào chính nút mở (cha của bảng) thì để nút tự xử lý bật/tắt
      if (el && !el.contains(e.target as Node) && !el.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={`popover ${align} ${className}`} role="dialog">
      {children}
    </div>
  );
}
