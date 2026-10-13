/**
 * Hàng 2 của thanh điều khiển chart: nút lớp (bấm = bật/tắt). Lớp có tuỳ chọn con có thêm ▾ — bấm ▾ mở bảng tuỳ chọn.
 */
import { useState } from "react";
import {
  IconBolt, IconBox, IconCandle, IconChartLine, IconChevronDown, IconClockHour4, IconDroplet, IconPencil, IconTriangle, IconWorld,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import { TF_ORDER, type Timeframe } from "../../../api/types";
import { useLang } from "../../../i18n/lang";
import { Popover } from "../../../components/common/Popover";
import { MAIN_LAYERS, ORDER_OPTS, SD_HTF, SESS_OPTS, WAVE_OPTS, waveOn, type LayerKey, type Layers } from "../layers";

const ICONS: Record<LayerKey, TablerIcon> = {
  struct: IconChartLine, sd: IconBox, smcM: IconDroplet, ictM: IconClockHour4, crtM: IconCandle,
  pattern: IconTriangle, sess: IconWorld, order: IconBolt, draw: IconPencil,
};

/** Một nút tuỳ chọn con: `def` = mặc định bật (chỉ tắt khi = false). */
function Opt({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={"opt" + (on ? " on" : "")} aria-pressed={on} onClick={onClick}>{label}</button>;
}

export function LayerChips({ layers, tf, onChange }: { layers: Layers; tf: Timeframe; onChange: (next: Layers) => void }) {
  const [lang] = useLang();
  const en = lang === "en";
  const [pop, setPop] = useState<LayerKey | null>(null);
  const set = (k: string, v: boolean) => onChange({ ...layers, [k]: v });
  const cur = TF_ORDER.indexOf(tf);

  /** Bảng tuỳ chọn con của từng lớp (lớp không có thì null). */
  const options = (k: LayerKey) => {
    const flip = (key: string) => set(key, !waveOn(layers, key));
    if (k === "struct") return <div className="opts">{WAVE_OPTS.map((o) => <Opt key={o.key} on={waveOn(layers, o.key)} label={en ? o.en : o.label} onClick={() => flip(o.key)} />)}</div>;
    if (k === "sess") return (
      <>
        <div className="opts">{SESS_OPTS.map((o) => <Opt key={o.key} on={waveOn(layers, o.key)} label={en ? o.en : o.label} onClick={() => flip(o.key)} />)}</div>
        {cur > TF_ORDER.indexOf("H4") && <div className="pop-hint">{en ? "Only shown on M1–H4" : "Chỉ hiện ở khung M1–H4"}</div>}
      </>
    );
    if (k === "order") return <div className="opts">{ORDER_OPTS.map((o) => <Opt key={o.key} on={waveOn(layers, o.key)} label={en ? o.en : o.label} onClick={() => flip(o.key)} />)}</div>;
    if (k === "sd") return (
      <>
        <div className="opts"><Opt on={!!layers.sdSwept} label={en ? "Swept zones" : "Vùng đã quét"} onClick={() => set("sdSwept", !layers.sdSwept)} /></div>
        <div className="pop-grp">{en ? "Higher timeframe zones" : "Vùng khung lớn"}</div>
        <div className="opts">
          {SD_HTF.filter((h) => TF_ORDER.indexOf(h.tf) > cur).map((h) => <Opt key={h.key} on={!!layers[h.key]} label={h.label} onClick={() => set(h.key, !layers[h.key])} />)}
          {SD_HTF.every((h) => TF_ORDER.indexOf(h.tf) <= cur) && <span className="pop-hint">{en ? "No higher timeframe" : "Không có khung lớn hơn"}</span>}
        </div>
      </>
    );
    return null;
  };

  return (
    <div className="layer-chips">
      {MAIN_LAYERS.map((m) => {
        const Icon = ICONS[m.key];
        const on = !!layers[m.key];
        const opts = options(m.key);
        return (
          <span key={m.key} className="chip-wrap">
            <span className={"chip" + (on ? " on" : "") + (opts ? " has-opts" : "")}>
              <button type="button" className="chip-main" aria-pressed={on} onClick={() => set(m.key, !on)}>
                <Icon size={15} stroke={1.75} />{en ? m.en : m.label}
              </button>
              {opts && (
                <button type="button" className={"chip-caret" + (pop === m.key ? " open" : "")} aria-label={en ? "Options" : "Tuỳ chọn"}
                  aria-expanded={pop === m.key} onClick={() => setPop(pop === m.key ? null : m.key)}>
                  <IconChevronDown size={13} stroke={2} />
                </button>
              )}
            </span>
            {opts && (
              <Popover open={pop === m.key} onClose={() => setPop(null)}>
                <div className="pop-grp">{en ? m.en : m.label}</div>
                {opts}
              </Popover>
            )}
          </span>
        );
      })}
    </div>
  );
}
