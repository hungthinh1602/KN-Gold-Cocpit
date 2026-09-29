/** Khung ⚡ Lệnh Live bên cạnh chart: trạng thái MT5, bộ lọc, danh sách lệnh, thống kê. */
import { useState } from "react";
import type { OrdersData } from "../../api/types";
import { api } from "../../api/client";
import { useStoredState } from "../../hooks/useStoredState";
import { Segmented } from "../../components/common/Segmented";
import { OrderCard } from "./OrderCard";
import { bySource, isActive, orderStats, sortOrders, type Period, type Source } from "./orders";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Hôm nay" }, { value: "week", label: "7 ngày" }, { value: "all", label: "Tất cả" },
];
const SOURCES: { value: Source; label: string }[] = [
  { value: "all", label: "ALL" }, { value: "tv", label: "TV" }, { value: "mt5", label: "MT5" },
];
const OLD_SHOWN = 15;   // số lệnh đã đóng hiện sẵn (còn lại bấm "Xem thêm")

function Mt5Line({ m }: { m: OrdersData["mt5"] | undefined }) {
  if (!m) return <>MT5: đang kiểm tra…</>;
  if (!m.login) return <>🔴 <span className="dn">{m.err || "MT5 chưa kết nối"}</span></>;
  const age = m.tick ? Math.round(Date.now() / 1000 - m.tick) : null;
  return (
    <>
      {m.ok ? "🟢" : "🔴"} MT5 TK <b>{m.login}</b> · {m.server}
      {age != null && age > 120 && <span className="dn"> · giá đứng {Math.round(age / 60)} phút</span>}
      {!m.ok && <span className="dn"> · mất kết nối máy chủ</span>}
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
  const [per, setPer] = useStoredState<Period>("loper", "day");
  const [src, setSrc] = useStoredState<Source>("losrc", "all");
  const [showAll, setShowAll] = useState(false);

  const all = data?.orders ?? [];
  const list = sortOrders(all.filter(bySource(src)));
  const limit = list.filter(isActive).length + OLD_SHOWN;
  const shown = showAll ? list : list.slice(0, limit);
  const st = orderStats(all, per, src);

  const clearTest = async () => {
    if (!window.confirm("Xóa tất cả lệnh test?")) return;
    await api.clearTestOrders();
    onSelect(null);
    onCleared();
  };

  return (
    <aside className="master lo-panel ai-side">
      <div className="mtop">
        <span className="eyebrow">⚡ Lệnh Live</span>
        <span className="lo-live">{data ? `${all.filter(isActive).length} lệnh đang theo dõi · ${new Date().toLocaleTimeString("vi-VN")}` : "—"}</span>
      </div>
      <div className="lo-mt5"><Mt5Line m={data?.mt5} /></div>
      <div className="lo-sel">
        <Segmented options={PERIODS} value={per} onChange={setPer} />
        <Segmented options={SOURCES} value={src} onChange={setSrc} />
      </div>
      <div className="lo-list" style={{ marginTop: 10 }}>
        {shown.length ? shown.map((o) => (
          <OrderCard key={o.id} o={o} selected={selected === o.id} onClick={() => onSelect(selected === o.id ? null : o.id)} />
        )) : (
          <div className="lo-empty">
            Chưa có lệnh. Tạo alert TradingView bắn webhook về VPS, lệnh sẽ hiện ở đây và được theo dõi tự động bằng giá MT5 GTC.
          </div>
        )}
      </div>
      {list.length > limit && (
        <button type="button" className="ai-btn sm" style={{ marginTop: 10 }} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Thu gọn" : `Xem thêm ${list.length - limit} lệnh cũ`}
        </button>
      )}
      <div className="lo-stats">
        <Stat v={st.total} t="Lệnh" />
        <Stat v={st.win} t="Thắng" cls="up" />
        <Stat v={st.loss} t="Thua" cls="dn" />
        <Stat v={st.winrate} t="Winrate" />
        <Stat v={st.running} t="Đang chạy" />
        <Stat v={st.cancel} t="Hủy" />
        <Stat v={(st.pips > 0 ? "+" : "") + st.pips.toFixed(0)} t="Pip đóng" cls={st.pips >= 0 ? "up" : "dn"} />
      </div>
      <div className="lo-foot">
        <span />
        <button type="button" className="ai-btn sm" onClick={clearTest}>🗑 Xóa lệnh test</button>
      </div>
    </aside>
  );
}
