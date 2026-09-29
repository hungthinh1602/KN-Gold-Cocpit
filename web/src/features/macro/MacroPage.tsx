/** Tab 📊 VĨ MÔ. Dữ liệu /api/data do App tải (dùng chung với chân trang). */
import type { MacroData } from "../../api/types";
import { BiasCard } from "./BiasCard";
import { DriverCard } from "./DriverCard";
import { DRIVER_ORDER } from "./drivers";
import { EconCalendar } from "./EconCalendar";
import { GoldCard } from "./GoldCard";
import { GoldNews } from "./GoldNews";

export function MacroPage({ data }: { data: MacroData | null }) {
  return (
    <div>
      <div className="macro-top">
        <GoldCard gold={data?.gold ?? null} />
        <BiasCard d={data} />
      </div>
      <div className="grid">
        {DRIVER_ORDER.map((id) => data?.drivers?.[id] && <DriverCard key={id} id={id} x={data.drivers[id]} />)}
      </div>
      <EconCalendar events={data?.calendar} stamp={data?.cal_updated} />
      <GoldNews news={data?.news} stamp={data?.news_updated} />
    </div>
  );
}
