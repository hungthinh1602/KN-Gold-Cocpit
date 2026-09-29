import { useEffect, useRef } from "react";

/**
 * Gọi `task` ngay khi bật rồi lặp lại mỗi `ms` (tuần tự — không chồng lần gọi).
 * `enabled = false` thì dừng. Đổi `deps` → chạy lại từ đầu.
 */
export function usePolling(task: () => Promise<void> | void, ms: number, enabled = true, deps: unknown[] = []) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    let timer: number | undefined;
    const run = async () => {
      try {
        await taskRef.current();
      } catch {
        /* lỗi mạng: lần sau thử lại */
      }
      if (!stop) timer = window.setTimeout(run, ms);
    };
    run();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled, ...deps]);
}
