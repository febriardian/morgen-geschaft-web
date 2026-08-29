import { useState, useEffect } from "react";
import { API_BASE } from "../../config/constants.js";
import { auth } from "../../services/firebaseAuth.js";


export function AdminShippingTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE}/api/shipping/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setSettings(await res.json());
      } catch (err) { console.error("Gagal ambil shipping settings:", err); }
      finally { setLoading(false); }
    })();
  }, []);

  const switchCity = async (city) => {
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/shipping/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ activeCity: city }),
      });
      if (res.ok) {
        setSettings((prev) => ({ ...prev, activeCity: city }));
      } else {
        const data = await res.json();
        alert(data.error || "Gagal update.");
      }
    } catch { alert("Gagal update."); }
    finally { setSaving(false); }
  };

  if (loading) return <p style={{ fontSize: "13px", color: "#A39E8E" }}>Memuat...</p>;
  if (!settings) return (
    <div style={{ maxWidth: "600px" }}>
      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#C97B5E" }}>
        Settings pengiriman belum dikonfigurasi. Buat document <code>settings/shipping</code> di Firestore console.
      </p>
    </div>
  );

  const origins = settings.origins || {};
  const activeCity = settings.activeCity || "";

  return (
    <div style={{ maxWidth: "600px" }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4C6354", letterSpacing: "0.06em", marginBottom: "12px" }}>ORIGIN PENGIRIMAN AKTIF</p>
      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", marginBottom: "16px" }}>
        Pilih kota origin saat ini. Buyer di kota yang sama akan mendapat gratis ongkir.
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {Object.entries(origins).map(([key, val]) => (
          <button
            key={key}
            onClick={() => switchCity(key)}
            disabled={saving}
            style={{
              fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600,
              padding: "10px 20px", cursor: saving ? "not-allowed" : "pointer",
              border: activeCity === key ? "2px solid #1F2E22" : "1px solid #E3DCC9",
              background: activeCity === key ? "#1F2E22" : "#fff",
              color: activeCity === key ? "#F6F1E7" : "#162B45",
            }}
          >
            {activeCity === key && "✓ "}{val.label || key}
          </button>
        ))}
      </div>
      <div style={{ background: "#F6F1E7", padding: "14px 16px" }}>
        <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558" }}>
          Kurir: <strong>{settings.couriers || "jne,sicepat,anteraja"}</strong>
        </p>
        <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", marginTop: "4px" }}>
          Free ongkir: <strong>{Object.entries(settings.freeShippingPrefixes || {}).map(([k, v]) => `${k} (${v.length} area)`).join(", ") || "-"}</strong>
        </p>
        {origins[activeCity] && (
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", marginTop: "4px" }}>
            Alamat pickup: {origins[activeCity].address || "-"}
          </p>
        )}
      </div>
    </div>
  );
}
