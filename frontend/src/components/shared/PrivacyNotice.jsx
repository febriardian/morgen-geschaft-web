// components/shared/PrivacyNotice.jsx
// Minimal consent banner for analytics tracking (GA + Meta Pixel).

import { useState, useEffect } from "react";
import { setAnalyticsConsent } from "../../services/analytics.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";

export function PrivacyNotice() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("mg_analytics_consent");
      if (consent === null) setVisible(true);
    } catch {}
  }, []);

  if (!visible) return null;

  const accept = () => {
    setAnalyticsConsent(true);
    setVisible(false);
  };

  const decline = () => {
    setAnalyticsConsent(false);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={t("Persetujuan cookie", "Cookie consent")}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9997,
        background: "linear-gradient(135deg, #173B5E 0%, #162B45 100%)",
        color: "#F6F1E7",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        flexWrap: "wrap",
        fontFamily: "'Work Sans', sans-serif",
        fontSize: "13px",
        borderTop: "2px solid #F59A1A",
        boxShadow: "0 -8px 26px rgba(22,43,69,.22)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "9px",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          background: "rgba(245,154,26,.15)",
          color: "#F59A1A",
          border: "1px solid rgba(245,154,26,.35)",
          fontSize: "15px",
        }}
      >
        ◉
      </span>

      <span style={{ maxWidth: "560px", lineHeight: 1.55 }}>
        {t(
          "Kami menggunakan cookie analitik untuk meningkatkan pengalaman belanja.",
          "We use analytics cookies to improve your shopping experience."
        )}
      </span>

      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          type="button"
          onClick={accept}
          style={{
            background: "#F59A1A",
            color: "#162B45",
            border: "1px solid #F59A1A",
            borderRadius: "9px",
            padding: "8px 17px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 8px 18px rgba(245,154,26,.18)",
          }}
        >
          {t("Terima", "Accept")}
        </button>
        <button
          type="button"
          onClick={decline}
          style={{
            background: "transparent",
            color: "#F6F1E7",
            border: "1px solid rgba(246,241,231,.55)",
            borderRadius: "9px",
            padding: "8px 17px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t("Tolak", "Decline")}
        </button>
      </div>
    </div>
  );
}
