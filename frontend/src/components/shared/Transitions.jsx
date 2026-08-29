import { ChevronRight } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher.jsx";
import { useLocale } from "../../i18n/LocaleContext.jsx";
// ---------- Header kembali sederhana untuk halaman standalone ----------

function SimpleBackHeader({ onBack }) {
  const { t } = useLocale();
  return (
    <header
      className="simple-back-header"
      style={{
        borderBottom: "1px solid #E3DCC9",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        background: "#F6F1E7",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label={t("Kembali", "Back")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <ChevronRight
          size={16}
          color="#1F2E22"
          aria-hidden="true"
          style={{ transform: "rotate(180deg)" }}
        />
        <span
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "20px",
            color: "#173B5E",
            whiteSpace: "nowrap",
          }}
        >
          Morgen Geschäft
        </span>
      </button>
      <LanguageSwitcher />
    </header>
  );
}



function StandalonePageHero({ eyebrow, title, description }) {
  return (
    <header className="standalone-page-hero">
      <div className="standalone-page-hero-inner">
        <p className="standalone-page-eyebrow">{eyebrow}</p>
        <h1 className="standalone-page-title">{title}</h1>
        {description && <p className="standalone-page-description">{description}</p>}
      </div>
    </header>
  );
}



function StandaloneSectionHeader({ title, meta, supporting, actions }) {
  return (
    <header className="standalone-content-header">
      <div className="standalone-content-heading">
        <h2>{title}</h2>
        {supporting && <div className="standalone-content-supporting">{supporting}</div>}
      </div>
      {(meta || actions) && (
        <div className="standalone-content-aside">
          {meta && <span className="standalone-content-meta" aria-live="polite">{meta}</span>}
          {actions && <div className="standalone-content-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}


function HomeReturnTransition({ visible }) {
  const { t } = useLocale();
  if (!visible) return null;

  return (
    <div
      className="mg-home-return-transition"
      role="status"
      aria-live="polite"
      aria-label={t("Mengembalikan halaman terakhir", "Returning to the last page")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "rgba(246,241,231,.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <style>{`
        @keyframes mgReturnOverlay {
          0% { opacity: 0; }
          14%, 78% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes mgReturnCard {
          0% { opacity: 0; transform: translateY(10px) scale(.985); }
          22%, 78% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-4px) scale(.995); }
        }
        @keyframes mgReturnProgress {
          0% { transform: translateX(-105%); }
          100% { transform: translateX(105%); }
        }
        .mg-home-return-transition { animation: mgReturnOverlay .72s ease both; }
        .mg-home-return-card { animation: mgReturnCard .72s cubic-bezier(.2,.72,.2,1) both; }
        .mg-home-return-progress::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 55%;
          background: linear-gradient(90deg, transparent, #F59A1A, transparent);
          animation: mgReturnProgress .68s ease-in-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .mg-home-return-transition,
          .mg-home-return-card { animation: none !important; }
          .mg-home-return-progress::after { animation: none !important; transform: translateX(45%); }
        }
      `}</style>
      <div
        className="mg-home-return-card"
        style={{
          width: "min(360px, 92vw)",
          padding: "24px 24px 22px",
          textAlign: "center",
          background: "rgba(255,253,248,.96)",
          border: "1px solid #E3DCC9",
          borderRadius: "16px",
          boxShadow: "0 24px 70px rgba(22,43,69,.12)",
        }}
      >
        <div
          style={{
            width: "54px",
            height: "54px",
            margin: "0 auto 13px",
            display: "grid",
            placeItems: "center",
            borderRadius: "15px",
            background: "#F6F1E7",
            border: "1px solid rgba(245,154,26,.28)",
          }}
        >
          <img src="/photos/logo-512.webp" alt="" style={{ width: "34px", height: "34px", objectFit: "contain" }} />
        </div>
        <p style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: "19px", color: "#162B45" }}>
          {t("Mengembalikan halaman", "Returning to the page")}
        </p>
        <p style={{ margin: "6px 0 15px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#7B7569", lineHeight: 1.6 }}>
          {t("Menyiapkan bagian terakhir yang kamu buka.", "Preparing the last section you viewed.")}
        </p>
        <div
          className="mg-home-return-progress"
          style={{ position: "relative", height: "3px", overflow: "hidden", borderRadius: "999px", background: "#E9E2D4" }}
        />
      </div>
    </div>
  );
}




function PageRouteTransition({ visible, label = "Menyiapkan halaman" }) {
  const { t } = useLocale();
  const localizedLabel = t(label);
  if (!visible) return null;

  return (
    <div
      className="mg-page-route-transition"
      role="status"
      aria-live="polite"
      aria-label={localizedLabel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 998,
        display: "grid",
        placeItems: "center",
        pointerEvents: "all",
        background: "rgba(246,241,231,.58)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <style>{`
        @keyframes mgPageVeil {
          0% { opacity: 0; }
          22%, 72% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes mgPageStatusIn {
          0% { opacity: 0; transform: translateY(8px) scale(.985); }
          28%, 72% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-3px) scale(.995); }
        }
        @keyframes mgPageProgress {
          0% { transform: translateX(-115%); }
          100% { transform: translateX(215%); }
        }
        .mg-page-route-transition {
          animation: mgPageVeil .56s ease both;
        }
        .mg-page-route-status {
          animation: mgPageStatusIn .56s cubic-bezier(.2,.75,.2,1) both;
        }
        .mg-page-route-progress::after {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 44%;
          border-radius: inherit;
          background: linear-gradient(90deg, transparent, #F59A1A 45%, #173B5E 70%, transparent);
          animation: mgPageProgress .5s cubic-bezier(.4,0,.2,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .mg-page-route-transition,
          .mg-page-route-status { animation: none !important; }
          .mg-page-route-progress::after { animation: none !important; transform: translateX(90%); }
        }
      `}</style>

      <div
        className="mg-page-route-status"
        style={{
          minWidth: "min(270px, 82vw)",
          padding: "15px 18px 14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "rgba(255,253,248,.95)",
          border: "1px solid rgba(227,220,201,.95)",
          borderRadius: "14px",
          boxShadow: "0 18px 52px rgba(22,43,69,.11)",
        }}
      >
        <div
          style={{
            width: "38px",
            height: "38px",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "11px",
            background: "#F6F1E7",
            border: "1px solid rgba(245,154,26,.25)",
          }}
        >
          <img src="/photos/logo-512.webp" alt="" style={{ width: "25px", height: "25px", objectFit: "contain" }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, color: "#162B45" }}>
            {localizedLabel}
          </p>
          <div
            className="mg-page-route-progress"
            style={{ position: "relative", height: "3px", marginTop: "8px", overflow: "hidden", borderRadius: "999px", background: "#E9E2D4" }}
          />
        </div>
      </div>
    </div>
  );
}

export { SimpleBackHeader, StandalonePageHero, StandaloneSectionHeader, HomeReturnTransition, PageRouteTransition };

