import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  MailCheck,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useModalAccessibility } from "../../hooks/useModalAccessibility.js";

const EMPTY_AUTH_STATE = {
  resolver: null,
  enrollment: null,
  qrDataUrl: "",
};

function LoginModal({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [resolver, setResolver] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [stage, setStage] = useState("credentials");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const firstInputRef = useRef(null);
  const dialogRef = useModalAccessibility({
    open,
    onClose: requestClose,
    canClose: !loading,
    initialFocusRef: firstInputRef,
  });

  useEffect(() => {
    if (!open) return undefined;
    window.dispatchEvent(new Event("mg:admin-auth-request"));
    void import("../../services/firebaseAuth.js");
    return undefined;
  }, [open]);

  if (!open) return null;

  function clearTransientState(nextStage = "credentials") {
    setTotpCode("");
    setResolver(EMPTY_AUTH_STATE.resolver);
    setEnrollment(EMPTY_AUTH_STATE.enrollment);
    setQrDataUrl(EMPTY_AUTH_STATE.qrDataUrl);
    setMessage("");
    setError("");
    setCopied(false);
    setVerificationSent(false);
    setStage(nextStage);
  }

  async function requestClose() {
    if (loading) return;
    if (enrollment || stage === "email-verification") {
      try {
        const authApi = await import("../../services/firebaseAuth.js");
        await authApi.signOutAdmin();
      } catch {}
    }
    setPassword("");
    clearTransientState();
    onClose();
  }

  async function finishCredential(credential, authApi) {
    const status = await authApi.getAdminSessionStatus(credential?.user);
    if (!status.isAdmin) {
      await authApi.signOutAdmin();
      const accessError = new Error("Akun ini belum memiliki akses admin.");
      accessError.code = "auth/admin-access-denied";
      throw accessError;
    }
    const requiresMfa = import.meta.env.VITE_REQUIRE_ADMIN_MFA === "true";
    if (!status.emailVerified) {
      setEmail(credential?.user?.email || email);
      setPassword("");
      setTotpCode("");
      setResolver(null);
      setEnrollment(null);
      setQrDataUrl("");
      setVerificationSent(false);
      setError("");
      setMessage("");
      setStage("email-verification");
      return;
    }

    if (!requiresMfa || status.hasSecondFactor) {
      setPassword("");
      clearTransientState();
      onClose();
      return;
    }

    const setup = await authApi.beginAdminTotpEnrollment();
    const { toDataURL } = await import("qrcode");
    const qrImage = await toDataURL(setup.qrCodeUrl, {
      width: 232,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#162B45", light: "#FFFFFF" },
    });

    setEnrollment(setup);
    setResolver(null);
    setQrDataUrl(qrImage);
    setPassword("");
    setTotpCode("");
    setStage("enrollment");
    setMessage("Pindai QR, lalu masukkan kode terbaru dari aplikasi Authenticator.");
  }

  async function handleLogin() {
    setError("");
    setMessage("");
    if (!email.trim() || !password) {
      setError("Isi email dan password admin terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const authApi = await import("../../services/firebaseAuth.js");
      const result = await authApi.beginAdminSignIn(email.trim().toLowerCase(), password);
      if (result.resolver) {
        setResolver(result.resolver);
        setEnrollment(null);
        setPassword("");
        setTotpCode("");
        setStage("challenge");
        setMessage("Buka aplikasi Authenticator dan masukkan kode 6 digit terbaru.");
      } else {
        await finishCredential(result.credential, authApi);
      }
    } catch (err) {
      const authApi = await import("../../services/firebaseAuth.js");
      setError(authApi.adminAuthMessage(err, err?.code?.includes("totp") ? "enrollment" : "login"));
      if (stage === "credentials") {
        try { await authApi.signOutAdmin(); } catch {}
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendVerificationEmail() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const authApi = await import("../../services/firebaseAuth.js");
      const result = await authApi.sendAdminEmailVerification();
      setVerificationSent(true);
      setMessage(result.alreadyVerified
        ? "Email ini sudah terverifikasi. Klik Saya sudah verifikasi untuk melanjutkan."
        : `Tautan verifikasi sudah dikirim ke ${result.email || email}. Periksa juga folder Spam.`);
    } catch (err) {
      const authApi = await import("../../services/firebaseAuth.js");
      setError(authApi.adminAuthMessage(err, "verification"));
    } finally {
      setLoading(false);
    }
  }

  async function checkEmailVerification() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const authApi = await import("../../services/firebaseAuth.js");
      const status = await authApi.refreshAdminEmailVerification();
      if (!status.emailVerified) {
        setError("Email belum terverifikasi. Buka tautan pada email, lalu periksa kembali.");
        return;
      }
      await finishCredential({ user: authApi.auth.currentUser }, authApi);
    } catch (err) {
      const authApi = await import("../../services/firebaseAuth.js");
      setError(authApi.adminAuthMessage(err, "verification"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyTotp() {
    if (!/^\d{6}$/.test(totpCode)) {
      setError("Kode Authenticator harus terdiri dari 6 digit.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const authApi = await import("../../services/firebaseAuth.js");
      if (enrollment) {
        await authApi.completeAdminTotpEnrollment(enrollment.secret, totpCode);
        await authApi.signOutAdmin();
        clearTransientState("enrolled");
        setPassword("");
        setMessage("Authenticator berhasil didaftarkan. Masuk ulang untuk menguji MFA.");
        return;
      }

      const credential = await authApi.completeAdminTotpSignIn(resolver, totpCode);
      await finishCredential(credential, authApi);
    } catch (err) {
      const authApi = await import("../../services/firebaseAuth.js");
      setTotpCode("");
      setError(authApi.adminAuthMessage(err, enrollment ? "enrollment" : "totp"));
    } finally {
      setLoading(false);
    }
  }

  async function backToCredentials() {
    setLoading(true);
    try {
      const authApi = await import("../../services/firebaseAuth.js");
      await authApi.signOutAdmin();
    } catch {
      // Tetap kembalikan UI ke form login meskipun jaringan sedang terganggu.
    } finally {
      setPassword("");
      clearTransientState();
      setLoading(false);
    }
  }

  async function copySecret() {
    if (!enrollment?.secretKey) return;
    try {
      await navigator.clipboard.writeText(enrollment.secretKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Kunci belum dapat disalin. Tekan dan salin kunci secara manual.");
    }
  }

  const isTotpStage = stage === "challenge" || stage === "enrollment";
  const canGoBack = isTotpStage || stage === "email-verification";
  const title = stage === "challenge"
    ? "Verifikasi Authenticator"
    : stage === "enrollment"
      ? "Aktifkan MFA Admin"
      : stage === "email-verification"
        ? "Verifikasi Email Admin"
        : stage === "enrolled"
          ? "MFA Berhasil Diaktifkan"
          : "Masuk ke Admin";

  const inputStyle = {
    width: "100%",
    padding: "12px 13px",
    border: "1px solid #D8CFBD",
    background: "#fff",
    color: "#162B45",
    borderRadius: 12,
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div
      className="mg-admin-auth-backdrop"
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 16,
        overflowY: "auto",
        background: "rgba(14, 31, 50, .62)",
        backdropFilter: "blur(7px)",
        zIndex: 60,
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-title"
        className={`mg-admin-auth-card ${stage === "enrollment" ? "is-enrollment" : ""}`}
        style={{
          background: "#F8F4EC",
          width: stage === "enrollment" ? "min(640px, 94vw)" : "min(430px, 94vw)",
          padding: "clamp(22px, 4vw, 32px)",
          border: "1px solid rgba(227, 220, 201, .9)",
          borderRadius: 24,
          boxShadow: "0 28px 90px rgba(7, 24, 42, .28)",
        }}
      >
        {canGoBack && (
          <button
            type="button"
            onClick={backToCredentials}
            disabled={loading}
            className="mg-admin-back"
            aria-label="Kembali ke login admin"
          >
            <ArrowLeft size={17} /> Kembali
          </button>
        )}

        <div className="mg-admin-auth-heading">
          <img className="mg-admin-auth-logo" src="/photos/logo 512.webp" alt="Morgen Geschäft" />
          <p>ADMIN AREA · SECURE ACCESS</p>
          <h2 id="admin-login-title">{title}</h2>
          <span>
            {stage === "credentials" && "Gunakan akun admin yang sudah memiliki izin akses."}
            {stage === "email-verification" && "Verifikasi email akun lama ini sebelum melanjutkan aktivasi keamanan."}
            {stage === "challenge" && "Password benar. Selesaikan lapisan keamanan kedua."}
            {stage === "enrollment" && "Hubungkan Authenticator satu kali untuk melindungi dashboard."}
            {stage === "enrolled" && "Pendaftaran selesai dan sesi satu faktor sudah ditutup."}
          </span>
        </div>

        {stage === "credentials" && (
          <div className="mg-admin-fields">
            <label htmlFor="admin-email">Email admin</label>
            <input
              ref={firstInputRef}
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoCapitalize="none"
              autoComplete="username"
              placeholder="admin@domain.com"
              style={inputStyle}
            />
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !loading && handleLogin()}
              autoComplete="current-password"
              placeholder="Masukkan password"
              style={inputStyle}
            />
          </div>
        )}

        {stage === "enrollment" && enrollment && (
          <>
            <div className="mg-admin-steps" aria-label="Langkah aktivasi MFA">
              <div className="is-active"><b>1</b><span>Pindai QR</span></div>
              <div className="is-active"><b>2</b><span>Masukkan kode</span></div>
              <div><b>3</b><span>Masuk ulang</span></div>
            </div>

            <div className="mg-admin-enrollment-grid">
              <div className="mg-admin-qr-panel">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR untuk menambahkan Morgen Geschäft ke aplikasi Authenticator" width="232" height="232" />
                ) : (
                  <div className="mg-admin-qr-loading"><LoaderCircle size={25} /> Menyiapkan QR...</div>
                )}
                <a href={enrollment.qrCodeUrl} className="mg-admin-auth-app-link">
                  <Smartphone size={15} /> Buka Authenticator di perangkat ini
                </a>
              </div>

              <div className="mg-admin-enrollment-copy">
                <h3><KeyRound size={18} /> Kunci manual</h3>
                <p>Jika QR tidak bisa dipindai, masukkan kunci ini secara manual. Jangan membagikannya.</p>
                <div className="mg-admin-secret">
                  <code>{enrollment.secretKey}</code>
                  <button type="button" onClick={copySecret} aria-label="Salin kunci manual">
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                  </button>
                </div>
                <label htmlFor="admin-totp-enrollment">Kode 6 digit dari aplikasi</label>
                <input
                  ref={firstInputRef}
                  id="admin-totp-enrollment"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))}
                  onKeyDown={(event) => event.key === "Enter" && !loading && verifyTotp()}
                  placeholder="000000"
                  style={{ ...inputStyle, textAlign: "center", fontSize: 21, letterSpacing: 7, fontVariantNumeric: "tabular-nums" }}
                />
              </div>
            </div>
          </>
        )}

        {stage === "challenge" && (
          <div className="mg-admin-challenge">
            <span className="mg-admin-device-icon"><Smartphone size={28} /></span>
            <label htmlFor="admin-totp">Kode 6 digit</label>
            <input
              ref={firstInputRef}
              id="admin-totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => event.key === "Enter" && !loading && verifyTotp()}
              placeholder="000000"
              style={{ ...inputStyle, textAlign: "center", fontSize: 23, letterSpacing: 8, fontVariantNumeric: "tabular-nums" }}
            />
            <small>Kode berganti sekitar setiap 30 detik.</small>
          </div>
        )}

        {stage === "email-verification" && (
          <div className="mg-admin-email-verification">
            <span className="mg-admin-email-icon" aria-hidden="true"><MailCheck size={27} /></span>
            <p>Tautan verifikasi akan dikirim ke:</p>
            <strong>{email}</strong>
            <small>Akun, UID, dan hak akses admin tetap sama. Tidak perlu membuat akun baru.</small>
          </div>
        )}

        {stage === "enrolled" && (
          <div className="mg-admin-success">
            <ShieldCheck size={36} />
            <p>Sekarang login admin memerlukan password dan kode dari Authenticator.</p>
          </div>
        )}

        <div className="mg-admin-feedback" aria-live="polite">
          {message && <p role="status" className="is-message">{message}</p>}
          {error && <p role="alert" className="is-error">{error}</p>}
        </div>

        {stage === "email-verification" ? (
          <div className="mg-admin-verification-actions">
            <button
              type="button"
              onClick={sendVerificationEmail}
              disabled={loading}
              className="mg-admin-primary"
            >
              {loading && <LoaderCircle size={17} className="mg-admin-spinner" />}
              {loading ? "Mengirim..." : verificationSent ? "Kirim ulang email verifikasi" : "Kirim email verifikasi"}
            </button>
            <button
              type="button"
              onClick={checkEmailVerification}
              disabled={loading}
              className="mg-admin-secondary"
            >
              Saya sudah verifikasi
            </button>
          </div>
        ) : stage !== "enrolled" ? (
          <button
            type="button"
            onClick={isTotpStage ? verifyTotp : handleLogin}
            disabled={loading}
            className="mg-admin-primary"
          >
            {loading && <LoaderCircle size={17} className="mg-admin-spinner" />}
            {loading
              ? "Memeriksa..."
              : stage === "challenge"
                ? "Verifikasi dan masuk"
                : stage === "enrollment"
                  ? "Aktifkan MFA"
                  : "Masuk dengan aman"}
          </button>
        ) : (
          <button type="button" onClick={() => clearTransientState()} className="mg-admin-primary">
            Masuk ulang untuk menguji MFA
          </button>
        )}

        <button type="button" onClick={requestClose} disabled={loading} className="mg-admin-cancel">
          {stage === "enrolled" ? "Selesai" : "Batal"}
        </button>
      </div>

      <style>{`
        .mg-admin-back{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:#5f6f7e;font-size:12px;font-weight:700;padding:0 0 12px;cursor:pointer}
        .mg-admin-auth-heading{text-align:center;margin-bottom:22px}.mg-admin-auth-logo{width:64px;height:64px;display:block;object-fit:contain;margin:0 auto 12px;border-radius:17px}
        .mg-admin-auth-heading p{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.15em;color:#c16f50;margin:0 0 7px}.mg-admin-auth-heading h2{font-family:'Fraunces',serif;font-size:clamp(23px,4vw,27px);line-height:1.15;color:#162b45;margin:0 0 8px}.mg-admin-auth-heading>span{display:block;color:#6b6558;font-size:12px;line-height:1.55;max-width:420px;margin:auto}
        .mg-admin-fields,.mg-admin-enrollment-copy,.mg-admin-challenge{display:flex;flex-direction:column}.mg-admin-fields label,.mg-admin-enrollment-copy label,.mg-admin-challenge label{font-size:11px;font-weight:800;color:#30465c;margin:0 0 6px}.mg-admin-fields input{margin-bottom:13px}.mg-admin-fields input:focus,.mg-admin-enrollment-copy input:focus,.mg-admin-challenge input:focus{border-color:#c97b5e!important;box-shadow:0 0 0 3px rgba(201,123,94,.13)}
        .mg-admin-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 18px}.mg-admin-steps div{position:relative;display:flex;align-items:center;gap:7px;color:#918a7d;font-size:10px;font-weight:700}.mg-admin-steps div:not(:last-child):after{content:'';position:absolute;left:29px;right:-4px;top:12px;height:1px;background:#d9d1c2;z-index:0}.mg-admin-steps b{position:relative;z-index:1;flex:0 0 25px;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#e5ded1;color:#7d7568;font-size:11px}.mg-admin-steps .is-active{color:#243b52}.mg-admin-steps .is-active b{background:#c97b5e;color:white}.mg-admin-steps .is-active:not(:last-child):after{background:#c97b5e}
        .mg-admin-enrollment-grid{display:grid;grid-template-columns:236px minmax(0,1fr);gap:22px;align-items:center}.mg-admin-qr-panel{display:flex;flex-direction:column;align-items:center;gap:9px}.mg-admin-qr-panel img{display:block;width:216px;height:216px;padding:8px;background:#fff;border:1px solid #e3dcc9;border-radius:18px}.mg-admin-qr-loading{width:216px;height:216px;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:center;gap:8px;color:#6b6558;font-size:11px}.mg-admin-auth-app-link{display:flex;align-items:center;justify-content:center;gap:5px;color:#365a78;font-size:10px;font-weight:700;text-decoration:none}.mg-admin-enrollment-copy h3{display:flex;align-items:center;gap:7px;color:#162b45;font-size:15px;margin:0 0 5px}.mg-admin-enrollment-copy p{color:#6b6558;font-size:11px;line-height:1.55;margin:0 0 10px}.mg-admin-secret{display:flex;align-items:center;gap:7px;padding:8px 8px 8px 10px;border:1px solid #e0d7c8;border-radius:11px;background:#fff;margin-bottom:14px}.mg-admin-secret code{flex:1;min-width:0;word-break:break-all;color:#162b45;font-size:11px;font-weight:700;letter-spacing:.05em}.mg-admin-secret button{flex:0 0 32px;width:32px;height:32px;border:0;border-radius:9px;display:grid;place-items:center;background:#eef1f3;color:#29455f;cursor:pointer}.mg-admin-enrollment-copy input{margin:0}
        .mg-admin-challenge{align-items:center;padding:15px 18px 5px}.mg-admin-device-icon{width:56px;height:56px;display:grid;place-items:center;margin-bottom:13px;border-radius:18px;color:#c16f50;background:#f2e4da}.mg-admin-challenge label{align-self:flex-start}.mg-admin-challenge input{margin:0}.mg-admin-challenge small{align-self:flex-start;color:#827b70;font-size:10px;margin-top:7px}
        .mg-admin-email-verification{display:flex;flex-direction:column;align-items:center;text-align:center;padding:15px 18px 8px}.mg-admin-email-icon{width:54px;height:54px;display:grid;place-items:center;margin-bottom:12px;border-radius:17px;color:#365a78;background:#e8eef2}.mg-admin-email-verification p{margin:0 0 5px;color:#6b6558;font-size:11px}.mg-admin-email-verification strong{max-width:100%;overflow-wrap:anywhere;color:#162b45;font-size:13px}.mg-admin-email-verification small{max-width:330px;margin-top:9px;color:#827b70;font-size:10px;line-height:1.55}.mg-admin-verification-actions{display:grid;gap:8px}.mg-admin-secondary{width:100%;min-height:43px;border:1px solid #cfc6b6;border-radius:12px;background:#fff;color:#30465c;font-size:12px;font-weight:800;cursor:pointer}.mg-admin-secondary:disabled{cursor:wait;opacity:.62}
        .mg-admin-success{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;color:#315b49;background:#edf4ef;border:1px solid #cfe0d5;border-radius:16px;padding:18px;margin-bottom:5px}.mg-admin-success p{font-size:12px;line-height:1.55;margin:0;max-width:310px}
        .mg-admin-feedback{min-height:28px;margin:8px 0}.mg-admin-feedback p{font-size:11px;line-height:1.5;margin:0;padding:8px 10px;border-radius:9px}.mg-admin-feedback .is-message{color:#315b49;background:#edf4ef}.mg-admin-feedback .is-error{color:#9b372c;background:#fbecea}
        .mg-admin-primary{width:100%;min-height:45px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;background:#162b45;color:#f8f4ec;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(22,43,69,.15)}.mg-admin-primary:disabled{cursor:wait;opacity:.62}.mg-admin-cancel{width:100%;border:0;background:transparent;color:#6b6558;font-size:12px;padding:10px 8px 0;cursor:pointer}.mg-admin-spinner{animation:mgAdminSpin .8s linear infinite}@keyframes mgAdminSpin{to{transform:rotate(360deg)}}
        @media(max-width:620px){.mg-admin-auth-backdrop{align-items:end!important;padding:8px!important}.mg-admin-auth-card{width:100%!important;max-height:94dvh;overflow-y:auto;border-radius:24px 24px 14px 14px!important;padding:21px!important}.mg-admin-enrollment-grid{grid-template-columns:1fr;gap:14px}.mg-admin-qr-panel img,.mg-admin-qr-loading{width:184px;height:184px}.mg-admin-steps span{display:none}.mg-admin-steps div{justify-content:center}.mg-admin-steps div:not(:last-child):after{left:calc(50% + 16px);right:calc(-50% + 16px)}.mg-admin-auth-heading{margin-bottom:17px}}
        @media(prefers-reduced-motion:reduce){.mg-admin-spinner{animation:none}}
      `}</style>
    </div>
  );
}

export { LoginModal };
