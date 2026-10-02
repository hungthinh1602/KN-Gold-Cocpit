/** Khung thu gọn được: bấm tiêu đề (▸/▾) để mở/đóng; khi đóng chỉ hiện 1 dòng tóm tắt. Nhớ trạng thái theo `id`. */
import type { ReactNode } from "react";
import { useStoredState } from "../../hooks/useStoredState";

export function Collapsible({ id, title, extra, summary, defaultOpen = false, children }: {
  id: string;
  title: ReactNode;
  extra?: ReactNode;        // phần bên phải tiêu đề (nút chọn, ghi chú…) — luôn hiện
  summary?: ReactNode;      // dòng tóm tắt khi đang thu gọn
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [stored, setStored] = useStoredState<string>("open:" + id, defaultOpen ? "1" : "0");
  const open = stored === "1";
  return (
    <section className="master collapsible">
      <div className="mtop">
        <button type="button" className="col-toggle eyebrow" aria-expanded={open} onClick={() => setStored(open ? "0" : "1")}>
          <span className="chev">{open ? "▾" : "▸"}</span>{title}
        </button>
        {extra}
      </div>
      {open ? children : summary && <div className="col-sum">{summary}</div>}
    </section>
  );
}
