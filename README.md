# KN Coffee Trading · Buồng Lái Vàng (React + Node.js)

Bản viết lại của `D:\Gold-Dashboard\gold_dashboard.py` (Python 1 file) sang **React + Node.js + TypeScript**.
Bản Python cũ vẫn chạy song song (cổng 8787) cho tới khi bản mới chạy đúng hết.

## Cấu trúc

```
buong-lai-vang/
├─ mt5-bridge/        Python nhỏ — CHỈ đọc MT5 (thư viện MetaTrader5 chỉ có cho Python)
│  └─ bridge.py       HTTP nội bộ 127.0.0.1:8790: /health /tick /rates /orders /positions /deals
├─ server/            Node.js + Express + TypeScript
│  └─ src/
│     ├─ index.ts     khởi động server, phục vụ /api + web/dist
│     ├─ config.ts    cấu hình (biến môi trường)
│     ├─ mt5/         client gọi mt5-bridge + kiểu dữ liệu
│     ├─ lib/         tiện ích: HTTP ra ngoài, lưu JSON, giờ VN
│     ├─ auth/        đăng nhập (cookie 30 ngày) + trang đăng nhập
│     ├─ macro/       vĩ mô: Yahoo/Treasury/spot, điểm thiên hướng, lịch kinh tế, tin tức
│     ├─ orders/      Lệnh Live: đọc tín hiệu, theo dõi nến M1, đồng bộ lệnh MT5
│     ├─ engines/     bộ máy phân tích (structure, smc, ict, crt, classic, lenses, scan, cungcau, wave, schools)
│     ├─ ai/          dịch vụ quét 5 phút + /api/ai
│     └─ routes/      API: /api/data /api/orders /api/ai/note /webhook /login
│  ├─ data/           (DATA_DIR) web_password.txt, tv_webhook_token.txt, ai_push_key.txt, orders.json, ai_note.json
│  └─ scripts/        kiểm tra (test-engine.ts)
└─ web/               React + Vite + TypeScript
   └─ src/
      ├─ App.tsx      khung trang: tiêu đề, thanh phiên, 2 tab, chân trang
      ├─ api/         gọi API + kiểu dữ liệu
      ├─ hooks/       usePolling (lặp tuần tự), useStoredState (nhớ localStorage)
      ├─ lib/         định dạng số/giờ, tính phiên giao dịch
      ├─ components/  dùng chung: layout/ (Header, SessionBar), common/ (Segmented, Sparkline, Change)
      ├─ features/
      │  ├─ macro/    tab Vĩ mô: GoldCard, BiasCard + Assessment, DriverCard, EconCalendar, GoldNews
      │  ├─ ai/       tab AI: AiPage, LayerBar, chart/ (AiChart, overlay.ts vẽ canvas, series.ts lệnh/mô hình), panels/
      │  └─ orders/   Lệnh Live: OrdersPanel, OrderCard, orders.ts (lọc/thống kê)
      └─ styles/      global, macro, ai, orders
```

Luồng dữ liệu: **MT5 terminal → mt5-bridge (Python) → server (Node) → web (React)**.

## Chạy trên máy dev

Cần: Python 3 + `pip install -r mt5-bridge/requirements.txt`, Node.js ≥ 20, MT5 đang mở và đăng nhập TK GTC.

```bash
npm install
mt5-bridge\CHAY-BRIDGE.bat      # cửa sổ 1: cầu nối MT5 (8790) — tự bật lại nếu MT5 kẹt
npm run dev:server               # cửa sổ 2: server Node (8788)
npm run dev:web                  # cửa sổ 3: web dev có hot-reload (5173) — hoặc `npm run build -w web` rồi mở 8788
```

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | 8788 | cổng server Node |
| `BRIDGE_URL` | http://127.0.0.1:8790 | địa chỉ mt5-bridge |
| `MT5_LOGIN` | 220216454 | bridge chỉ nhận terminal đăng nhập đúng TK này |
| `MT5_PATH` | tự dò | đường dẫn terminal64.exe nếu không tự dò được |
| `DATA_DIR` | server/data | thư mục file khóa + dữ liệu |
| `GOLD_WEB_PASS` | (file web_password.txt) | có mật khẩu → mở Internet + bắt đăng nhập + mở cổng webhook |
| `WEBHOOK_PORT` | 80 | cổng riêng nhận webhook TradingView (chỉ khi có mật khẩu + token) |

## API

| Đường dẫn | Ghi chú |
|---|---|
| `GET /api/data` | vĩ mô (giống bản Python) |
| `GET /api/orders` · `POST /api/orders/clear-test` | Lệnh Live + trạng thái MT5 |
| `POST /webhook?token=` | TradingView → lệnh mới (JSON hoặc chữ tự do) |
| `POST /api/ai/note` | header `X-AI-Key` — Claude đẩy bài phân tích |
| `GET /api/ai?tf=` | quét phân tích (mỗi 5 phút) — chỉ gửi nến của khung `tf` |
| `GET /api/ai/live?tf=` | 3 nến cuối + giá (chart chạy trực tiếp) |
| `GET /api/health` · `/api/candles?tf=` · `/api/tick` | MT5 qua bridge |

## Lộ trình chuyển đổi

1. ✅ Khung project + cầu nối MT5 + biểu đồ nến qua Node/React
2. ✅ Server: đăng nhập, webhook TradingView, Lệnh Live, dữ liệu vĩ mô, API giống bản cũ
   (kiểm tra bộ theo dõi lệnh: `cd server && npx tsx scripts/test-engine.ts`)
3. ✅ Bộ máy phân tích (server/src/engines): cấu trúc fractal, SMC/ICT/CRT, mô hình giá, Cung/Cầu,
   Cấu trúc sóng, mô hình trường phái, bài nhận định tự động — KHỚP HOÀN TOÀN bản Python trên cùng bộ nến
   (`py scripts/parity/py_dump.py` rồi `npx tsx scripts/parity/compare.ts` trong thư mục server)
4. ✅ Giao diện React đầy đủ: tab Vĩ mô, tab AI phân tích (lớp biểu đồ, Lệnh Live, khung phiên…)
   — giống bản cũ, cùng khoá localStorage (page, aitf, ailens, ailayers, loper, losrc, goldTf)
5. Triển khai VPS (Node chạy nền tự khởi động), đổi từ bản Python sang
