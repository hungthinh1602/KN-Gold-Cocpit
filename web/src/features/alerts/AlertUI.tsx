/** Nút 🔔 bật/tắt thông báo (ở tiêu đề) + chồng ô báo góc dưới phải. */
import { useT } from "../../i18n/lang";
import { beep, canNotify, dismissToast, useSoundOn, useToasts } from "./alerts";

export function AlertToggle() {
  const t = useT();
  const [on, setOn] = useSoundOn();
  const toggle = () => {
    setOn(!on);
    if (!on) window.setTimeout(() => beep("info"), 50);   // bật lên → kêu thử 1 tiếng
  };
  const hint = canNotify() ? "" : t(" (thông báo hệ thống cần HTTPS — hiện chỉ có âm thanh + ô báo trong trang)", " (system notifications need HTTPS — sound + in-page alerts only)");
  return (
    <button type="button" className={"alert-btn" + (on ? " on" : "")} onClick={toggle} aria-pressed={on}
      title={(on ? t("Đang bật thông báo lệnh — bấm để tắt", "Order alerts on — click to mute") : t("Thông báo lệnh đang tắt — bấm để bật", "Order alerts off — click to enable")) + hint}>
      {on ? "🔔" : "🔕"}
    </button>
  );
}

export function Toasts() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => (
        <button key={x.id} type="button" className={"toast " + x.tone} onClick={() => dismissToast(x.id)}>
          <b>{x.title}</b>
          <span>{x.body}</span>
        </button>
      ))}
    </div>
  );
}
