/** Gọi HTTP ra ngoài (Yahoo, Treasury, lịch kinh tế, tin tức…) — có User-Agent + giới hạn thời gian. */
import https from "node:https";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = 15_000): Promise<T> {
  return JSON.parse(await fetchText(url, timeoutMs)) as T;
}

/**
 * GET bỏ qua kiểm tra chứng chỉ — CHỈ dùng cho gold-api.com (chứng chỉ SSL hết hạn,
 * chỉ đọc 1 con số giá công khai nên chấp nhận được).
 */
export function fetchJsonInsecure<T = unknown>(url: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA }, rejectUnauthorized: false, timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
