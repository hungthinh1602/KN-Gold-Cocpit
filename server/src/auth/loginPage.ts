/** Trang đăng nhập (HTML tĩnh, không phụ thuộc React để tải nhanh). `__ERR__` = chỗ chèn thông báo lỗi. */
export const LOGIN_PAGE = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Buồng Lái Vàng · Đăng nhập</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0f1115;color:#e8e6e1}
form{background:#171a21;border:1px solid #2a2f3a;border-radius:14px;padding:24px;width:min(320px,90vw)}
h1{font-size:1.1rem;margin:0 0 14px;color:#e5b53a}
input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:9px;border:1px solid #2a2f3a;
background:#0f1115;color:inherit;font-size:1rem}
button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:9px;background:#e5b53a;
color:#111;font-weight:600;font-size:1rem;cursor:pointer}
.err{color:#f87171;font-size:.85rem;margin-top:10px}
</style></head><body>
<form method="post" action="/login">
<h1>🟡 Buồng Lái Vàng</h1>
<input type="password" name="pw" placeholder="Mật khẩu" autofocus autocomplete="current-password">
<button type="submit">Vào</button>__ERR__
</form></body></html>`;
