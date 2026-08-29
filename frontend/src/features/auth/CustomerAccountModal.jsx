import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock3,
  Coins,
  Copy,
  Gift,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  loadCustomerAccount,
  preloadCustomerAuth,
  requestCustomerOtp,
  saveCustomerAddresses,
  verifyCustomerOtp,
} from "../../services/customerAuth.js";
import { copyTextWithFallback, formatIDR } from "../../utils/general.js";
import {
  buildReferralUrl,
  isValidReferralCode,
  normalizeReferralCode,
} from "../../utils/referral.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { useModalAccessibility } from "../../hooks/useModalAccessibility.js";

const EMPTY_ADDRESS = Object.freeze({
  label: "",
  recipient: "",
  phone: "",
  address: "",
  areaId: "",
  areaName: "",
  originalAreaName: "",
});

function maskEmail(value) {
  const [name = "", domain = ""] = String(value || "").split("@");
  if (!domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

function addressFormValue(address = {}) {
  return {
    label: address.label || "",
    recipient: address.recipient || "",
    phone: address.phone || "",
    address: address.address || "",
    areaId: address.areaId || "",
    areaName: address.areaName || "",
    originalAreaName: address.areaName || "",
  };
}

export default function CustomerAccountModal({
  open,
  customer,
  initialReferralCode = "",
  onReferralHandled,
  onClose,
  onReorder,
  featureFlags,
}) {
  const { locale, route, t } = useLocale();
  const [email, setEmail] = useState(customer?.email || "");
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [referralCode, setReferralCode] = useState(() => normalizeReferralCode(initialReferralCode));
  const [showReferralInput, setShowReferralInput] = useState(Boolean(initialReferralCode));
  const [account, setAccount] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [copiedKey, setCopiedKey] = useState("");
  const [addressEditor, setAddressEditor] = useState(null);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [savingAddress, setSavingAddress] = useState(false);
  const firstRef = useRef(null);
  const dialogRef = useModalAccessibility({ open, onClose, initialFocusRef: firstRef });

  useEffect(() => {
    if (!open) return;
    preloadCustomerAuth();
  }, [open]);

  const localError = useCallback((value) => {
    const messageText = String(value || "");
    const known = {
      "Alamat email tidak valid.": "Invalid email address.",
      "Format kode referral tidak valid.": "Invalid referral code format.",
      "Kode referral tidak ditemukan.": "Referral code was not found.",
      "Kode referral tidak valid.": "Invalid referral code.",
      "Kode salah atau sudah tidak berlaku.": "The code is incorrect or no longer valid.",
      "Kode sudah kedaluwarsa. Minta kode baru.": "The code has expired. Request a new one.",
      "Kode belum dapat dikirim. Coba lagi sebentar.": "The code could not be sent. Try again shortly.",
      "Akun tidak dapat dimuat.": "The account could not be loaded.",
      "Alamat tidak dapat disimpan.": "The address could not be saved.",
    };
    return locale === "en" ? (known[messageText] || messageText) : messageText;
  }, [locale]);

  const refreshAccount = useCallback(async ({ force = false } = {}) => {
    setLoading(true);
    setError("");
    try { setAccount(await loadCustomerAccount({ force })); }
    catch (refreshError) { setError(localError(refreshError.message)); }
    finally { setLoading(false); }
  }, [localError]);

  useEffect(() => {
    if (open && customer?.uid) void refreshAccount();
  }, [open, customer?.uid, refreshAccount]);

  useEffect(() => {
    if (!open) return;
    const nextCode = normalizeReferralCode(initialReferralCode);
    if (nextCode) {
      setReferralCode(nextCode);
      setShowReferralInput(true);
    }
    if (customer?.email) setEmail(customer.email);
  }, [customer?.email, initialReferralCode, open]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  if (!open) return null;

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedReferral = showReferralInput ? normalizeReferralCode(referralCode) : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(t("Masukkan alamat email yang valid.", "Enter a valid email address."));
      return;
    }
    if (normalizedReferral && !isValidReferralCode(normalizedReferral)) {
      setError(t("Kode referral harus terdiri dari 10 karakter, misalnya MG4EF1CF80.", "A referral code must contain 10 characters, for example MG4EF1CF80."));
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await requestCustomerOtp(normalizedEmail, normalizedReferral);
      setEmail(normalizedEmail);
      setReferralCode(normalizedReferral);
      setChallenge(result);
      setCode("");
      setResendSeconds(60);
      setMessage(t(
        `Kode 6 digit dikirim ke ${maskEmail(normalizedEmail)}. Berlaku 10 menit.`,
        `A 6-digit code was sent to ${maskEmail(normalizedEmail)}. It is valid for 10 minutes.`
      ));
    } catch (sendError) {
      setError(localError(sendError.message));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError(t("Masukkan kode 6 digit.", "Enter the 6-digit code."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await verifyCustomerOtp({ email, challengeId: challenge.challengeId, code });
      if (result.referralApplied) {
        setAccountNotice(t(
          "Kode referral berhasil diterapkan. Reward aktif setelah pesanan pertama memenuhi syarat.",
          "The referral code was applied. The reward activates after the first eligible order."
        ));
      } else if (referralCode && ["existing_account", "already_bound"].includes(result.referralStatus)) {
        setAccountNotice(t(
          "Kamu berhasil masuk. Kode undangan tidak diterapkan karena akun ini sudah terdaftar atau sudah terhubung ke referral lain.",
          "You are signed in. The invite code was not applied because this account already existed or was already linked to another referral."
        ));
      }
      onReferralHandled?.();
      setChallenge(null);
      setCode("");
      setResendSeconds(0);
      setActiveTab("summary");
      setAccount(await loadCustomerAccount());
    } catch (verifyError) {
      setError(localError(verifyError.message));
    } finally {
      setLoading(false);
    }
  };

  const resetEmail = () => {
    setChallenge(null);
    setCode("");
    setMessage("");
    setError("");
    setResendSeconds(0);
    window.setTimeout(() => firstRef.current?.focus(), 0);
  };

  const signOutCustomer = async () => {
    const { signOutAdmin } = await import("../../services/firebaseAuth.js");
    await signOutAdmin();
    setAccount(null);
    setChallenge(null);
    setCode("");
    setMessage("");
    setAccountNotice("");
    setActiveTab("summary");
  };

  const copyValue = async (value, key) => {
    if (!(await copyTextWithFallback(value))) return;
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1800);
  };

  const profile = account?.customer;
  const orders = account?.orders || [];
  const rewardTransactions = account?.rewardTransactions || [];
  const addresses = profile?.addresses || [];
  const pointValue = Math.max(0, Number(account?.rules?.pointValue || 100));
  const referralLink = profile?.referralCode
    ? buildReferralUrl(window.location.origin, route("home"), profile.referralCode)
    : "";

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "id-ID",
    { day: "numeric", month: "short", year: "numeric" }
  );

  const statusLabel = (status) => {
    const labels = {
      pending: t("Menunggu pembayaran", "Awaiting payment"),
      paid: t("Sudah dibayar", "Paid"),
      processing: t("Sedang diproses", "Processing"),
      shipped: t("Dalam pengiriman", "Shipped"),
      delivered: t("Selesai", "Delivered"),
      cancelled: t("Dibatalkan", "Cancelled"),
      failed: t("Pembayaran gagal", "Payment failed"),
      expired: t("Kedaluwarsa", "Expired"),
    };
    return labels[String(status || "").toLowerCase()] || status || t("Menunggu pembayaran", "Awaiting payment");
  };

  const rewardTransactionLabel = (transaction) => {
    const labels = {
      points_earned: t("Poin dari belanja", "Points earned from purchase"),
      points_redeemed: t("Poin digunakan", "Points used"),
      points_restored: t("Poin dikembalikan", "Points restored"),
      referral_redeemed: t("Saldo referral digunakan", "Referral balance used"),
      referral_restored: t("Saldo referral dikembalikan", "Referral balance restored"),
      referral_join_bonus: t("Bonus memakai referral", "Referral signup bonus"),
      referral_invite_bonus: t("Bonus mengajak teman", "Friend invitation bonus"),
    };
    return labels[transaction.type] || t("Aktivitas reward", "Reward activity");
  };

  const startAddAddress = () => {
    setAddressEditor("new");
    setAddressForm({ ...EMPTY_ADDRESS });
    setError("");
  };

  const startEditAddress = (address, index) => {
    setAddressEditor(index);
    setAddressForm(addressFormValue(address));
    setError("");
  };

  const submitAddress = async (event) => {
    event.preventDefault();
    const nextAddress = {
      label: addressForm.label.trim() || t("Alamat", "Address"),
      recipient: addressForm.recipient.trim(),
      phone: addressForm.phone.replace(/[^0-9+]/g, ""),
      address: addressForm.address.trim(),
      areaId: addressForm.areaName.trim() === addressForm.originalAreaName ? addressForm.areaId : "",
      areaName: addressForm.areaName.trim(),
    };
    if (nextAddress.recipient.length < 2 || nextAddress.phone.replace(/\D/g, "").length < 9 || nextAddress.address.length < 10) {
      setError(t("Lengkapi nama penerima, nomor WhatsApp, dan alamat lengkap.", "Complete the recipient name, WhatsApp number, and full address."));
      return;
    }
    if (addressEditor === "new" && addresses.length >= 5) {
      setError(t("Maksimal lima alamat tersimpan.", "You can save up to five addresses."));
      return;
    }
    const nextAddresses = addressEditor === "new"
      ? [...addresses, nextAddress]
      : addresses.map((address, index) => index === addressEditor ? nextAddress : address);
    setSavingAddress(true);
    setError("");
    try {
      const saved = await saveCustomerAddresses(nextAddresses);
      setAccount((current) => ({
        ...current,
        customer: { ...current.customer, addresses: saved },
      }));
      setAddressEditor(null);
      setAddressForm({ ...EMPTY_ADDRESS });
      setAccountNotice(t("Alamat berhasil disimpan.", "Address saved."));
    } catch (saveError) {
      setError(localError(saveError.message));
    } finally {
      setSavingAddress(false);
    }
  };

  const removeAddress = async (index) => {
    if (!window.confirm(t("Hapus alamat ini?", "Delete this address?"))) return;
    setSavingAddress(true);
    setError("");
    try {
      const saved = await saveCustomerAddresses(addresses.filter((_, itemIndex) => itemIndex !== index));
      setAccount((current) => ({
        ...current,
        customer: { ...current.customer, addresses: saved },
      }));
      setAccountNotice(t("Alamat berhasil dihapus.", "Address deleted."));
    } catch (removeError) {
      setError(localError(removeError.message));
    } finally {
      setSavingAddress(false);
    }
  };

  const tabs = [
    { key: "summary", icon: UserRound, label: t("Ringkasan", "Overview") },
    { key: "orders", icon: Package, label: t("Pesanan", "Orders") },
    { key: "addresses", icon: MapPin, label: t("Alamat", "Addresses") },
    { key: "rewards", icon: Gift, label: t("Reward", "Rewards") },
  ].filter((tab) => tab.key !== "rewards" || featureFlags?.referral !== false || featureFlags?.loyalty !== false);

  return (
    <div className="customer-account-backdrop">
      <style>{`
        .customer-account-backdrop{position:fixed;inset:0;z-index:70;background:rgba(22,43,69,.52);backdrop-filter:blur(5px);display:grid;place-items:center;padding:16px;font-family:'Work Sans',sans-serif}
        .customer-account-dialog{width:min(620px,calc(100vw - 32px));max-height:90vh;overflow:hidden;background:#F8F3E9;border:1px solid rgba(227,220,201,.95);border-radius:22px;box-shadow:0 30px 90px rgba(13,31,51,.28);color:#162B45;display:flex;flex-direction:column}
        .customer-account-header{padding:18px 20px 15px;background:linear-gradient(135deg,#fff 0%,#FFF8ED 100%);border-bottom:1px solid #E8DFCD;display:flex;align-items:center;justify-content:space-between;gap:16px}
        .customer-account-brand{display:flex;align-items:center;gap:11px;min-width:0}.customer-account-brand-icon{width:40px;height:40px;border-radius:13px;background:#162B45;color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(22,43,69,.16);flex:none}
        .customer-account-brand h2{font:600 21px/1.2 'Fraunces',serif;margin:0}.customer-account-brand p{font-size:12px;color:#756E62;margin:3px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:390px}
        .customer-icon-button{width:36px;height:36px;border:1px solid #E3DCC9;border-radius:11px;background:#fff;color:#5F5A50;display:grid;place-items:center;cursor:pointer;transition:.18s ease;flex:none}.customer-icon-button:hover{border-color:#F59A1A;color:#162B45;transform:translateY(-1px)}
        .customer-login{padding:24px 24px 26px;overflow:auto}.customer-login-intro{display:grid;grid-template-columns:46px 1fr;gap:13px;align-items:center;background:#fff;border:1px solid #E6DECD;border-radius:16px;padding:14px;margin-bottom:19px}.customer-login-intro-icon{width:46px;height:46px;border-radius:14px;background:#FFF1D8;color:#C9780C;display:grid;place-items:center}.customer-login-intro strong{display:block;font-size:14px}.customer-login-intro p{font-size:12px;line-height:1.5;color:#756E62;margin:3px 0 0}
        .customer-field{display:block;margin-bottom:13px}.customer-field>span{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;color:#635D52;margin-bottom:6px;text-transform:uppercase}.customer-input{width:100%;box-sizing:border-box;border:1px solid #DCD3C0;border-radius:12px;background:#fff;padding:11px 12px;color:#162B45;font:14px 'Work Sans',sans-serif;outline:none;transition:.18s ease}.customer-input:focus{border-color:#F59A1A;box-shadow:0 0 0 3px rgba(245,154,26,.13)}.customer-input:disabled{background:#F1EDE4;color:#756E62}.customer-otp{font:700 24px 'JetBrains Mono',monospace;text-align:center;letter-spacing:8px;padding-left:20px}
        .customer-referral-box{background:#FFF7E8;border:1px solid #F0D8AA;border-radius:13px;padding:12px;margin:2px 0 14px}.customer-referral-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.customer-referral-heading strong{font-size:12px;color:#6D4D16}.customer-text-button{border:0;background:none;padding:0;color:#A86200;font:600 12px 'Work Sans',sans-serif;cursor:pointer}.customer-referral-box small{display:block;color:#7A6B50;line-height:1.45;margin-top:7px}
        .customer-primary-button{width:100%;border:0;border-radius:12px;background:#162B45;color:#FFF8ED;padding:12px 16px;font:700 13px 'Work Sans',sans-serif;cursor:pointer;box-shadow:0 10px 22px rgba(22,43,69,.15);transition:.18s ease}.customer-primary-button:hover:not(:disabled){background:#213D5F;transform:translateY(-1px)}.customer-primary-button:disabled{opacity:.58;cursor:not-allowed}.customer-secondary-button{border:1px solid #DCD3C0;border-radius:11px;background:#fff;color:#162B45;padding:9px 12px;font:600 12px 'Work Sans',sans-serif;cursor:pointer}.customer-link-button{width:100%;border:0;background:none;color:#756E62;padding:10px;font:600 12px 'Work Sans',sans-serif;cursor:pointer}
        .customer-feedback{border-radius:11px;padding:9px 11px;font-size:12px;line-height:1.45;margin:9px 0}.customer-feedback.success{background:#E9F1E4;color:#36543C}.customer-feedback.error{background:#F9E9E4;color:#A13E31}.customer-otp-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:-3px 0 13px;color:#756E62;font-size:11px}
        .customer-profile-strip{padding:14px 20px;background:#fff;border-bottom:1px solid #E8DFCD;display:flex;justify-content:space-between;align-items:center;gap:12px}.customer-profile-id{display:flex;align-items:center;gap:10px;min-width:0}.customer-avatar{width:36px;height:36px;border-radius:12px;background:#FFF0D2;color:#B66700;display:grid;place-items:center;font-weight:800}.customer-profile-id strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:350px}.customer-profile-id span{display:block;font-size:11px;color:#80786B;margin-top:2px}
        .customer-tabs{display:flex;gap:4px;padding:8px 12px;background:#fff;border-bottom:1px solid #E8DFCD;overflow-x:auto;scrollbar-width:none}.customer-tabs::-webkit-scrollbar{display:none}.customer-tab{flex:1;min-width:max-content;border:0;border-radius:10px;background:transparent;color:#746D61;padding:8px 10px;display:flex;align-items:center;justify-content:center;gap:6px;font:600 12px 'Work Sans',sans-serif;cursor:pointer}.customer-tab.active{background:#162B45;color:#fff;box-shadow:0 6px 16px rgba(22,43,69,.14)}
        .customer-content{padding:18px 20px 22px;overflow:auto;min-height:260px}.customer-notice{display:flex;gap:8px;align-items:flex-start;background:#EAF2E5;color:#36543C;border:1px solid #D5E3CF;border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.45;margin-bottom:14px}.customer-section-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.customer-section-heading h3{font:600 18px 'Fraunces',serif;margin:0}.customer-section-heading p{font-size:11px;color:#80786B;margin:3px 0 0}
        .customer-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:13px}.customer-stat{background:#fff;border:1px solid #E5DCC9;border-radius:15px;padding:14px}.customer-stat-icon{width:30px;height:30px;border-radius:10px;background:#FFF2DB;color:#B66700;display:grid;place-items:center;margin-bottom:10px}.customer-stat strong{display:block;font:600 19px 'Fraunces',serif}.customer-stat span{font-size:11px;color:#80786B}.customer-quick-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.customer-quick-card{border:1px solid #E5DCC9;border-radius:15px;background:#fff;padding:13px;text-align:left;cursor:pointer;color:#162B45}.customer-quick-card:hover{border-color:#F2B458}.customer-quick-card strong{display:block;font-size:13px}.customer-quick-card span{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#80786B;margin-top:6px}
        .customer-empty{text-align:center;background:#fff;border:1px dashed #D8CEB9;border-radius:16px;padding:28px 18px;color:#756E62}.customer-empty svg{color:#C6BDAA}.customer-empty strong{display:block;color:#162B45;font-size:14px;margin-top:9px}.customer-empty p{font-size:12px;line-height:1.5;margin:5px 0 0}
        .customer-order{background:#fff;border:1px solid #E5DCC9;border-radius:15px;padding:13px 14px;margin-bottom:9px}.customer-order-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.customer-order-id{font:700 11px 'JetBrains Mono',monospace}.customer-order-date{display:block;font-size:10px;color:#8B8377;margin-top:4px}.customer-status{border-radius:999px;background:#FFF1D8;color:#8A560B;padding:4px 8px;font-size:10px;font-weight:700;white-space:nowrap}.customer-order-items{font-size:12px;line-height:1.5;color:#6D665B;margin:10px 0}.customer-order-bottom{border-top:1px solid #F0E8D9;padding-top:9px;display:flex;justify-content:space-between;align-items:center;gap:10px}.customer-order-bottom strong{font-size:13px}.customer-reorder{border:1px solid #162B45;border-radius:9px;background:#fff;color:#162B45;padding:7px 10px;font:700 11px 'Work Sans',sans-serif;cursor:pointer}
        .customer-address{background:#fff;border:1px solid #E5DCC9;border-radius:15px;padding:13px 14px;margin-bottom:9px}.customer-address-top{display:flex;justify-content:space-between;gap:10px}.customer-address-actions{display:flex;gap:5px}.customer-address h4{margin:0;font-size:13px}.customer-address p{font-size:12px;line-height:1.55;color:#6D665B;margin:6px 0 0}.customer-mini-button{width:30px;height:30px;border:1px solid #E5DCC9;border-radius:9px;background:#fff;color:#6D665B;display:grid;place-items:center;cursor:pointer}.customer-mini-button.danger:hover{color:#A13E31;border-color:#E7B8AE}.customer-address-form{background:#fff;border:1px solid #E1D6C1;border-radius:16px;padding:14px;margin-bottom:12px}.customer-address-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.customer-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
        .customer-reward-hero{background:linear-gradient(135deg,#162B45,#244665);color:#fff;border-radius:17px;padding:17px;box-shadow:0 14px 30px rgba(22,43,69,.16)}.customer-reward-hero p{font-size:11px;opacity:.74;margin:0 0 5px}.customer-reward-code{display:flex;justify-content:space-between;align-items:center;gap:12px}.customer-reward-code strong{font:700 22px 'JetBrains Mono',monospace;letter-spacing:2px}.customer-copy-light{width:36px;height:36px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:rgba(255,255,255,.1);color:#fff;display:grid;place-items:center;cursor:pointer}.customer-share-link{background:#fff;border:1px solid #E5DCC9;border-radius:14px;padding:12px;margin-top:10px}.customer-share-link label{display:block;font-size:10px;font-weight:700;color:#80786B;text-transform:uppercase;margin-bottom:6px}.customer-share-row{display:flex;gap:7px}.customer-share-row input{min-width:0;flex:1}.customer-rules{background:#fff;border:1px solid #E5DCC9;border-radius:15px;padding:14px;margin-top:10px}.customer-rule{display:grid;grid-template-columns:25px 1fr;gap:9px;align-items:start;margin-bottom:10px}.customer-rule:last-child{margin-bottom:0}.customer-rule-number{width:25px;height:25px;border-radius:8px;background:#FFF1D8;color:#9A5C00;display:grid;place-items:center;font-size:11px;font-weight:800}.customer-rule strong{display:block;font-size:12px}.customer-rule span{display:block;font-size:11px;color:#756E62;line-height:1.45;margin-top:2px}
        .customer-reward-balances{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px}.customer-reward-balance{background:#fff;border:1px solid #E5DCC9;border-radius:16px;padding:14px}.customer-reward-balance-head{display:flex;align-items:center;gap:7px;color:#756E62;font-size:11px}.customer-reward-balance-head svg{color:#C9780C}.customer-reward-balance strong{display:block;font:600 21px 'Fraunces',serif;margin-top:8px}.customer-reward-balance small{display:block;color:#80786B;font-size:10px;margin-top:3px}.customer-points-guide{background:#FFF7E8;border:1px solid #F0D8AA;border-radius:15px;padding:13px 14px;margin-bottom:10px}.customer-points-guide strong{display:block;font-size:12px;color:#6D4D16}.customer-points-guide p{font-size:11px;line-height:1.55;color:#7A6B50;margin:5px 0 0}.customer-reward-history{margin-top:14px}.customer-reward-history h4{font:600 15px 'Fraunces',serif;margin:0 0 8px}.customer-reward-entry{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fff;border:1px solid #E9E1D2;border-radius:12px;padding:10px 11px;margin-bottom:7px}.customer-reward-entry strong{display:block;font-size:11px}.customer-reward-entry small{display:block;font-size:9px;color:#8A8275;margin-top:3px}.customer-reward-entry-value{text-align:right;font-size:11px;font-weight:800;color:#3F704A;white-space:nowrap}.customer-reward-entry-value.negative{color:#A35F26}.customer-reward-entry-value em{display:block;font-style:normal;font-weight:500;color:#8A8275;font-size:9px;margin-top:3px}.customer-reward-divider{height:1px;background:#E6DDCB;margin:16px 0}
        .customer-rule>.customer-rule-number{width:28px;height:28px;display:flex;align-items:center;justify-content:center;line-height:1;margin:0;color:#9A5C00}.customer-rule>div>span{display:block;font-size:11px;color:#756E62;line-height:1.45;margin-top:2px}
        @media(max-width:640px){.customer-account-backdrop{place-items:end center;padding:0}.customer-account-dialog{width:100%;max-height:92dvh;border-radius:22px 22px 0 0;border-bottom:0}.customer-account-header{padding:15px 16px 13px}.customer-account-brand h2{font-size:19px}.customer-account-brand p{max-width:245px}.customer-login{padding:19px 16px 22px}.customer-profile-strip{padding:12px 16px}.customer-tabs{padding:7px 8px}.customer-tab{padding:8px 9px}.customer-content{padding:15px 14px 20px}.customer-address-form-grid{grid-template-columns:1fr}.customer-reward-code strong{font-size:19px}.customer-stats,.customer-quick-grid,.customer-reward-balances{gap:8px}}
        @media(max-width:390px){.customer-tab{font-size:11px}.customer-tab svg{display:none}.customer-profile-id strong{max-width:215px}.customer-stats{grid-template-columns:1fr 1fr}.customer-stat{padding:12px}.customer-quick-grid{grid-template-columns:1fr}.customer-otp{letter-spacing:6px}}
      `}</style>

      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-account-title"
        className="customer-account-dialog"
      >
        <header className="customer-account-header">
          <div className="customer-account-brand">
            <div className="customer-account-brand-icon"><UserRound size={20} /></div>
            <div>
              <h2 id="customer-account-title">{profile ? t("Akun saya", "My account") : t("Masuk atau daftar", "Sign in or register")}</h2>
              <p>{profile ? profile.email : t("Satu email untuk riwayat, alamat, dan reward", "One email for orders, addresses, and rewards")}</p>
            </div>
          </div>
          <button ref={profile ? firstRef : undefined} type="button" className="customer-icon-button" onClick={onClose} aria-label={t("Tutup akun", "Close account")}><X size={18} /></button>
        </header>

        {!profile ? (
          <div className="customer-login">
            <div className="customer-login-intro">
              <div className="customer-login-intro-icon"><Mail size={21} /></div>
              <div>
                <strong>{t("Tanpa password, tetap aman", "Passwordless and secure")}</strong>
                <p>{t("Email baru otomatis dibuatkan akun. Email lama langsung masuk ke akun yang sama setelah kode diverifikasi.", "A new email creates an account automatically. An existing email signs in to the same account after verification.")}</p>
              </div>
            </div>

            <label className="customer-field" htmlFor="customer-email">
              <span>Email</span>
              <input ref={firstRef} id="customer-email" className="customer-input" type="email" autoComplete="email" value={email} disabled={Boolean(challenge)} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" />
            </label>

            {!challenge && featureFlags?.referral !== false && (
              <div className="customer-referral-box">
                <div className="customer-referral-heading">
                  <strong>{initialReferralCode ? t("Undangan referral ditemukan", "Referral invite found") : t("Punya kode referral?", "Have a referral code?")}</strong>
                  <button type="button" className="customer-text-button" onClick={() => { setShowReferralInput((current) => !current); setError(""); }}>
                    {showReferralInput ? t("Tutup", "Hide") : t("Masukkan kode", "Enter code")}
                  </button>
                </div>
                {showReferralInput && (
                  <input className="customer-input" value={referralCode} onChange={(event) => setReferralCode(normalizeReferralCode(event.target.value))} maxLength={10} autoCapitalize="characters" aria-label={t("Kode referral teman", "Friend's referral code")} placeholder="MG4EF1CF80" style={{ marginTop: 9, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1.2 }} />
                )}
                <small>{initialReferralCode
                  ? t("Kode dari tautan sudah terisi otomatis. Kamu masih bisa memeriksanya sebelum meminta OTP.", "The code from the link was filled automatically. You can review it before requesting an OTP.")
                  : t("Opsional dan hanya dapat diterapkan saat akun baru pertama kali dibuat.", "Optional and available only when a new account is created for the first time.")}</small>
              </div>
            )}

            {challenge && (
              <>
                <label className="customer-field" htmlFor="customer-otp">
                  <span>{t("Kode verifikasi", "Verification code")}</span>
                  <input id="customer-otp" className="customer-input customer-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" aria-describedby="customer-otp-message" />
                </label>
                <div className="customer-otp-actions">
                  <span><Clock3 size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />{t("Berlaku 10 menit", "Valid for 10 minutes")}</span>
                  <button type="button" className="customer-text-button" disabled={resendSeconds > 0 || loading} onClick={sendCode} style={{ opacity: resendSeconds > 0 ? .55 : 1 }}>
                    {resendSeconds > 0 ? t(`Kirim ulang ${resendSeconds}d`, `Resend in ${resendSeconds}s`) : t("Kirim ulang kode", "Resend code")}
                  </button>
                </div>
              </>
            )}

            {message && <p id="customer-otp-message" role="status" className="customer-feedback success">{message}</p>}
            {error && <p role="alert" className="customer-feedback error">{error}</p>}

            <button type="button" disabled={loading} onClick={challenge ? verifyCode : sendCode} className="customer-primary-button">
              {loading ? t("Memproses...", "Processing...") : challenge ? t("Verifikasi dan masuk", "Verify and sign in") : t("Kirim kode OTP", "Send OTP code")}
            </button>
            {challenge && <button type="button" onClick={resetEmail} className="customer-link-button">{t("Gunakan email lain", "Use another email")}</button>}
          </div>
        ) : (
          <>
            <div className="customer-profile-strip">
              <div className="customer-profile-id">
                <div className="customer-avatar">{String(profile.email || "M").slice(0, 1).toUpperCase()}</div>
                <div><strong>{profile.email}</strong><span>{t("Pelanggan terverifikasi", "Verified customer")}</span></div>
              </div>
              <button type="button" className="customer-secondary-button" onClick={signOutCustomer} style={{ display: "flex", alignItems: "center", gap: 6 }}><LogOut size={14} /> {t("Keluar", "Sign out")}</button>
            </div>

            <nav className="customer-tabs" aria-label={t("Menu akun", "Account menu")}>
              {tabs.map(({ key, icon: Icon, label }) => (
                <button key={key} type="button" className={`customer-tab${activeTab === key ? " active" : ""}`} onClick={() => { setActiveTab(key); setAddressEditor(null); setError(""); }} aria-current={activeTab === key ? "page" : undefined}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </nav>

            <div className="customer-content">
              {accountNotice && <div className="customer-notice" role="status"><Check size={15} style={{ flex: "none", marginTop: 1 }} /><span>{accountNotice}</span></div>}
              {error && <p role="alert" className="customer-feedback error">{error}</p>}

              {activeTab === "summary" && (
                <div>
                  <div className="customer-section-heading"><div><h3>{t("Ringkasan akun", "Account overview")}</h3><p>{t("Semua aktivitas penting dalam satu tempat", "Your important activity in one place")}</p></div><button type="button" className="customer-icon-button" onClick={() => refreshAccount({ force: true })} disabled={loading} aria-label={t("Muat ulang akun", "Refresh account")}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button></div>
                  <div className="customer-stats">
                    {featureFlags?.loyalty !== false && <div className="customer-stat"><div className="customer-stat-icon"><Coins size={15} /></div><strong>{Number(profile.points || 0).toLocaleString(locale === "en" ? "en-US" : "id-ID")}</strong><span>{t(`Poin tersedia · ${formatIDR(Number(profile.points || 0) * pointValue)}`, `Available points · ${formatIDR(Number(profile.points || 0) * pointValue)}`)}</span></div>}
                    {featureFlags?.referral !== false && <div className="customer-stat"><div className="customer-stat-icon"><Gift size={15} /></div><strong>{formatIDR(profile.referralCredit)}</strong><span>{t("Saldo referral", "Referral balance")}</span></div>}
                  </div>
                  <div className="customer-quick-grid">
                    <button type="button" className="customer-quick-card" onClick={() => setActiveTab("orders")}><strong>{t("Pesanan saya", "My orders")}</strong><span>{t(`${orders.length} pesanan`, `${orders.length} orders`)} <ChevronRight size={13} /></span></button>
                    <button type="button" className="customer-quick-card" onClick={() => setActiveTab("addresses")}><strong>{t("Alamat tersimpan", "Saved addresses")}</strong><span>{t(`${addresses.length} dari 5 alamat`, `${addresses.length} of 5 addresses`)} <ChevronRight size={13} /></span></button>
                    {(featureFlags?.loyalty !== false || featureFlags?.referral !== false) && <button type="button" className="customer-quick-card" onClick={() => setActiveTab("rewards")}><strong>{t("Reward saya", "My rewards")}</strong><span>{t("Poin, referral, dan riwayat", "Points, referrals, and history")} <ChevronRight size={13} /></span></button>}
                    <button type="button" className="customer-quick-card" onClick={onClose}><strong>{t("Lanjut belanja", "Continue shopping")}</strong><span>{t("Kembali ke katalog", "Back to the catalog")} <ChevronRight size={13} /></span></button>
                  </div>
                </div>
              )}

              {activeTab === "orders" && (
                <div>
                  <div className="customer-section-heading"><div><h3>{t("Riwayat pesanan", "Order history")}</h3><p>{t("Maksimal 50 pesanan terbaru", "Up to 50 recent orders")}</p></div><button type="button" className="customer-icon-button" onClick={() => refreshAccount({ force: true })} disabled={loading} aria-label={t("Muat ulang pesanan", "Refresh orders")}><RefreshCw size={15} /></button></div>
                  {orders.length === 0 ? (
                    <div className="customer-empty"><Package size={28} /><strong>{t("Belum ada pesanan", "No orders yet")}</strong><p>{t("Pesanan yang dibuat saat masuk akan muncul otomatis di sini.", "Orders placed while signed in will appear here automatically.")}</p></div>
                  ) : orders.map((order) => (
                    <article key={order.orderId} className="customer-order">
                      <div className="customer-order-top"><div><span className="customer-order-id">{order.orderId}</span><time className="customer-order-date">{order.createdAt ? dateFormatter.format(new Date(order.createdAt)) : ""}</time></div><span className="customer-status">{statusLabel(order.status)}</span></div>
                      <p className="customer-order-items">{order.items.map((item) => `${item.qty}× ${item.name}`).join(", ")}</p>
                      {order.trackingNumber && <p className="customer-order-items" style={{ marginTop: -3 }}><strong>{t("No. resi", "Tracking no.")}:</strong> {order.trackingNumber}</p>}
                      <div className="customer-order-bottom"><strong>{formatIDR(order.amount)}</strong><button type="button" className="customer-reorder" onClick={() => { onReorder?.(order.items); onClose(); }}><ShoppingBag size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 5 }} />{t("Beli lagi", "Buy again")}</button></div>
                    </article>
                  ))}
                </div>
              )}

              {activeTab === "addresses" && (
                <div>
                  <div className="customer-section-heading"><div><h3>{t("Alamat tersimpan", "Saved addresses")}</h3><p>{t("Simpan maksimal lima alamat pengiriman", "Save up to five shipping addresses")}</p></div>{addressEditor === null && <button type="button" className="customer-secondary-button" onClick={startAddAddress} disabled={addresses.length >= 5 || savingAddress} style={{ display: "flex", alignItems: "center", gap: 5 }}><Plus size={14} /> {t("Tambah", "Add")}</button>}</div>
                  {addressEditor !== null && (
                    <form className="customer-address-form" onSubmit={submitAddress}>
                      <div className="customer-address-form-grid">
                        <label className="customer-field"><span>{t("Label alamat", "Address label")}</span><input className="customer-input" value={addressForm.label} onChange={(event) => setAddressForm((current) => ({ ...current, label: event.target.value }))} placeholder={t("Rumah / Kantor", "Home / Office")} maxLength={40} /></label>
                        <label className="customer-field"><span>{t("Nama penerima", "Recipient name")}</span><input className="customer-input" value={addressForm.recipient} onChange={(event) => setAddressForm((current) => ({ ...current, recipient: event.target.value }))} autoComplete="name" maxLength={100} /></label>
                        <label className="customer-field"><span>{t("Nomor WhatsApp", "WhatsApp number")}</span><input className="customer-input" type="tel" value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value.replace(/[^0-9+\-\s]/g, "") }))} placeholder="08123456789" /></label>
                        <label className="customer-field"><span>{t("Kecamatan / kota", "District / city")}</span><input className="customer-input" value={addressForm.areaName} onChange={(event) => setAddressForm((current) => ({ ...current, areaName: event.target.value }))} placeholder={t("Contoh: Ungaran, Semarang", "Example: Ungaran, Semarang")} /></label>
                      </div>
                      <label className="customer-field"><span>{t("Alamat lengkap", "Full address")}</span><textarea className="customer-input" rows={3} value={addressForm.address} onChange={(event) => setAddressForm((current) => ({ ...current, address: event.target.value }))} placeholder={t("Jalan, nomor rumah, RT/RW, dan patokan", "Street, house number, neighborhood, and landmark")} maxLength={500} style={{ resize: "vertical" }} /></label>
                      <div className="customer-form-actions"><button type="button" className="customer-secondary-button" onClick={() => { setAddressEditor(null); setError(""); }}>{t("Batal", "Cancel")}</button><button type="submit" className="customer-primary-button" disabled={savingAddress} style={{ width: "auto", minWidth: 110 }}>{savingAddress ? t("Menyimpan...", "Saving...") : t("Simpan alamat", "Save address")}</button></div>
                    </form>
                  )}
                  {addresses.length === 0 && addressEditor === null ? (
                    <div className="customer-empty"><MapPin size={28} /><strong>{t("Belum ada alamat", "No saved addresses")}</strong><p>{t("Tambahkan alamat agar checkout berikutnya lebih cepat.", "Add an address to make your next checkout faster.")}</p></div>
                  ) : addresses.map((address, index) => (
                    <article key={`${address.address}-${index}`} className="customer-address">
                      <div className="customer-address-top"><div><h4>{address.label || t("Alamat", "Address")}</h4><p><strong>{address.recipient}</strong> · {address.phone}<br />{address.address}{address.areaName ? `, ${address.areaName}` : ""}</p></div><div className="customer-address-actions"><button type="button" className="customer-mini-button" onClick={() => startEditAddress(address, index)} aria-label={t("Ubah alamat", "Edit address")}><Pencil size={13} /></button><button type="button" className="customer-mini-button danger" onClick={() => removeAddress(index)} disabled={savingAddress} aria-label={t("Hapus alamat", "Delete address")}><Trash2 size={13} /></button></div></div>
                    </article>
                  ))}
                </div>
              )}

              {activeTab === "rewards" && (featureFlags?.loyalty !== false || featureFlags?.referral !== false) && (
                <div>
                  <div className="customer-section-heading"><div><h3>{t("Poin dan reward", "Points and rewards")}</h3><p>{t("Saldo, cara penggunaan, dan riwayat aktivitas", "Balances, usage rules, and activity history")}</p></div><button type="button" className="customer-icon-button" onClick={() => refreshAccount({ force: true })} disabled={loading} aria-label={t("Muat ulang reward", "Refresh rewards")}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button></div>
                  <div className="customer-reward-balances">
                    {featureFlags?.loyalty !== false && <div className="customer-reward-balance"><div className="customer-reward-balance-head"><Coins size={14} /> {t("Poin tersedia", "Available points")}</div><strong>{Number(profile.points || 0).toLocaleString(locale === "en" ? "en-US" : "id-ID")}</strong><small>{t(`Bernilai ${formatIDR(Number(profile.points || 0) * pointValue)}`, `Worth ${formatIDR(Number(profile.points || 0) * pointValue)}`)}</small></div>}
                    {featureFlags?.referral !== false && <div className="customer-reward-balance"><div className="customer-reward-balance-head"><Gift size={14} /> {t("Saldo referral", "Referral balance")}</div><strong>{formatIDR(profile.referralCredit)}</strong><small>{t(`${Number(profile.successfulReferrals || 0)} referral berhasil`, `${Number(profile.successfulReferrals || 0)} successful referrals`)}</small></div>}
                  </div>

                  {featureFlags?.loyalty !== false && <div className="customer-points-guide"><strong>{t("Cara kerja poin", "How points work")}</strong><p>{t(
                    `Dapatkan 1 poin setiap belanja bersih ${formatIDR(account?.rules?.spendPerPoint || 10_000)}. Setiap poin bernilai ${formatIDR(pointValue)}. Minimal pemakaian ${account?.rules?.minimumRedemptionPoints || 10} poin dan potongan poin maksimal 20% dari subtotal produk. Poin masuk setelah pembayaran berhasil dan tidak kedaluwarsa.`,
                    `Earn 1 point for every ${formatIDR(account?.rules?.spendPerPoint || 10_000)} of net product spend. Each point is worth ${formatIDR(pointValue)}. The minimum redemption is ${account?.rules?.minimumRedemptionPoints || 10} points, capped at 20% of the product subtotal. Points are added after successful payment and do not expire.`
                  )}</p><p>{t("Poin, saldo referral, dan kupon dapat digunakan bersama. Ongkir tidak menghasilkan poin dan tidak dapat dibayar dengan poin.", "Points, referral balance, and coupons can be used together. Shipping neither earns points nor can be paid with points.")}</p></div>}

                  <div className="customer-reward-history">
                    <h4>{t("Riwayat reward", "Reward history")}</h4>
                    {rewardTransactions.length === 0 ? <div className="customer-empty" style={{ padding: "20px 16px" }}><Coins size={25} /><strong>{t("Belum ada aktivitas reward", "No reward activity yet")}</strong><p>{t("Poin dan bonus akan tercatat otomatis setelah digunakan atau diperoleh.", "Points and bonuses will be recorded automatically when earned or used.")}</p></div> : rewardTransactions.map((transaction) => {
                      const amount = transaction.points || transaction.referralCredit || 0;
                      const isNegative = amount < 0;
                      const valueLabel = transaction.points
                        ? `${amount > 0 ? "+" : ""}${amount.toLocaleString(locale === "en" ? "en-US" : "id-ID")} ${t("poin", "points")}`
                        : `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${formatIDR(Math.abs(amount))}`;
                      const status = transaction.status === "pending" ? t("Menunggu pembayaran", "Awaiting payment") : transaction.status === "cancelled" ? t("Dibatalkan", "Cancelled") : "";
                      return <div key={transaction.id} className="customer-reward-entry"><div><strong>{rewardTransactionLabel(transaction)}</strong><small>{transaction.orderId}{transaction.createdAt ? ` · ${dateFormatter.format(new Date(transaction.createdAt))}` : ""}</small></div><div className={`customer-reward-entry-value${isNegative ? " negative" : ""}`}>{valueLabel}{transaction.points ? <em>{formatIDR(Math.abs(transaction.value || (amount * pointValue)))}{status ? ` · ${status}` : ""}</em> : status ? <em>{status}</em> : null}</div></div>;
                    })}
                  </div>

                  {featureFlags?.referral !== false && <>
                    <div className="customer-reward-divider" />
                    <div className="customer-section-heading"><div><h3>{t("Program referral", "Referral program")}</h3><p>{t("Undang teman dengan tautan atau kode", "Invite friends with your link or code")}</p></div></div>
                    <div className="customer-reward-hero"><p>{t("Kode referral kamu", "Your referral code")}</p><div className="customer-reward-code"><strong>{profile.referralCode}</strong><button type="button" className="customer-copy-light" onClick={() => copyValue(profile.referralCode, "code")} aria-label={t("Salin kode referral", "Copy referral code")}>{copiedKey === "code" ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
                    <div className="customer-share-link"><label>{t("Tautan undangan", "Invite link")}</label><div className="customer-share-row"><input className="customer-input" readOnly value={referralLink} aria-label={t("Tautan referral", "Referral link")} /><button type="button" className="customer-secondary-button" onClick={() => copyValue(referralLink, "link")} style={{ minWidth: 72 }}>{copiedKey === "link" ? t("Tersalin", "Copied") : t("Salin", "Copy")}</button></div></div>
                    {profile.referredByCode && <div className="customer-notice" style={{ marginTop: 10, marginBottom: 0 }}><Check size={15} /><span>{t(`Akunmu terhubung ke kode ${profile.referredByCode}.`, `Your account is linked to code ${profile.referredByCode}.`)}</span></div>}
                    <div className="customer-rules">
                      <div className="customer-rule"><span className="customer-rule-number">1</span><div><strong>{t("Bagikan tautan", "Share your link")}</strong><span>{t("Kode referral otomatis muncul saat teman membuka tautan. Jika tidak, kode bisa dimasukkan manual.", "The referral code appears automatically when a friend opens the link. If it does not, the code can be entered manually.")}</span></div></div>
                      <div className="customer-rule"><span className="customer-rule-number">2</span><div><strong>{t("Teman membuat akun baru", "Your friend creates a new account")}</strong><span>{t("Kode hanya bisa dihubungkan sekali saat akun pertama kali dibuat.", "The code can only be linked once when the account is first created.")}</span></div></div>
                      <div className="customer-rule"><span className="customer-rule-number">3</span><div><strong>{t("Reward masuk otomatis", "Rewards are added automatically")}</strong><span>{t("Kamu dan teman masing-masing mendapat Rp10.000 setelah pesanan pertama teman minimal Rp100.000 berhasil dibayar.", "You and your friend each receive Rp10,000 after your friend's first paid order of at least Rp100,000.")}</span></div></div>
                    </div>
                  </>}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
