import { useState, useEffect, useRef } from "react";
import { STORE_WHATSAPP } from "./config/constants.js";
import { apiFetch, readJsonResponse } from "./services/apiClient.js";

// Markdown stripping dilakukan server-side di /api/chat endpoint.

const WA_ESCALATION_TRIGGERS = ["whatsapp", "customer service", "hubungi cs", "chat cs"];

function shouldShowWhatsApp(text = "") {
  const normalized = String(text).toLowerCase();
  return WA_ESCALATION_TRIGGERS.some((trigger) => normalized.includes(trigger));
}

function TypingDots() {
  return (
    <div className="flex items-center gap-[5px] px-3.5 py-2.5" role="status" aria-label="GESA sedang mengetik">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[7px] h-[7px] rounded-full bg-[#F59A1A] inline-block"
          style={{ animation: `gesaPulse 1.2s ${i * 0.16}s infinite ease-in-out` }}
        />
      ))}
    </div>
  );
}

export default function GesaChat({ compact = false, locale = "id" }) {
  const isEnglish = locale === "en";
  const greeting = isEnglish
    ? "Hello! I’m GESA, Morgen Geschäft virtual assistant. How can I help you today?"
    : "Halo! Saya GESA, asisten virtual Morgen Geschäft. Ada yang bisa saya bantu hari ini?";
  const [open, setOpen] = useState(false);
  const [triggerHovered, setTriggerHovered] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "model", text: greeting, ts: Date.now() },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    setMessages((current) => current.length <= 1 ? [{ role: "model", text: greeting, ts: Date.now() }] : current);
  }, [greeting]);
  useEffect(() => {
    const handleOpenChat = () => setOpen(true);
    window.addEventListener("mg:open-gesa-chat", handleOpenChat);
    return () => window.removeEventListener("mg:open-gesa-chat", handleOpenChat);
  }, []);

  async function sendToGesa(userMsg) {
    if (!userMsg.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg.trim(), ts: Date.now() }]);
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const history = messages.slice(1).slice(-10).map((m) => ({ role: m.role, text: m.text }));
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.trim(), history, locale }),
        signal: controller.signal,
      }, { timeoutMs: 32000, expectJson: true });
      clearTimeout(timeout);
      const data = await readJsonResponse(res);
      if (!res.ok) {
        const error = new Error(data?.error || (isEnglish ? "GESA server returned an error." : "Server GESA mengembalikan kesalahan."));
        error.status = res.status;
        throw error;
      }
      const reply = data.reply || (isEnglish ? "Sorry, I cannot process that request right now." : "Maaf, saya tidak dapat memproses permintaan itu sekarang.");
      setMessages((prev) => [...prev, { role: "model", text: reply, ts: Date.now() }]);
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err.name === "AbortError";
      const isRateLimit = err.status === 429 || /terlalu banyak|too many|busy/i.test(err.message || "");
      const isConfigurationError = err.status === 503 || /belum dikonfigurasi|not configured|api key/i.test(err.message || "");
      let errorText;
      if (isEnglish) {
        if (isTimeout) errorText = "GESA is taking longer than usual. Try again or contact Customer Service on WhatsApp 🙏";
        else if (isRateLimit) errorText = "GESA is busy right now. Wait a moment and try again, or contact Customer Service on WhatsApp 🙏";
        else if (isConfigurationError) errorText = "GESA is temporarily unavailable because the assistant server is not ready. Please contact Customer Service on WhatsApp 🙏";
        else errorText = "GESA could not reach the server. Make sure the Morgen backend is running, then try again or contact Customer Service on WhatsApp 🙏";
      } else {
        if (isTimeout) errorText = "GESA butuh waktu lebih lama dari biasanya. Coba lagi atau langsung chat CS via WhatsApp 🙏";
        else if (isRateLimit) errorText = "GESA sedang ramai. Tunggu sebentar lalu coba lagi, atau hubungi CS via WhatsApp 🙏";
        else if (isConfigurationError) errorText = "GESA sementara belum tersedia karena server asisten belum siap. Hubungi CS via WhatsApp untuk bantuan 🙏";
        else errorText = "GESA belum dapat terhubung ke server. Pastikan backend Morgen sedang berjalan, lalu coba lagi atau hubungi CS via WhatsApp 🙏";
      }
      console.error("GESA error:", err.message || err.name);
      setMessages((prev) => [...prev, { role: "model", text: errorText, _retry: userMsg.trim(), _isError: true, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }

  const quickReplies = messages.length === 1
    ? (isEnglish ? ["View products", "Coupon information", "Recommendations for oily skin"] : ["Lihat produk", "Info kupon", "Rekomendasi kulit berminyak"])
    : [];

  return (
    <>
      {/* Floating Action Button */}
      <div
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        title={open ? "Tutup chat" : "Chat dengan GESA"}
        tabIndex={0}
        role="button"
        aria-label={open ? "Tutup chat GESA" : "Buka chat GESA"}
        aria-expanded={open}
        className="gesa-launcher fixed bottom-4 right-5 z-[9999] cursor-pointer flex items-end gap-0 transition-transform duration-200 hover:scale-[1.04] focus:scale-[1.04]"
        style={{ transform: compact && !open ? "scale(1)" : undefined }}
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
        onFocus={() => setTriggerHovered(true)}
        onBlur={() => setTriggerHovered(false)}
      >
        {open ? (
          <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-[#173B5E] to-[#162B45] flex items-center justify-center shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F6F1E7" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        ) : (
          <div className="flex items-end gap-0">
            {(!compact || triggerHovered) && (
              <div className="bg-white rounded-[20px_20px_4px_20px] px-4 py-2 shadow-md mb-[18px] -mr-1.5 relative z-[1]">
                <span className="text-[#162B45] text-[13px] font-semibold font-body whitespace-nowrap">Hubungi GESA 👋</span>
              </div>
            )}
            <img
              src="/maskot-full-144.webp"
              alt=""
              width="72"
              height="72"
              loading="lazy"
              decoding="async"
              className="w-[72px] h-[72px] object-contain relative z-[2] drop-shadow-md"
            />
          </div>
        )}
      </div>

      {/* Chat Window */}
      {open && (
        <div
          className="gesa-chat-panel fixed bottom-24 right-6 z-[9998] w-[370px] max-w-[calc(100vw-32px)] h-[520px] max-h-[calc(100vh-140px)] rounded-[20px] overflow-hidden flex flex-col shadow-2xl animate-gesa-slide-up font-body"
          role="dialog"
          aria-label={isEnglish ? "GESA Chat — Morgen Geschäft Virtual Assistant" : "Chat GESA — Asisten Virtual Morgen Geschäft"}
          aria-modal="true"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-[#173B5E] to-[#162B45] text-[#F6F1E7] px-[18px] py-4 flex items-center gap-3 shrink-0">
            <div className="relative shrink-0">
              <img
                src="/maskot-88.webp"
                alt=""
                width="44"
                height="44"
                decoding="async"
                className="w-11 h-11 rounded-full object-cover border-2 border-white/15"
              />
              <span className="absolute bottom-[1px] right-[1px] w-2.5 h-2.5 rounded-full bg-[#F59A1A] border-2 border-[#162B45]" aria-label="Online" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px] tracking-wide">GESA</div>
              <div className="text-[11px] opacity-75 mt-px">{isEnglish ? "Virtual Assistant" : "Asisten Virtual"} · Morgen Geschäft</div>
            </div>
            <button
              type="button"
              aria-label="Minimkan chat"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="w-[30px] h-[30px] rounded-lg flex items-center justify-center bg-white/[.08] border-none cursor-pointer hover:bg-white/[.15] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F6F1E7" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2 bg-cream" role="log" aria-live="polite" aria-label={isEnglish ? "Chat history" : "Riwayat chat"}>
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} className={`${isUser ? "self-end" : "self-start"} max-w-[80%] animate-gesa-fade`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${
                      isUser
                        ? "bg-gradient-to-br from-[#173B5E] to-[#162B45] text-[#F6F1E7] rounded-br-[4px] shadow-md"
                        : m._isError
                          ? "bg-[#FFF8F0] text-[#9A6B3F] border border-[#F0E0D0] rounded-bl-[4px]"
                          : "bg-white text-[#1a1a1a] rounded-bl-[4px] shadow-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                  {/* WhatsApp escalation */}
                  {!isUser && shouldShowWhatsApp(m.text) && (
                    <a
                      href={`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent((isEnglish ? "Hello, GESA referred me to Customer Service. I need help with: " : "Halo, saya dialihkan dari GESA. Saya butuh bantuan tentang: ") + (messages[i - 1]?.text || (isEnglish ? "my question" : "pertanyaan saya")))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 mt-1.5 px-3.5 py-2 bg-[#F59A1A] text-[#162B45] rounded-[10px] text-[12.5px] font-semibold no-underline shadow-md w-fit hover:opacity-85 transition-opacity"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#162B45" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      {isEnglish ? "Contact Customer Service" : "Chat CS via WhatsApp"}
                    </a>
                  )}
                  {/* Retry button */}
                  {!isUser && m._retry && !loading && (
                    <button
                      type="button"
                      onClick={() => { setMessages((prev) => prev.filter((_, idx) => idx !== i)); sendToGesa(m._retry); }}
                      className="flex items-center gap-1.5 mt-1.5 px-3.5 py-[7px] bg-[#FFF9EF] border border-[#E9D1AA] rounded-[10px] text-xs font-semibold text-[#173B5E] cursor-pointer font-body w-fit hover:bg-sand-light transition-colors"
                    >
                      ↻ {isEnglish ? "Try again" : "Coba lagi"}
                    </button>
                  )}
                  <div className={`text-[10px] text-hint mt-[3px] ${isUser ? "text-right pr-1" : "text-left pl-1"}`}>
                    {i === 0 ? "" : new Date(m.ts).toLocaleTimeString(isEnglish ? "en-GB" : "id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="self-start bg-white rounded-[16px_16px_16px_4px] shadow-sm animate-gesa-fade">
                <TypingDots />
              </div>
            )}

            {/* Quick replies */}
            {quickReplies.length > 0 && !loading && (
              <div className="flex flex-wrap gap-1.5 mt-1 animate-gesa-fade-slow" role="group" aria-label={isEnglish ? "Quick questions" : "Pertanyaan cepat"}>
                {quickReplies.map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => sendToGesa(qr)}
                    className="px-3.5 py-1.5 text-xs font-medium text-[#173B5E] bg-[#FFF4DF] border border-[#F3C77D] rounded-full cursor-pointer transition-all hover:bg-[#FFE9BF] hover:border-[#F59A1A] font-body select-none"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Powered-by */}
          <div className="bg-cream text-center text-[9px] text-hint pt-[3px] tracking-wide" aria-hidden="true">
            Powered by GESA · Morgen Geschäft
          </div>

          {/* Input bar */}
          <div className="px-3.5 pb-3.5 pt-2.5 flex gap-2 items-center bg-cream border-t border-sand-dark shrink-0">
            <label htmlFor="gesa-chat-input" className="sr-only">{isEnglish ? "Write a message to GESA" : "Tulis pesan ke GESA"}</label>
            <input
              id="gesa-chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendToGesa(input)}
              placeholder={isEnglish ? "Type a message…" : "Tulis pesan…"}
              disabled={loading}
              className="flex-1 border-[1.5px] border-sand-dark rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none bg-white font-body transition-all focus:border-[#F59A1A] focus:ring-[3px] focus:ring-[rgba(245,154,26,.16)]"
            />
            <button
              type="button"
              aria-label={isEnglish ? "Send message" : "Kirim pesan"}
              onClick={() => sendToGesa(input)}
              disabled={loading || !input.trim()}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-none transition-all ${
                loading || !input.trim()
                  ? "bg-[#c8c0b4] cursor-not-allowed"
                  : "bg-gradient-to-br from-[#F59A1A] to-[#E88708] cursor-pointer hover:brightness-105"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#162B45" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
