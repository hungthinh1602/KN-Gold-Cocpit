/** % thay đổi có màu, và dòng lịch sử 3 ngày / tuần / tháng. */
import { signCls } from "../../lib/format";

export function Change({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <>—</>;
  return <span className={signCls(pct)}>{(pct >= 0 ? "+" : "") + pct.toFixed(2)}%</span>;
}

export function History({ p3, p5, pM }: { p3: number | null; p5: number | null; pM: number | null }) {
  return (
    <>
      <span className="k">3N</span> <Change pct={p3} />
      <span className="k">Tuần</span> <Change pct={p5} />
      <span className="k">Tháng</span> <Change pct={pM} />
    </>
  );
}
