/** Hàng nút lớp biểu đồ + tuỳ chọn phụ (sóng, Cung/Cầu khung lớn). */
import { TF_ORDER, type Timeframe } from "../../api/types";
import { MAIN_LAYERS, SD_HTF, WAVE_OPTS, waveOn, type Layers } from "./layers";

export function LayerBar({ layers, tf, onChange }: { layers: Layers; tf: Timeframe; onChange: (next: Layers) => void }) {
  const set = (k: string, v: boolean) => onChange({ ...layers, [k]: v });
  const cur = TF_ORDER.indexOf(tf);
  return (
    <>
      <div className="ai-layers">
        {MAIN_LAYERS.map((b) => (
          <button key={b.key} type="button" aria-pressed={!!layers[b.key]} onClick={() => set(b.key, !layers[b.key])}>{b.label}</button>
        ))}
      </div>
      {layers.struct && (
        <div className="ai-layers ai-sdopts">
          {WAVE_OPTS.map((b) => (
            <button key={b.key} type="button" aria-pressed={waveOn(layers, b.key)} onClick={() => set(b.key, !waveOn(layers, b.key))}>{b.label}</button>
          ))}
        </div>
      )}
      {layers.sd && (
        <div className="ai-layers ai-sdopts">
          <button type="button" aria-pressed={!!layers.sdSwept} onClick={() => set("sdSwept", !layers.sdSwept)}>Vùng đã quét</button>
          <span className="ai-sdsep">Khung lớn:</span>
          {SD_HTF.filter((b) => TF_ORDER.indexOf(b.tf) > cur).map((b) => (   // chỉ khung LỚN hơn khung đang xem
            <button key={b.key} type="button" aria-pressed={!!layers[b.key]} onClick={() => set(b.key, !layers[b.key])}>{b.label}</button>
          ))}
        </div>
      )}
    </>
  );
}
