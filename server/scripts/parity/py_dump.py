# -*- coding: utf-8 -*-
"""
Tạo bộ dữ liệu so sánh: lấy 1500 nến × 9 khung từ MT5 → fixtures.json,
chạy bộ máy PYTHON cũ (D:\\Gold-Dashboard\\ai_engine) → py_out.json.
Sau đó chạy: npx tsx scripts/parity/compare.ts
"""
import sys, json, os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, r"D:\Gold-Dashboard")
import MetaTrader5 as mt5
from ai_engine import scan, cungcau, wave, schools
from ai_engine import structure as st
from ai_engine.patterns import classic, lenses
from ai_engine.patterns.util import atr

HERE = os.path.dirname(os.path.abspath(__file__))
TFS = {"M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15, "M30": mt5.TIMEFRAME_M30,
       "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4, "D1": mt5.TIMEFRAME_D1, "W1": mt5.TIMEFRAME_W1, "MN": mt5.TIMEFRAME_MN1}
VN = timezone(timedelta(hours=7))
NOW_VN = datetime(2026, 9, 29, 15, 30, tzinfo=VN)       # giờ cố định để 2 bản chạy giống nhau
MACRO = {"score": -1.5, "drivers": {
    "us10y": {"name": "US10Y", "value": 5.2, "dir": "up", "rise": -1, "pct": 0.52},
    "dxy": {"name": "DXY", "value": 101.3, "dir": "flat", "rise": -1, "pct": 0.01},
    "spx": {"name": "SPX", "value": 7680, "dir": "down", "rise": -1, "pct": -0.4}},
    "calendar": [{"ts": NOW_VN.timestamp() + 3600, "impact": "High", "wd": "T3", "day": "29/09", "time": "16:30", "title": "CPI"}]}

mt5.initialize()
bars = {}
for tf, code in TFS.items():
    r = mt5.copy_rates_from_pos("XAUUSD", code, 0, 1500)
    bars[tf] = [{"time": int(x["time"]), "open": float(x["open"]), "high": float(x["high"]),
                 "low": float(x["low"]), "close": float(x["close"])} for x in r]
price = bars["M15"][-1]["close"]
json.dump({"bars": bars, "price": price, "now_ts": NOW_VN.timestamp(), "hour_vn": 15.5, "macro": MACRO},
          open(os.path.join(HERE, "fixtures.json"), "w", encoding="utf-8"))

out = {}
cfg_bars = {tf: b[-scan.CFG[tf][0]:] for tf, b in bars.items()}
built = scan.build(cfg_bars, price, NOW_VN, "XAUUSD")
for tf in TFS:
    t = built["tf_data"].get(tf)
    if t:
        t.pop("candles", None)
    bl = bars[tf]
    wv = wave.analyze(bl)
    out[tf] = {"tf_data": t, "cc": cungcau.zones(bl), "wave": wv,
               "school": schools.analyze(bl, wv, price, built["killzone"], tf)}
out["_killzone"] = built["killzone"]
out["_timeframes"] = built["timeframes"]
out["_auto_text"] = scan.auto_text(built)
out["_auto_macro"] = scan.auto_macro(MACRO, NOW_VN.timestamp())
json.dump(out, open(os.path.join(HERE, "py_out.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("OK: fixtures.json + py_out.json", {tf: len(b) for tf, b in bars.items()})
