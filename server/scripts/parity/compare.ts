/**
 * So kết quả bộ máy TypeScript với bộ máy Python cũ trên CÙNG bộ nến (fixtures.json / py_out.json).
 * Chạy: py scripts/parity/py_dump.py && npx tsx scripts/parity/compare.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Bar, Timeframe } from "../../src/mt5/types.js";
import { ANALYZE_TFS, CFG, autoMacro, autoText, build } from "../../src/engines/scan.js";
import { zones } from "../../src/engines/cungcau.js";
import { analyze as waveAnalyze } from "../../src/engines/wave.js";
import { analyze as schoolsAnalyze } from "../../src/engines/schools.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(fs.readFileSync(path.join(here, "fixtures.json"), "utf8"));
const py = JSON.parse(fs.readFileSync(path.join(here, "py_out.json"), "utf8"));
const bars: Record<Timeframe, Bar[]> = fx.bars;

let diffs = 0;
const MAX_SHOW = 25;

/** So sánh sâu: số lệch ≤ 1e-6 (hoặc ≤ 0.011 nếu đã làm tròn 2 số) coi là bằng. Bỏ qua khoá bắt đầu bằng "_" ở TS. */
function cmp(a: unknown, b: unknown, where: string) {
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1e-6 && !(Math.abs(a - b) <= 0.011 && Math.abs(a * 100 - Math.round(a * 100)) < 1e-9)) report(where, a, b);
    return;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    if (a !== b && !(a == null && b == null)) report(where, a, b);
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return report(where, "array?", "array?");
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) report(`${where}.length`, a.length, b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], `${where}[${i}]`);
    return;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    if (k === "candles") continue;
    // trường Python có giá trị None và TS bỏ trống (undefined) coi như bằng nhau
    if (!(k in ao) && bo[k] == null) continue;
    if (!(k in bo) && ao[k] == null) continue;
    cmp(ao[k], bo[k], `${where}.${k}`);
  }
}

function report(where: string, ts: unknown, pyv: unknown) {
  diffs++;
  if (diffs <= MAX_SHOW) console.log(`  ❌ ${where}\n      TS: ${JSON.stringify(ts)?.slice(0, 160)}\n      PY: ${JSON.stringify(pyv)?.slice(0, 160)}`);
}

const cfgBars = Object.fromEntries(ANALYZE_TFS.map((tf) => [tf, bars[tf].slice(-CFG[tf][0])])) as Record<Timeframe, Bar[]>;
const built = build(cfgBars, fx.price, fx.hour_vn, "x", "XAUUSD");
cmp(built.killzone, py._killzone, "killzone");
cmp(built.timeframes, py._timeframes, "timeframes");

for (const tf of ANALYZE_TFS) {
  const before = diffs;
  const t = built.tf_data[tf] as Record<string, unknown> | undefined;
  if (t) delete t.candles;
  const wv = waveAnalyze(bars[tf]);
  const mine = {
    tf_data: t ?? null,
    cc: zones(bars[tf]),
    wave: wv,
    school: schoolsAnalyze(bars[tf], wv, fx.price, built.killzone, tf),
  };
  cmp(mine, py[tf], tf);
  console.log(`${diffs === before ? "✅" : "❌"} ${tf}: ${diffs - before} chỗ lệch (${bars[tf].length} nến)`);
}

const before = diffs;
cmp(autoText(built as any), py._auto_text, "auto_text");
cmp(autoMacro(fx.macro, fx.now_ts), py._auto_macro, "auto_macro");
console.log(`${diffs === before ? "✅" : "❌"} bài nhận định tự động + tóm tắt vĩ mô`);
console.log(diffs ? `\nTỔNG: ${diffs} chỗ lệch` : "\nTỔNG: KHỚP HOÀN TOÀN với bản Python ✅");
