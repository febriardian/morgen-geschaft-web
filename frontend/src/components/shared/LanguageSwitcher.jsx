import React from "react";
import { useLocale } from "../../i18n/LocaleContext.jsx";

export function LanguageSwitcher({ compact = false, onChange }) {
  const { locale, changeLocale, t } = useLocale();

  const selectLanguage = (nextLocale) => {
    changeLocale(nextLocale);
    onChange?.(nextLocale);
  };

  return (
    <div
      data-no-translate="true"
      role="group"
      aria-label={t("Pilih bahasa", "Choose language")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? "5px" : "6px",
        padding: compact ? "5px 7px" : "5px 8px",
        border: "1px solid #D8D0BF",
        borderRadius: "999px",
        background: "rgba(255,255,255,.55)",
        flexShrink: 0,
      }}
    >
      {["id", "en"].map((item, index) => {
        const active = locale === item;
        return (
          <React.Fragment key={item}>
            {index > 0 && <span aria-hidden="true" style={{ color: "#B4AC9D", fontSize: "10px" }}>|</span>}
            <button
              type="button"
              onClick={() => selectLanguage(item)}
              aria-pressed={active}
              title={item === "id" ? "Bahasa Indonesia" : "English"}
              style={{
                border: "none",
                background: active ? "#1F2E22" : "transparent",
                color: active ? "#FFFFFF" : "#6B6558",
                borderRadius: "999px",
                padding: compact ? "3px 6px" : "3px 7px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: compact ? "9px" : "10px",
                fontWeight: 700,
                letterSpacing: ".06em",
                cursor: active ? "default" : "pointer",
              }}
            >
              {item.toUpperCase()}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
