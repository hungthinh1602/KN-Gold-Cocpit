/**
 * Trang giới thiệu công khai (/gioi-thieu): khách chưa đăng nhập vào "/" sẽ được chuyển tới đây.
 * Số liệu thật từ GET /api/public/home (chỉ lệnh ĐÃ ĐÓNG — lệnh đang chạy là phần dành cho thành viên).
 */
import { useEffect, useState, type ReactNode } from "react";
import { IconBell, IconClockHour4, IconPencil, IconSparkles, IconBolt, IconWorld } from "@tabler/icons-react";
import { usePolling } from "../../hooks/usePolling";
import { useLang, useT } from "../../i18n/lang";
import { HeroChart } from "./HeroChart";
import { WinCards } from "./WinCards";
import { fmtPx, signed, vnTime, type PublicCard, type PublicHome } from "./types";

const TF_NAMES = ["M15", "H1", "H4", "D1", "W1", "MN"];

/** Hiện dần khi cuộn tới (thêm class "in"). */
function useReveal(dep: unknown) {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: .12 });
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

function Countdown({ ts }: { ts: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  const s = Math.max(0, Math.floor(ts - now / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return <>{p(Math.floor(s / 3600))}:{p(Math.floor((s % 3600) / 60))}:{p(s % 60)}</>;
}

function Head({ k, title, sub }: { k: string; title: string; sub?: string }) {
  return <div className="sec-head reveal"><div className="kicker">{k}</div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>;
}

function Feat({ icon, title, children, big }: { icon: ReactNode; title: string; children: ReactNode; big?: ReactNode }) {
  const body = <><div className="ico">{icon}</div><h3>{title}</h3>{children}</>;
  return big ? <div className="feat big reveal"><div>{body}</div>{big}</div> : <div className="feat reveal">{body}</div>;
}

const resultTag = (c: PublicCard, t: (vi: string, en: string) => string) => {
  if (c.result === "win") return <span className="tag w">{c.win ? `+${fmtPx(c.win.pip, c.win.pip % 1 ? 1 : 0)} pip` : t("Thắng", "Win")}</span>;
  return <span className="tag l">{c.close_pip != null ? `${signed(c.close_pip)} pip` : t("Thua", "Loss")}</span>;
};

export function LandingPage() {
  const t = useT();
  const [lang, setLang] = useLang();
  const [d, setD] = useState<PublicHome | null>(null);

  usePolling(async () => {
    const r = await fetch("/api/public/home");
    if (r.ok) setD(await r.json());
  }, 15_000);
  useReveal(Boolean(d));

  const login = d?.links.login ?? "/";
  const register = d?.links.register ?? "/";
  const enter = d?.authed ? { href: "/", text: t("Vào buồng lái →", "Open the cockpit →") } : { href: register, text: t("Bắt đầu miễn phí →", "Start free →") };
  const trends = TF_NAMES.filter((tf) => d?.trends[tf] != null);
  const up = (tr: number) => (tr > 0 ? "u" : tr < 0 ? "d" : "n");
  const arrow = (tr: number) => (tr > 0 ? t("▲ Tăng", "▲ Up") : tr < 0 ? t("▼ Giảm", "▼ Down") : t("■ Đi ngang", "■ Range"));
  const latestWin = d?.wins.find((c) => c.win);
  const tapeItems = d ? [
    ...(d.price ? [{ name: "XAU/USD", value: fmtPx(d.price), pct: d.pct }] : []),
    ...d.tape.map((x) => ({ name: x.name, value: fmtPx(x.value, x.value > 50 ? 2 : 3), pct: x.pct })),
  ] : [];

  return (
    <div className="lp">
      <nav className="nav">
        <div className="wrap">
          <a className="logo" href="/gioi-thieu"><span className="dot" /><span><small>KN Coffee Trading</small><b>Buồng Lái Vàng</b></span></a>
          <div className="menu">
            <a href="#tinh-nang">{t("Tính năng", "Features")}</a><a href="#ket-qua">{t("Kết quả", "Results")}</a>
            <a href="#bang-gia">{t("Bảng giá", "Pricing")}</a><a href="#hoi-dap">{t("Hỏi đáp", "FAQ")}</a>
          </div>
          <div className="sp" />
          <div className="lang">
            {(["vi", "en"] as const).map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          {!d?.authed && <a className="btn ghost" href={login}>{t("Đăng nhập", "Log in")}</a>}
          <a className="btn primary" href={d?.authed ? "/" : register}>{d?.authed ? t("Vào buồng lái", "Open cockpit") : t("Dùng thử miễn phí", "Try it free")}</a>
        </div>
      </nav>

      {tapeItems.length > 0 && (
        <div className="tape"><div className="tape-in">
          {[0, 1].map((k) => (
            <span key={k} className="tape-set">
              {tapeItems.map((x) => (
                <span key={x.name}>{x.name} <b>{x.value}</b>{x.pct != null && <b className={x.pct >= 0 ? "u" : "d"}> {x.pct >= 0 ? "+" : "−"}{Math.abs(x.pct).toFixed(2)}%</b>}</span>
              ))}
              {d?.next && <span>{t("Tin tới", "Next")}: <b>{d.next.title}</b> · <b className="g"><Countdown ts={d.next.ts} /></b></span>}
            </span>
          ))}
        </div></div>
      )}

      <header className="hero">
        <div className="wrap">
          <div>
            <span className="badge"><i />{t("Đang chạy 24/7 · giá MT5 trực tiếp", "Running 24/7 · live MT5 prices")}</span>
            <h1>{t("Buồng lái cho ", "The cockpit for ")}<em>{t("trader vàng", "gold traders")}</em>{t(": phân tích, tín hiệu, rủi ro — trên một màn hình.", ": analysis, signals and risk — on one screen.")}</h1>
            <p className="lead">{t(
              "AI đọc cấu trúc XAU/USD trên 9 khung thời gian, đánh dấu vùng cung cầu, theo dõi từng lệnh Entry · SL · TP bằng giá thật và báo trước mọi tin vĩ mô quan trọng.",
              "AI reads XAU/USD structure across 9 timeframes, marks supply & demand zones, tracks every Entry · SL · TP with real prices and warns you before key macro news.")}</p>
            <div className="cta">
              <a className="btn primary lg" href={enter.href}>{enter.text}</a>
              <a className="btn lg" href="#ket-qua">{t("Xem kết quả thật", "See real results")}</a>
            </div>
            <div className="trust">
              <span>{t("Không cần thẻ thanh toán", "No card required")}</span><span>{t("Công khai cả lệnh thua", "Losses shown too")}</span><span>Tiếng Việt · English</span>
            </div>
          </div>

          <div className="mock reveal">
            <div className="mock-top">
              <span className="px">{d?.price ? fmtPx(d.price) : "—"}</span>
              {d?.pct != null && <span className={d.pct >= 0 ? "up" : "down"}>{d.pct >= 0 ? "+" : "−"}{Math.abs(d.pct).toFixed(2)}%</span>}
              <span className="mock-tf">XAU/USD · M15</span>
            </div>
            <HeroChart candles={d?.candles ?? []} price={d?.price ?? null} />
            {latestWin?.win && (
              <div className="float-ord">
                <div className="t"><span className={latestWin.side === "BUY" ? "buy" : "sell"}>{latestWin.side} · {t("Lệnh thắng gần nhất", "Latest win")}</span></div>
                <div className="t"><span className="buy">+{fmtPx(latestWin.win.pip, latestWin.win.pip % 1 ? 1 : 0)} pip</span><span className="dim">{vnTime(latestWin.ts)}</span></div>
                <div className="l"><span>Entry</span><span>{fmtPx(latestWin.entry, 1)}</span></div>
                <div className="l"><span>SL</span><span>{latestWin.sl != null ? fmtPx(latestWin.sl, 1) : "—"}</span></div>
                <div className="l"><span>{latestWin.win.label}</span><span>{fmtPx(latestWin.win.price, 1)}</span></div>
              </div>
            )}
            {trends.length > 0 && (
              <div className="mock-ai">
                <span className="ic">AI</span>
                <span><b>{t("Xu hướng cấu trúc sóng", "Wave-structure trend")}:</b>{" "}
                  {trends.map((tf, i) => <span key={tf} className={"trd " + up(d!.trends[tf])}>{i ? " · " : ""}{tf} {d!.trends[tf] > 0 ? "▲" : d!.trends[tf] < 0 ? "▼" : "■"}</span>)}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {d && d.wins.some((c) => c.win) && (
        <section className="wins" id="lenh-thang">
          <div className="wrap"><Head k={t("Lệnh thắng gần đây", "Recent wins")} title={t("Chạm TP — được hệ thống tự xác nhận", "Target hit — verified automatically")}
            sub={t("Mỗi thẻ là một lệnh thật trên Lệnh Live, chấm bằng giá MT5. Rê chuột để dừng lại xem.", "Every card is a real Live Order, scored with MT5 prices. Hover to pause.")} /></div>
          <WinCards wins={d.wins} />
          <div className="wrap"><div className="wins-sum reveal">
            <span>{t("7 ngày qua", "Last 7 days")}: <b>{d.week.win} {t("lệnh thắng", "wins")}</b></span>
            <span>{t("Tổng", "Total")}: <b className={d.week.pips >= 0 ? "" : "neg"}>{signed(d.week.pips)} pip</b></span>
          </div></div>
        </section>
      )}

      <section id="tinh-nang">
        <div className="wrap">
          <Head k={t("Tính năng", "Features")} title={t("Mọi thứ trader vàng cần, không phải mở 6 tab", "Everything a gold trader needs — without 6 open tabs")}
            sub={t("Chart, phân tích, lệnh, tin tức và cảnh báo — gom lại thành một buồng lái gọn gàng.", "Chart, analysis, orders, news and alerts — in one clean cockpit.")} />
          <div className="feats">
            <Feat icon={<IconSparkles size={22} />} title={t("AI phân tích đa khung", "Multi-timeframe AI analysis")}
              big={<div className="mini-tf">{(trends.length ? trends : TF_NAMES).map((tf) => {
                const tr = d?.trends[tf] ?? 0;
                return <div key={tf}>{tf}<b className={up(tr)}>{d ? arrow(tr) : "…"}</b></div>;
              })}</div>}>
              <p>{t("Tự quét mỗi 5 phút trên M1 → MN: cấu trúc sóng, phá vỡ, vùng cung cầu, góc nhìn SMC · ICT · CRT và mô hình giá cổ điển — viết thành nhận định dễ đọc.",
                "Scans M1 → MN every 5 minutes: wave structure, breaks, supply & demand, SMC · ICT · CRT views and classic patterns — written up as a clear outlook.")}</p>
              <div className="tags">{[t("Cấu trúc sóng", "Wave structure"), t("Cung / Cầu", "Supply / Demand"), "SMC", "ICT", "CRT", t("Mô hình giá", "Patterns")].map((x) => <span key={x}>{x}</span>)}</div>
            </Feat>
            <Feat icon={<IconBolt size={22} />} title={t("Lệnh Live", "Live Orders")}><p>{t("Tín hiệu vào lệnh hiện ngay trên chart với Entry · SL · TP. Hệ thống tự theo dõi bằng giá MT5 và chấm thắng / thua minh bạch.", "Signals appear on the chart with Entry · SL · TP. The system tracks them with MT5 prices and scores wins and losses transparently.")}</p></Feat>
            <Feat icon={<IconWorld size={22} />} title={t("Vĩ mô & lịch tin", "Macro & calendar")}><p>{t("Điểm vĩ mô cho vàng từ 5 yếu tố (USD, lợi suất, lạm phát…), lịch tin quan trọng có đếm ngược và giải thích tác động.", "A macro score for gold from 5 drivers (USD, yields, inflation…), plus a news calendar with countdowns and impact notes.")}</p></Feat>
            <Feat icon={<IconBell size={22} />} title={t("Cảnh báo giá 24/7", "24/7 price alerts")}><p>{t("Đặt mức giá, kéo thả ngay trên chart. Máy chủ canh giá cả khi bạn tắt máy và báo khi chạm vùng cung cầu.", "Set levels and drag them on the chart. The server watches price even when your computer is off, and alerts on zone touches.")}</p></Feat>
            <Feat icon={<IconClockHour4 size={22} />} title={t("Phiên giao dịch", "Trading sessions")}><p>{t("Thanh phiên Á · Âu · Mỹ theo giờ Việt Nam, killzone và vùng phiên vẽ sẵn trên chart.", "Asia · London · New York sessions in your time zone, with killzones and session boxes on the chart.")}</p></Feat>
            <Feat icon={<IconPencil size={22} />} title={t("Công cụ vẽ được lưu", "Saved drawings")}><p>{t("Kẻ đường, hộp, ghi chú — lưu trên máy chủ, mở máy khác vẫn còn nguyên.", "Lines, boxes and notes are saved on the server — open another device and they're still there.")}</p></Feat>
          </div>
        </div>
      </section>

      <section id="ket-qua" className="alt">
        <div className="wrap">
          <Head k={t("Minh bạch", "Transparency")} title={t("Kết quả thật — có cả lệnh thua", "Real results — losses included")}
            sub={t("Mọi lệnh được hệ thống tự chấm bằng giá MT5, không sửa tay. Số liệu cập nhật trực tiếp.", "Every order is scored automatically with MT5 prices, never edited by hand. Updated live.")} />
          <div className="res reveal">
            <div className="kpi"><small>{t("Lệnh đã đóng · 30 ngày", "Closed orders · 30 days")}</small><b>{d ? d.stats.total : "—"}</b></div>
            <div className="kpi"><small>{t("Tỉ lệ thắng", "Win rate")}</small><b className="gold">{d?.stats.winrate != null ? `${d.stats.winrate}%` : "—"}</b></div>
            <div className="kpi"><small>{t("Thắng / Thua", "Wins / Losses")}</small><b><span className="buy">{d?.stats.win ?? "—"}</span> / <span className="sell">{d?.stats.loss ?? "—"}</span></b></div>
            <div className="kpi"><small>{t("Tổng pip · 30 ngày", "Total pips · 30 days")}</small><b className={d && d.stats.pips < 0 ? "sell" : "buy"}>{d ? signed(d.stats.pips) : "—"}</b></div>
          </div>
          <div className="table reveal">
            <div className="tr head"><span>{t("Thời gian", "Time")}</span><span>{t("Tín hiệu", "Signal")}</span><span>{t("Chiều", "Side")}</span><span>Entry</span><span>SL</span><span>{t("Kết quả", "Result")}</span></div>
            {d?.recent.map((c, i) => (
              <div className="tr" key={i}>
                <span className="mono">{vnTime(c.ts)}</span><span>{c.name}</span>
                <span className={c.side === "BUY" ? "buy" : "sell"}>{c.side}</span>
                <span className="mono">{fmtPx(c.entry, 1)}</span><span className="mono">{c.sl != null ? fmtPx(c.sl, 1) : "—"}</span>
                {resultTag(c, t)}
              </div>
            ))}
            {d && !d.recent.length && <div className="tr empty">{t("Chưa có lệnh đóng nào.", "No closed orders yet.")}</div>}
          </div>
        </div>
      </section>

      <section id="cach-dung">
        <div className="wrap">
          <Head k={t("Bắt đầu", "Get started")} title={t("3 bước để vào buồng lái", "3 steps into the cockpit")} />
          <div className="steps">
            <div className="step reveal"><h3>{t("Tạo tài khoản", "Create an account")}</h3><p>{t("Đăng ký bằng email trong 30 giây, không cần thẻ thanh toán.", "Sign up with email in 30 seconds — no card needed.")}</p></div>
            <div className="step reveal"><h3>{t("Chọn khung & lớp phân tích", "Pick timeframes & layers")}</h3><p>{t("Bật cấu trúc, cung cầu, phiên… theo phong cách giao dịch của bạn. Web nhớ lựa chọn.", "Turn on structure, zones, sessions… to fit your style. Your choices are remembered.")}</p></div>
            <div className="step reveal"><h3>{t("Nhận tín hiệu & cảnh báo", "Get signals & alerts")}</h3><p>{t("Theo dõi Lệnh Live, đặt cảnh báo giá và đọc nhận định AI mỗi phiên.", "Follow Live Orders, set price alerts and read the AI outlook every session.")}</p></div>
          </div>
        </div>
      </section>

      <section id="bang-gia" className="alt">
        <div className="wrap">
          <Head k={t("Bảng giá", "Pricing")} title={t("Bắt đầu miễn phí, nâng cấp khi cần", "Start free, upgrade when ready")} />
          <div className="plans">
            <div className="plan reveal">
              <h3>{t("Miễn phí", "Free")}</h3>
              <div className="price">0đ <small>{t("/ mãi mãi", "/ forever")}</small></div>
              <ul>
                <li>{t("Chart vàng giá MT5 trực tiếp", "Live MT5 gold chart")}</li>
                <li>{t("Nhận định AI khung H1", "AI outlook on H1")}</li>
                <li>{t("Vĩ mô & lịch tin quan trọng", "Macro & key news calendar")}</li>
                <li>{t("Kết quả Lệnh Live công khai", "Public Live Order results")}</li>
                <li className="no">{t("Lệnh Live thời gian thực", "Real-time Live Orders")}</li>
                <li className="no">{t("Cảnh báo giá 24/7", "24/7 price alerts")}</li>
              </ul>
              <a className="btn lg" href={register}>{t("Tạo tài khoản", "Create account")}</a>
            </div>
            <div className="plan vip reveal" data-pop={t("Phổ biến", "Popular")}>
              <h3>VIP</h3>
              <div className="price">{t("Liên hệ", "Contact us")} <small>{t("/ tháng", "/ month")}</small></div>
              <ul>
                <li>{t("Tất cả của gói Miễn phí", "Everything in Free")}</li>
                <li>{t("AI phân tích đủ 9 khung", "AI analysis on all 9 timeframes")}</li>
                <li>{t("Lệnh Live thời gian thực trên chart", "Real-time Live Orders on the chart")}</li>
                <li>{t("Cảnh báo giá & vùng cung cầu 24/7", "24/7 price & zone alerts")}</li>
                <li>{t("SMC · ICT · CRT · mô hình giá", "SMC · ICT · CRT · patterns")}</li>
                <li>{t("Hình vẽ lưu trên máy chủ", "Drawings saved on the server")}</li>
              </ul>
              <a className="btn primary lg" href={register}>{t("Dùng thử VIP 7 ngày", "Try VIP for 7 days")}</a>
            </div>
          </div>
        </div>
      </section>

      <section id="hoi-dap">
        <div className="wrap">
          <Head k={t("Hỏi đáp", "FAQ")} title={t("Câu hỏi thường gặp", "Frequently asked questions")} />
          <div className="faq">
            {[
              [t("Dữ liệu giá lấy từ đâu?", "Where do prices come from?"), t("Giá và nến lấy trực tiếp từ MetaTrader 5 trên máy chủ chạy 24/7, cập nhật mỗi 2 giây.", "Prices and candles come straight from MetaTrader 5 on a 24/7 server, refreshed every 2 seconds.")],
              [t("AI phân tích như thế nào?", "How does the AI analyse?"), t("Bộ máy phân tích tự quét cấu trúc giá trên 9 khung mỗi 5 phút (sóng, phá vỡ, cung cầu, SMC/ICT/CRT), sau đó tổng hợp thành nhận định dễ đọc.", "The engine scans price structure on 9 timeframes every 5 minutes (waves, breaks, zones, SMC/ICT/CRT) and writes it up as a readable outlook.")],
              [t("Kết quả lệnh có bị chỉnh sửa không?", "Are results ever edited?"), t("Không. Mỗi lệnh được hệ thống tự theo dõi bằng giá MT5 và tự chấm thắng / thua / huỷ. Lệnh thua vẫn hiển thị công khai.", "No. Each order is tracked with MT5 prices and scored win / loss / cancel automatically. Losses stay public.")],
              [t("Web có tự vào lệnh trên tài khoản của tôi không?", "Does it trade on my account?"), t("Không. Buồng Lái Vàng chỉ phân tích và cung cấp thông tin; mọi quyết định giao dịch do bạn tự thực hiện.", "No. Buồng Lái Vàng only analyses and informs; every trading decision is yours.")],
              [t("Dùng trên điện thoại được không?", "Does it work on mobile?"), t("Được. Giao diện tự co giãn theo màn hình và có thể thêm vào màn hình chính như một ứng dụng.", "Yes. The layout adapts to any screen and can be added to your home screen like an app.")],
            ].map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>

      <section className="final-wrap">
        <div className="wrap">
          <div className="final reveal">
            <h2>{t("Sẵn sàng cất cánh cùng thị trường vàng?", "Ready to take off with gold?")}</h2>
            <p>{t("Tạo tài khoản miễn phí và mở buồng lái ngay hôm nay.", "Create a free account and open your cockpit today.")}</p>
            <a className="btn primary lg" href={enter.href}>{enter.text}</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div>
            <a className="logo" href="/gioi-thieu"><span className="dot" /><span><small>KN Coffee Trading</small><b>Buồng Lái Vàng</b></span></a>
            <div className="risk"><b>{t("Cảnh báo rủi ro:", "Risk warning:")}</b> {t(
              "Giao dịch vàng và sản phẩm có đòn bẩy có rủi ro cao, bạn có thể mất toàn bộ vốn. Thông tin trên Buồng Lái Vàng chỉ nhằm mục đích tham khảo, không phải lời khuyên đầu tư và không cam kết lợi nhuận. Kết quả quá khứ không đảm bảo kết quả tương lai.",
              "Trading gold and leveraged products carries high risk and you may lose all your capital. Information on Buồng Lái Vàng is for reference only, is not investment advice and does not promise profit. Past results do not guarantee future results.")}</div>
          </div>
          <div className="fcol">
            <div className="flinks"><a href="#tinh-nang">{t("Tính năng", "Features")}</a><a href="#ket-qua">{t("Kết quả", "Results")}</a><a href="#bang-gia">{t("Bảng giá", "Pricing")}</a><a href="#hoi-dap">{t("Hỏi đáp", "FAQ")}</a><a href={login}>{t("Đăng nhập", "Log in")}</a></div>
            <p>© {new Date().getFullYear()} KN Coffee Trading</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
