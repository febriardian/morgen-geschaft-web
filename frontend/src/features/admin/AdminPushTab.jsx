import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { API_BASE } from "../../config/constants.js";
import { db } from "../../services/firebase.js";
import { auth } from "../../services/firebaseAuth.js";


export function AdminPushTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/id");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [urlEn, setUrlEn] = useState("/en");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [subscribers, setSubscribers] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [showSubs, setShowSubs] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "push_subscriptions"));
        setSubscribers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch { setSubscribers([]); }
      setSubsLoading(false);
    })();
  }, []);

  const broadcast = async () => {
    if (!title.trim() || !body.trim()) { setResult("Title dan body wajib diisi."); return; }
    setSending(true);
    setResult("");
    try {
      const user = auth.currentUser;
      if (!user) { setResult("Login dulu."); setSending(false); return; }
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/push/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/id",
          titleEn: titleEn.trim(),
          bodyEn: bodyEn.trim(),
          urlEn: urlEn.trim() || "/en",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim.");
      setResult(data.message);
      setTitle(""); setBody(""); setUrl("/id");
      setTitleEn(""); setBodyEn(""); setUrlEn("/en");
    } catch (err) {
      setResult(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: "480px" }}>
      {/* Subscriber count */}
      <div style={{ background: "#fff", border: "1px solid #E3DCC9", padding: "12px 16px", marginBottom: "16px", fontFamily: "'Work Sans', sans-serif" }}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: "13px", color: "#162B45", fontWeight: 600 }}>
              {subsLoading ? "..." : `${subscribers.length} subscriber`}
            </p>
            <p style={{ fontSize: "11px", color: "#A39E8E" }}>Pengguna yang mengaktifkan notifikasi push</p>
          </div>
          {subscribers.length > 0 && (
            <button onClick={() => setShowSubs(!showSubs)} style={{ background: "none", border: "1px solid #E3DCC9", padding: "4px 10px", cursor: "pointer", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558" }}>
              {showSubs ? "Tutup" : "Lihat detail"}
            </button>
          )}
        </div>
        {showSubs && subscribers.length > 0 && (
          <div style={{ marginTop: "10px", maxHeight: "200px", overflowY: "auto", borderTop: "1px solid #E3DCC9", paddingTop: "8px" }}>
            {subscribers.map((s, i) => (
              <div key={s.id} style={{ fontSize: "11px", color: "#6B6558", padding: "4px 0", borderBottom: i < subscribers.length - 1 ? "1px solid #f0ece0" : "none", fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: "#A39E8E" }}>#{i + 1}</span> · {s.createdAt ? new Date(s.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"} · {s.endpoint ? new URL(s.endpoint).hostname : "unknown"}
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", marginBottom: "16px" }}>
        Kirim push notification ke semua subscriber yang sudah mengizinkan notifikasi.
      </p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#F59A1A", letterSpacing: ".08em", marginBottom: "8px" }}>VERSI INDONESIA</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul notifikasi" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Isi pesan..." rows={3} style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff", resize: "vertical" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL Indonesia (contoh: /id/katalog)" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-4 outline-none" />

      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#173B5E", letterSpacing: ".08em", marginBottom: "8px" }}>ENGLISH VERSION</p>
      <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Notification title (optional)" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
      <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} placeholder="Notification message (optional)..." rows={3} style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff", resize: "vertical" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
      <input value={urlEn} onChange={(e) => setUrlEn(e.target.value)} placeholder="English URL (example: /en/catalog)" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-3 outline-none" />
      <button onClick={broadcast} disabled={sending} style={{ background: sending ? "#C9C2AD" : "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, padding: "10px 20px", border: "none", cursor: sending ? "not-allowed" : "pointer" }}>
        {sending ? "Mengirim..." : "Kirim Broadcast"}
      </button>
      {result && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: result.includes("Gagal") || result.includes("wajib") ? "#C97B5E" : "#4C6354", marginTop: "10px" }}>{result}</p>}
    </div>
  );
}



// ---------- Admin Image Upload (ke Express server) ----------

// ---------- Admin Stock Notification Viewer ----------
