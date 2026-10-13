/**
 * Các khung phân tích dưới chart dạng tab — mỗi lúc 1 khung (trang không dài). Nhớ tab đang mở (localStorage "aitab").
 */
import { IconBox, IconChartLine, IconDroplet, IconSparkles, IconWorld } from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import type { AiData, TfData, Timeframe } from "../../api/types";
import { useStoredState } from "../../hooks/useStoredState";
import { useLang } from "../../i18n/lang";
import { ClassicPattern } from "./panels/ClassicPattern";
import { LensPanel } from "./panels/LensPanel";
import { SupplyDemand } from "./panels/SupplyDemand";
import { MacroTextPanel, NarrativePanel } from "./panels/TextPanels";

type TabKey = "ai" | "sd" | "lens" | "pattern" | "macro";

const TABS: { key: TabKey; vi: string; en: string; Icon: TablerIcon }[] = [
  { key: "ai", vi: "Tổng hợp AI", en: "AI summary", Icon: IconSparkles },
  { key: "sd", vi: "Cung / Cầu", en: "Supply / Demand", Icon: IconBox },
  { key: "lens", vi: "SMC · ICT · CRT", en: "SMC · ICT · CRT", Icon: IconDroplet },
  { key: "pattern", vi: "Mô hình giá", en: "Patterns", Icon: IconChartLine },
  { key: "macro", vi: "Vĩ mô", en: "Macro", Icon: IconWorld },
];

export function AnalysisTabs({ data, td, tf, price }: { data: AiData; td: TfData; tf: Timeframe; price: number | null }) {
  const [lang] = useLang();
  const [stored, setTab] = useStoredState<string>("aitab", "ai");
  const tab: TabKey = TABS.some((x) => x.key === stored) ? (stored as TabKey) : "ai";

  return (
    <section className="master analysis-tabs">
      <div className="atabs" role="tablist">
        {TABS.map(({ key, vi, en, Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
            <Icon size={16} stroke={1.75} />{lang === "en" ? en : vi}
          </button>
        ))}
      </div>
      <div className="atab-body" role="tabpanel">
        {tab === "ai" && <NarrativePanel d={data} />}
        {tab === "sd" && <SupplyDemand tf={tf} set={data.cc[tf]} price={price} />}
        {tab === "lens" && <LensPanel tf={tf} data={td} />}
        {tab === "pattern" && <ClassicPattern tf={tf} f={td.structure.formation} />}
        {tab === "macro" && <MacroTextPanel text={data.macro} />}
      </div>
    </section>
  );
}
