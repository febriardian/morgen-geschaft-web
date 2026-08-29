// StoreFooter.jsx
// Full site footer extracted from App.jsx — hours, help links, social, copyright.

import { MARKETPLACE_LINKS, STORE_WHATSAPP } from "../../config/constants.js";
import { localizedSectionHash } from "../../i18n/locale.js";
import { captureReturnContext } from "../../utils/navigation.js";

export function StoreFooter({ locale, route, navigate, location }) {
  return (
    <footer id="kontak" style={{ background: "#F1EADC", borderTop: "2px solid rgba(245, 154, 26, 0.28)", padding: "32px 0 0" }}>
      <div className="footer-grid" style={{ maxWidth: "1080px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "64px", alignItems: "start", padding: "0 32px" }}>
        {/* Jam Operasional */}
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#6B6558", letterSpacing: "0.08em", marginBottom: "14px" }}>JAM OPERASIONAL</p>
          <div style={{ fontSize: "13px", color: "#6B6558", lineHeight: 2 }}>
            <p>Senin – Jumat</p>
            <p style={{ color: "#6B6558", fontWeight: 400 }}>07.00 – 22.00 WIB</p>
            <div style={{ height: "8px" }} />
            <p>Sabtu – Minggu</p>
            <p style={{ color: "#6B6558", fontWeight: 400 }}>07.00 – 24.00 WIB</p>
          </div>
        </div>

        {/* Bantuan */}
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#6B6558", letterSpacing: "0.08em", marginBottom: "14px" }}>BANTUAN</p>
          <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <a href={`${route("home")}#${localizedSectionHash(locale, "lacak")}`} style={{ color: "#6B6558", textDecoration: "none" }}>Lacak Pesanan</a>
            <a href={route("privacy")} style={{ color: "#6B6558", textDecoration: "none" }}>Kebijakan Privasi</a>
            <a href={route("terms")} style={{ color: "#6B6558", textDecoration: "none" }}>Syarat & Ketentuan</a>
            <a
              href={route("install")}
              onClick={(event) => {
                event.preventDefault();
                navigate(route("install"), { state: captureReturnContext(location) });
              }}
              style={{ color: "#6B6558", textDecoration: "none" }}
            >
              Download Aplikasi
            </a>
          </div>
        </div>

        {/* Hubungi Kami */}
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#6B6558", letterSpacing: "0.08em", marginBottom: "14px" }}>HUBUNGI KAMI</p>
          <div style={{ fontSize: "13px", color: "#6B6558", display: "flex", flexDirection: "column", gap: "9px" }}>
            <a href={`https://wa.me/${STORE_WHATSAPP}`} target="_blank" rel="noreferrer" style={{ color: "#6B6558", fontWeight: 0, textDecoration: "none" }}>
              WhatsApp: 0896-0172-5019
            </a>
            <a href="mailto:morgengeschaft@gmail.com" style={{ color: "#6B6558", textDecoration: "none" }}>morgengeschaft@gmail.com</a>
            <div className="footer-social-row" style={{ display: "flex", gap: "14px", marginTop: "6px", flexWrap: "wrap" }}>
              <a href="https://www.instagram.com/morgengeschaft" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6B6558", textDecoration: "none", fontSize: "13px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                Instagram
              </a>
              <a href={MARKETPLACE_LINKS.tiktok} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6B6558", textDecoration: "none", fontSize: "13px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.67a8.18 8.18 0 0 0 4.78 1.52V6.73a4.85 4.85 0 0 1-1.01-.04z"/></svg>
                TikTok
              </a>
              <a href="https://www.facebook.com/morgengeschaft" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6B6558", textDecoration: "none", fontSize: "13px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                Facebook
              </a>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1080px", margin: "28px auto 0", borderTop: "1px solid rgba(245, 154, 26, 0.24)", padding: "14px 32px" }}>
        <p style={{ fontSize: "11px", color: "#A39E8E", textAlign: "center" }}>
          © {new Date().getFullYear()} Morgen Geschäft. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
