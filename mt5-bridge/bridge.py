# -*- coding: utf-8 -*-
"""
MT5 Bridge — cầu nối DUY NHẤT còn dùng Python (thư viện MetaTrader5 chỉ có cho Python).

Chỉ ĐỌC dữ liệu từ terminal MT5 đang mở (không đặt/sửa/đóng lệnh) và trả JSON qua HTTP
nội bộ 127.0.0.1 cho server Node.js.

  GET /health                         -> {ok, login, server, company, connected, symbol, tick_time}
  GET /tick                           -> {bid, ask, time}
  GET /rates?tf=H1&count=1500         -> [{time, open, high, low, close}]  (cũ → mới)
  GET /orders                         -> lệnh chờ của symbol vàng
  GET /positions                      -> vị thế đang mở của symbol vàng
  GET /deals?position=123             -> các deal của 1 vị thế (để biết đóng TP/SL/tay)

Cấu hình qua biến môi trường:
  MT5_LOGIN   (mặc định 220216454)  — chỉ nhận terminal đăng nhập đúng TK này
  MT5_PATH    — đường dẫn terminal64.exe (nếu không tự dò được)
  BRIDGE_PORT (mặc định 8790)
"""
import os
import sys
import json
import time
import threading
import subprocess
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import MetaTrader5 as mt5

PORT = int(os.environ.get("BRIDGE_PORT", "8790"))
WANT_LOGIN = int(os.environ.get("MT5_LOGIN", "220216454"))
DEFAULT_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"
CALL_TIMEOUT = 30            # giây — lệnh gọi MT5 kẹt quá mức này thì bỏ, kết nối lại
GOLD_NAMES = ("XAUUSD", "XAUUSDm", "XAUUSD.", "GOLD", "GOLDm")

TF = {
    "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1, "W1": mt5.TIMEFRAME_W1, "MN": mt5.TIMEFRAME_MN1,
}

_lock = threading.Lock()     # thư viện MetaTrader5 KHÔNG an toàn đa luồng → gọi tuần tự
_state = {"ready": False, "symbol": None, "err": None, "next_try": 0.0}


# ----------------------------------------------------------------- kết nối
def _running_paths():
    """Đường dẫn các terminal64.exe đang mở (máy có nhiều MT5: GTC, FTMO, Vantage...)."""
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-Process terminal64 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path"],
            capture_output=True, text=True, timeout=15,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
        return [x.strip() for x in out.splitlines() if x.strip()]
    except Exception:
        return []


def _connect():
    """Kết nối terminal đăng nhập ĐÚNG TK. Gọi khi đang giữ _lock."""
    if _state["ready"]:
        return True
    if time.time() < _state["next_try"]:
        return False
    paths, seen = [], set()
    for p in _running_paths() + [os.environ.get("MT5_PATH", ""), DEFAULT_PATH]:
        if p and p.lower() not in seen and os.path.isfile(p):
            seen.add(p.lower())
            paths.append(p)
    wrong = []
    for p in paths:
        try:
            if not mt5.initialize(path=p):
                continue
            acc = mt5.account_info()
            if acc and acc.login == WANT_LOGIN:
                sym = next((n for n in GOLD_NAMES if mt5.symbol_info(n) is not None), None)
                if sym is None:
                    xs = [s.name for s in (mt5.symbols_get() or []) if "XAU" in s.name.upper()]
                    sym = xs[0] if xs else None
                if sym:
                    mt5.symbol_select(sym, True)
                    _state.update(ready=True, symbol=sym, err=None)
                    return True
            wrong.append("%s (TK %s)" % (os.path.basename(os.path.dirname(p)), acc.login if acc else "?"))
            mt5.shutdown()
        except Exception:
            pass
    _state["err"] = "Không thấy MT5 nào đang đăng nhập TK %d%s" % (
        WANT_LOGIN, (" — đang mở: " + ", ".join(wrong)) if wrong else "")
    _state["next_try"] = time.time() + 20
    return False


