/** Khung ⚡ Lệnh Live bên cạnh chart: trạng thái MT5, bộ lọc, danh sách lệnh, thống kê. */
import { useState } from "react";
import type { OrdersData } from "../../api/types";
import { api } from "../../api/client";
import { useStoredState } from "../../hooks/useStoredState";
import { Segmented } from "../../components/common/Segmented";
import { OrderCard } from "./OrderCard";
import { useLang, useT, locale } from "../../i18n/lang";
import { bySource, isActive, orderStats, sortOrders, type Period, type Source } from "./orders";

const PERIODS: { value: Period; label: string; en: string }[] = [
  { value: "day", label: "Hôm nay", en: "Today" }, { value: "week", label: "7 ngày", en: "7 days" }, { value: "all", label: "Tất cả", en: "All" },
];
const SOURCES: { value: Source; label: string }[] = [
  { value: "all", label: "ALL" }, { value: "tv", label: "TV" }, { value: "mt5", label: "MT5" },
];
const OLD_SHOWN = 15;   // số lệnh đã đóng hiện sẵn (còn lại bấm "Xem thêm")

function Mt5Line({ m }: { m: OrdersData["mt5"] | undefined }) {
  const t = useT();
  if (!m) return <>MT5: {t("đang kiểm tra…", "checking…")}</>;
  if (!m.login) return <>🔴 <span className="dn">{m.err || t("MT5 chưa kết nối", "MT5 not connected")}</span></>;
  const age = m.tick ? Math.round(Date.now() / 1000 - m.tick) : null;
  return (
    <>
      {m.ok ? "🟢" : "🔴"} MT5 {t("TK", "acct")} <b>{m.login}</b> · {m.server}
      {age != null && age > 120 && <span className="dn"> · {t("giá đứng", "price stale for")} {Math.round(age / 60)} {t("phút", "min")}</span>}
      {!m.ok && <span className="dn"> · {t("mất kết nối máy chủ", "server disconnected")}</span>}
    </>
  );
}

function Stat({ v, t, cls }: { v: string | number; t: string; cls?: string }) {
  return <div className="lo-st"><b className={cls}>{v}</b><span>{t}</span></div>;
}

export function OrdersPanel({ data, selected, onSelect, onCleared }: {
  data: OrdersData | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCleared: () => void;
}) {
  const t = useT();
  const [lang] = useLang();
  const [per, setPer] = useStoredState<Period>("loper", "day");
  const [src, setSrc] = useStoredState<Source>("losrc", "all");
  const [showAll, setShowAll] = useState(false);

  const all = data?.orders ?? [];
  const list = sortOrders(all.filter(bySource(src)));
  const limit = list.filter(isActive).length + OLD_SHOWN;
  const shown = showAll ? list : list.slice(0, limit);
  const st = orderStats(all, per, src);

  const clearTest = async () => {
    if (!window.confirm(t("Xóa tất cả lệnh test?", "Delete all test orders?"))) return;
    await api.clearTestOrders();
    onSelect(null);
    onCleared();
  };

  return (
    <aside className="master lo-panel ai-side">
      <div className="mtop">
        <span className="eyebrow">{t("⚡ Lệnh Live", "⚡ Live orders")}</span>
        <span className="lo-live">{data ? `${all.filter(isActive).length} ${t("lệnh đang theo dõi", all.filter(isActive).length === 1 ? "order tracked" : "orders tracked")} · ${new Date().toLocaleTimeString(locale(lang))}` : "—"}</span>
      </div>
      <div className="lo-mt5"><Mt5Line m={data?.mt5} /></div>
      <div className="lo-sel">
        <Segmented options={PERIODS.map((p) => ({ value: p.value, label: lang === "en" ? p.en : p.label }))} value={per} onChange={setPer} />
        <Segmented options={SOURCES} value={src} onChange={setSrc} />
      </div>
      <div className="lo-list" style={{ marginTop: 10 }}>
        {shown.length ? shown.map((o) => (
          <OrderCard key={o.id} o={o} selected={selected === o.id} onClick={() => onSelect(selected === o.id ? null : o.id)} />
        )) : (
          <div className="lo-empty">
            {t("Chưa có lệnh. Tạo alert TradingView bắn webhook về VPS, lệnh sẽ hiện ở đây và được theo dõi tự động bằng giá MT5 GTC.", "No orders yet. Create a TradingView alert that sends a webhook to the VPS — orders appear here and are tracked automatically with MT5 GTC prices.")}
          </div>
        )}
      </div>
      {list.length > limit && (
        <button type="button" className="ai-btn sm" style={{ marginTop: 10 }} onClick={() => setShowAll(!showAll)}>
          {showAll ? t("Thu gọn", "Show less") : t(`Xem thêm ${list.length - limit} lệnh cũ`, `Show ${list.length - limit} older orders`)}
        </button>
      )}
      <div className="lo-stats">
        <Stat v={st.total} t={t("Lệnh", "Orders")} />
        <Stat v={st.win} t={t("Thắng", "Wins")} cls="up" />
        <Stat v={st.loss} t={t("Thua", "Losses")} cls="dn" />
        <Stat v={st.winrate} t="Winrate" />
        <Stat v={st.running} t={t("Đang chạy", "Running")} />
        <Stat v={st.cancel} t={t("Hủy", "Cancelled")} />
        <Stat v={(st.pips > 0 ? "+" : "") + st.pips.toFixed(0)} t={t("Pip đóng", "Closed pips")} cls={st.pips >= 0 ? "up" : "dn"} />
      </div>
      <div className="lo-foot">
        <span />
        <button type="button" className="ai-btn sm" onClick={clearTest}>{t("🗑 Xóa lệnh test", "🗑 Clear test orders")}</button>
      </div>
    </aside>
  );
}
