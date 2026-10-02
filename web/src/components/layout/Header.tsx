import { useEffect } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useLang, useT } from "../../i18n/lang";

export function Header() {
  const [theme, setTheme] = useTheme();
  const [lang, setLang] = useLang();
  const t = useT();
  const light = theme === "light";
  useEffect(() => {
    document.title = `KN Coffee Trading · ${t("Buồng Lái Vàng", "Gold Cockpit")}`;
  }, [lang]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <header className="hd">
      <span className="dot" />
      <div className="hdtitle">
        <span className="brandline">KN Coffee Trading</span>
        <span className="hdsep">·</span>
        <span className="hdname">{t("Buồng Lái Vàng", "Gold Cockpit")}</span>
      </div>
      <div className="hd-tools">
        <span className="lang-sel" role="group" aria-label={t("Ngôn ngữ", "Language")}>
          <button type="button" aria-pressed={lang === "vi"} onClick={() => setLang("vi")}>VI</button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
        </span>
        <button type="button" className="theme-btn" onClick={() => setTheme(light ? "dark" : "light")}
          title={light ? t("Chuyển sang nền tối", "Switch to dark mode") : t("Chuyển sang nền sáng", "Switch to light mode")}>
          {light ? t("🌙 Tối", "🌙 Dark") : t("☀️ Sáng", "☀️ Light")}
        </button>
      </div>
    </header>
  );
}