def _call(fn):
    """Chạy fn() (dùng thư viện mt5) tuần tự + giới hạn thời gian chống treo."""
    res = {}

    def work():
        with _lock:
            if not _connect():
                res["e"] = RuntimeError(_state["err"] or "MT5 chưa kết nối")
                return
            try:
                res["v"] = fn()
            except Exception as e:
                res["e"] = e
    th = threading.Thread(target=work, daemon=True)
    th.start()
    th.join(CALL_TIMEOUT)
    if th.is_alive():
        # Lệnh gọi MetaTrader5 kẹt sâu trong thư viện (luồng không gỡ được, còn giữ _lock) →
        # tự thoát để CHAY-BRIDGE.bat bật lại cầu nối sạch sau vài giây.
        print("MT5 ket qua %ds -> khoi dong lai bridge" % CALL_TIMEOUT, flush=True)
        threading.Timer(1.0, lambda: os._exit(3)).start()
        raise TimeoutError("MT5 không phản hồi quá %ds — cầu nối đang tự khởi động lại" % CALL_TIMEOUT)
    if "e" in res:
        raise res["e"]
    return res.get("v")


# ----------------------------------------------------------------- dữ liệu
def health():
    def f():
        acc, ti, tk = mt5.account_info(), mt5.terminal_info(), mt5.symbol_info_tick(_state["symbol"])
        return {"ok": True, "login": acc.login if acc else None, "server": acc.server if acc else "",
                "company": acc.company if acc else "", "connected": bool(ti and ti.connected),
                "symbol": _state["symbol"], "tick_time": int(tk.time) if tk else None}
    return _call(f)


def tick():
    def f():
        t = mt5.symbol_info_tick(_state["symbol"])
        if t is None:
            raise RuntimeError("không có tick")
        return {"bid": t.bid, "ask": t.ask, "time": int(t.time)}
    return _call(f)


def rates(tf, count):
    code = TF.get(tf)
    if code is None:
        raise ValueError("tf không hợp lệ: %s" % tf)

    def f():
        r = mt5.copy_rates_from_pos(_state["symbol"], code, 0, count)
        if r is None:
            _state["ready"] = False
            raise RuntimeError("MT5 không trả nến")
        return [{"time": int(x["time"]), "open": float(x["open"]), "high": float(x["high"]),
                 "low": float(x["low"]), "close": float(x["close"])} for x in r]
    return _call(f)


def orders():
    def f():
        return [{"ticket": o.ticket, "type": o.type, "price_open": o.price_open, "sl": o.sl, "tp": o.tp,
                 "volume": o.volume_current, "comment": o.comment, "time_setup": int(o.time_setup)}
                for o in (mt5.orders_get(symbol=_state["symbol"]) or [])]
    return _call(f)


def positions():
    def f():
        return [{"ticket": p.ticket, "type": p.type, "price_open": p.price_open, "sl": p.sl, "tp": p.tp,
                 "volume": p.volume, "profit": p.profit, "comment": p.comment, "time": int(p.time)}
                for p in (mt5.positions_get(symbol=_state["symbol"]) or [])]
    return _call(f)


def deals(position):
    def f():
        return [{"ticket": d.ticket, "entry": d.entry, "type": d.type, "price": d.price, "reason": d.reason,
                 "profit": d.profit, "swap": d.swap, "commission": d.commission, "time": int(d.time)}
                for d in (mt5.history_deals_get(position=position) or [])]
    return _call(f)


# ----------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == "/health":
                self._send(health())
            elif u.path == "/tick":
                self._send(tick())
            elif u.path == "/rates":
                self._send(rates(q.get("tf", "H1").upper(), max(1, min(20000, int(q.get("count", "1500"))))))
            elif u.path == "/orders":
                self._send(orders())
            elif u.path == "/positions":
                self._send(positions())
            elif u.path == "/deals":
                self._send(deals(int(q["position"])))
            else:
                self._send({"error": "not found"}, 404)
        except Exception as e:
            self._send({"error": str(e)}, 503)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)   # chỉ nội bộ máy, không mở ra Internet
    print("MT5 bridge chay tai http://127.0.0.1:%d (TK %d)" % (PORT, WANT_LOGIN))
    srv.serve_forever()


if __name__ == "__main__":
    main()
