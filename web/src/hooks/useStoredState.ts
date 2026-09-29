import { useCallback, useState } from "react";

/** useState có nhớ vào localStorage (cùng khoá với bản cũ: page, aitf, ailens, ailayers, loper, losrc, goldTf). */
export function useStoredState<T>(key: string, initial: T, json = false): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return initial;
      return json ? (JSON.parse(raw) as T) ?? initial : (raw as unknown as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, json ? JSON.stringify(v) : String(v));
      } catch {
        /* chế độ riêng tư: bỏ qua */
      }
    },
    [key, json],
  );
  return [value, set];
}
