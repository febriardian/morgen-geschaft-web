import React from "react";
import { captureMonitoredException } from "../../services/errorMonitoring.js";

// ========== SECTION ERROR BOUNDARY ==========
// Wraps individual page sections — failure in one section does not crash the
// whole page. Shows a localised retry prompt.
class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error(`Error di section "${this.props.name}":`, error, info);
    captureBoundaryError(error, `section:${this.props.name || "unknown"}`, info);
    reportErrorToBackend(error, `section:${this.props.name || "unknown"}`, info);
  }
  render() {
    if (this.state.hasError) {
      const isEn = detectLocale() === "en";
      return (
        <div style={{ padding: "32px", textAlign: "center", background: "#FFF8F0", border: "1px solid #F0E0D0", borderRadius: "8px", margin: "16px 0" }}>
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "14px", color: "#C97B5E", marginBottom: "8px" }}>
            {isEn
              ? `Something went wrong loading ${this.props.name || "this section"}.`
              : `Terjadi kesalahan saat memuat bagian ${this.props.name || "ini"}.`}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#4C6354", background: "none", border: "1px solid #E3DCC9", borderRadius: "6px", padding: "6px 16px", cursor: "pointer" }}
          >
            {isEn ? "Try again" : "Coba lagi"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ========== FULL-PAGE ERROR BOUNDARY ==========
// Wraps the entire app — last line of defence against white-screen crashes.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    captureBoundaryError(error, "app-root", info);
    reportErrorToBackend(error, "app-root", info);
  }
  render() {
    if (this.state.hasError) {
      const isEn = detectLocale() === "en";
      return (
        <div style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#FFF3EC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
            <span style={{ fontSize: "24px", color: "#C97B5E", fontWeight: 600 }}>!</span>
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", color: "#162B45", marginBottom: "8px" }}>
            {isEn ? "Something went wrong" : "Terjadi Kesalahan"}
          </h1>
          <p style={{ fontSize: "14px", color: "#6B6558", marginBottom: "8px", maxWidth: "400px" }}>
            {isEn
              ? "Sorry, something unexpected happened. Please reload the page."
              : "Maaf, ada yang tidak beres. Coba muat ulang halaman."}
          </p>
          {this.state.error?.message && (
            <p style={{ fontSize: "12px", color: "#A39E8E", marginBottom: "24px", maxWidth: "400px", fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-word" }}>
              {String(this.state.error.message).slice(0, 200)}
            </p>
          )}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "14px", padding: "12px 28px", border: "none", borderRadius: "8px", cursor: "pointer" }}
            >
              {isEn ? "Reload page" : "Muat Ulang"}
            </button>
            <button
              onClick={() => {
                window.history.back();
                setTimeout(() => this.setState({ hasError: false, error: null }), 100);
              }}
              style={{ background: "none", color: "#4C6354", fontFamily: "'Work Sans', sans-serif", fontWeight: 500, fontSize: "14px", padding: "12px 28px", border: "1px solid #E3DCC9", borderRadius: "8px", cursor: "pointer" }}
            >
              {isEn ? "Go back" : "Kembali"}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ========== HELPERS ==========

/**
 * Detect current locale from URL path. Falls back to "id".
 */
function detectLocale() {
  try {
    return window.location.pathname.startsWith("/en") ? "en" : "id";
  } catch {
    return "id";
  }
}

/**
 * Send errors caught by the app's own boundaries to Sentry. Without this,
 * the outer Sentry boundary cannot see errors that have already been handled.
 * Only code-level React context is attached; user data and component props are
 * intentionally excluded.
 */
function captureBoundaryError(error, boundary, info) {
  void captureMonitoredException(error, boundary, info);
}

/**
 * Fire-and-forget error report to the backend health endpoint.
 * Silently fails — error reporting must never cause a secondary crash.
 */
function reportErrorToBackend(error, context, info) {
  try {
    const payload = {
      message: String(error?.message || error).slice(0, 500),
      stack: String(error?.stack || "").slice(0, 1000),
      context,
      componentStack: String(info?.componentStack || "").slice(0, 500),
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Use sendBeacon for reliability — works even during page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/health/client-error",
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
    }
  } catch {
    // Intentionally silent — never let error reporting crash the error boundary
  }
}

export { SectionErrorBoundary, ErrorBoundary };
