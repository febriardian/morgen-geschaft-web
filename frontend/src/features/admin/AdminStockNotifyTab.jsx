import { useState, useEffect } from "react";
import { API_BASE } from "../../config/constants.js";
import { auth } from "../../services/firebaseAuth.js";


export function AdminStockNotifyTab() {
  const [subs, setSubs] = useState([]);
  const [snLoading, setSnLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE}/api/stock-notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setSubs(data.notifications || []);
      } catch (err) {
        console.error("Gagal memuat stock notifications:", err);
      } finally {
        setSnLoading(false);
      }
    })();
  }, []);

  const pending = subs.filter((s) => !s.notified);
  const sent = subs.filter((s) => s.notified);

  return (
    <div style={{ maxWidth: "600px" }}>
      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", marginBottom: "16px" }}>
        Daftar pelanggan yang minta notifikasi saat produk tersedia kembali. Email otomatis terkirim saat stok diupdate dari 0.
      </p>
      {snLoading ? (
        <p style={{ fontSize: "13px", color: "#A39E8E" }}>Memuat...</p>
      ) : subs.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#A39E8E" }}>Belum ada yang mendaftar notifikasi stok.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#C97B5E", letterSpacing: "0.06em", marginBottom: "8px" }}>
                MENUNGGU STOK ({pending.length})
              </p>
              {pending.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #E3DCC9", fontFamily: "'Work Sans', sans-serif", fontSize: "13px" }}>
                  <div>
                    <p style={{ fontWeight: 600, color: "#162B45" }}>{s.productName || s.productId}</p>
                    <p style={{ fontSize: "12px", color: "#6B6558" }}>{s.email}</p>
                  </div>
                  <span style={{ fontSize: "11px", color: "#A39E8E" }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString("id-ID") : ""}</span>
                </div>
              ))}
            </div>
          )}
          {sent.length > 0 && (
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4C6354", letterSpacing: "0.06em", marginBottom: "8px" }}>
                SUDAH DIKIRIM ({sent.length})
              </p>
              {sent.slice(0, 20).map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #F0EBE0", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#A39E8E" }}>
                  <span>{s.productName || s.productId} → {s.email}</span>
                  <span>{s.notifiedAt ? new Date(s.notifiedAt).toLocaleDateString("id-ID") : "✓"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
