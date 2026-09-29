/** Đọc/ghi file JSON trong thư mục dữ liệu (ghi qua file tạm rồi đổi tên → không hỏng file khi mất điện). */
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(config.dataDir, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, data: unknown): void {
  const full = path.join(config.dataDir, file);
  fs.writeFileSync(full + ".tmp", JSON.stringify(data), "utf8");
  fs.renameSync(full + ".tmp", full);
}
