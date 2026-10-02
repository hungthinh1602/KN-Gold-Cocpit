/** % thay đổi có màu, và dòng lịch sử 3 ngày / tuần / tháng. */
import { signCls } from "../../lib/format";
import { useT } from "../../i18n/lang";

export function Change({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <>—</>;
  return <span className={signCls(pct)}>{(pct >= 0 ? "+" : "") + pct.toFixed(2)}%</span>;
}

export function History({ p3, p5, pM }: { p3: number | null; p5: number | null; pM: number | null }) {
  const t = useT();
  return (
    <>
      <span className="k">{t("3N", "3D")}</span> <Change pct={p3} />
      <span className="k">{t("Tuần", "Week")}</span> <Change pct={p5} />
      <span className="k">{t("Tháng", "Month")}</span> <Change pct={pM} />
    </>
  );
}
