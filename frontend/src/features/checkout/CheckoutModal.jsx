import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, Check } from "lucide-react";
import { ShopeeIcon, TelegramIcon, TikTokIcon } from "../../components/shared/Media.jsx";
import { shimmerCSS } from "../../components/shared/Skeletons.jsx";
import { MARKETPLACE_LINKS, STORE_WHATSAPP } from "../../config/constants.js";
import { usePaymentCountdown } from "../../hooks/usePaymentCountdown.js";
import { adminDateLabel, copyTextWithFallback, formatIDR } from "../../utils/general.js";
import { clearPaymentSession, formatPaymentCountdown, loadSavedCustomer, saveCustomerData, saveOrderToLocalHistory, savePaymentSession } from "../../utils/paymentStorage.js";
import { openMidtransPayment } from "../../utils/midtrans.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { apiFetch, readJsonResponse } from "../../services/apiClient.js";
import { customerAuthorizationHeader, invalidateCustomerAccountCache, loadCustomerAccount, saveCustomerAddresses } from "../../services/customerAuth.js";
import { useModalAccessibility } from "../../hooks/useModalAccessibility.js";
import { getMeasuredHeroVariant } from "../../services/heroExperiment.js";
import { estimatedPointsEarned, maximumRedeemablePoints, normalizedRules, pointRedemptionValue } from "../../utils/loyalty.js";



// ---------- Checkout flow (dengan pilihan marketplace) ----------

function createCheckoutIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("Browser ini tidak mendukung pembuatan transaksi yang aman. Perbarui browser lalu coba lagi.");
}

function CheckoutModal({ open, onClose, cart, onConfirm, onTrackOrder, onContinueShopping, onRetryOrder, coupons, customer, featureFlags }) {
  const { locale } = useLocale();
  const [step, setStep] = useState(0);
  const saved = loadSavedCustomer();
  const [name, setName] = useState(saved.name || "");
  const [email, setEmail] = useState(saved.email || "");
  const [phone, setPhone] = useState(saved.phone || "");
  const [addressDetail, setAddressDetail] = useState(saved.address || "");
  const [channel, setChannel] = useState(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentResult, setPaymentResult] = useState(null);
  const [paidOrderId, setPaidOrderId] = useState("");
  const [pendingPaymentSession, setPendingPaymentSession] = useState(null);
  const [copiedPaymentId, setCopiedPaymentId] = useState(false);
  const [accountRewards, setAccountRewards] = useState(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [useReferralCredit, setUseReferralCredit] = useState(false);
  const checkoutIdempotencyKey = useRef("");
  const pendingPaymentCountdown = usePaymentCountdown(pendingPaymentSession?.expiresAt);

  // Shipping / Biteship states
  const [areaSearch, setAreaSearch] = useState("");
  const [areaResults, setAreaResults] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingFree, setShippingFree] = useState(false);
  const [shippingMessage, setShippingMessage] = useState("");
  const [freeShippingQuoteToken, setFreeShippingQuoteToken] = useState("");
  const areaTimeout = useRef(null);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = appliedCoupon
    ? appliedCoupon.type === "percent"
      ? Math.round(subtotal * appliedCoupon.value / 100)
      : appliedCoupon.value
    : 0;
  const loyaltyRules = normalizedRules(accountRewards?.rules);
  const availablePoints = Math.max(0, Math.floor(Number(accountRewards?.customer?.points || 0)));
  const maximumPointsForOrder = Math.min(
    maximumRedeemablePoints(subtotal, availablePoints, loyaltyRules),
    Math.floor(Math.max(0, subtotal - discount) / loyaltyRules.pointValue),
  );
  const normalizedPointsToUse = Math.min(maximumPointsForOrder, Math.max(0, Math.floor(Number(pointsToUse) || 0)));
  const loyaltyPointsToRedeem = usePoints && normalizedPointsToUse >= loyaltyRules.minimumRedemptionPoints
    ? normalizedPointsToUse
    : 0;
  const loyaltyDiscount = pointRedemptionValue(loyaltyPointsToRedeem, loyaltyRules);
  const availableReferralCredit = Math.floor(Number(accountRewards?.customer?.referralCredit || 0) / 10_000) * 10_000;
  const maximumReferralForOrder = Math.floor(Math.max(0, subtotal - discount - loyaltyDiscount) / 10_000) * 10_000;
  const referralCreditToRedeem = useReferralCredit ? Math.min(availableReferralCredit, maximumReferralForOrder) : 0;
  const rewardDiscount = loyaltyDiscount + referralCreditToRedeem;
  const pointsEstimated = estimatedPointsEarned({
    subtotal,
    couponDiscount: discount,
    pointDiscount: loyaltyDiscount,
    referralDiscount: referralCreditToRedeem,
  }, loyaltyRules);
  const shippingFee = shippingFree ? 0 : (selectedShipping?.price || 0);
  const total = Math.max(0, subtotal - discount - rewardDiscount + shippingFee);
  const addressDetailTrimmed = addressDetail.trim();
  const selectedAreaName = String(selectedArea?.name || "").trim();
  const fullAddress = selectedAreaName && addressDetailTrimmed.toLowerCase().includes(selectedAreaName.toLowerCase())
    ? addressDetailTrimmed
    : selectedAreaName
    ? `${addressDetailTrimmed}, ${selectedAreaName}`.replace(/^,\s*/, "")
    : addressDetailTrimmed;

  const whatsappConfirmationText = locale === "en"
    ? `Hello Morgen Geschäft 🌿

I have paid for my order.
Order ID: ${paidOrderId}
Name: ${name}
Phone: ${phone}
Address: ${fullAddress}
Courier: ${selectedShipping ? `${selectedShipping.courierName} ${selectedShipping.serviceName}` : "Direct delivery (free shipping)"}

Please confirm my payment. Thank you!`
    : `Halo Morgen Geschäft 🌿

Saya sudah bayar pesanan saya.
ID Pesanan: ${paidOrderId}
Nama: ${name}
No. HP: ${phone}
Alamat: ${fullAddress}
Kurir: ${selectedShipping ? `${selectedShipping.courierName} ${selectedShipping.serviceName}` : "Diantar langsung (gratis ongkir)"}

Mohon dikonfirmasi ya, terima kasih!`;

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code || couponLoading) return;

    setCouponLoading(true);
    setCouponError("");
    try {
      const response = await apiFetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal, email, phone }),
      }, { timeoutMs: 12000, expectJson: true });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.valid || !data.coupon) {
        throw new Error(data.error || "Kupon tidak dapat digunakan.");
      }
      setAppliedCoupon(data.coupon);
      setCouponInput(code);
    } catch (error) {
      setAppliedCoupon(null);
      setCouponError(error.message || "Kupon tidak dapat digunakan.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponInput(""); setCouponError(""); };

  useEffect(() => {
    if (!open || !customer) {
      setAccountRewards(null);
      return;
    }
    setEmail(customer.email || "");
    loadCustomerAccount().then((account) => {
      setAccountRewards(account);
      const savedAddress = account.customer?.addresses?.[0];
      if (savedAddress) {
        if (!name) setName(savedAddress.recipient || "");
        if (!phone) setPhone(savedAddress.phone || "");
        if (!addressDetail) setAddressDetail(savedAddress.address || "");
        if (!selectedArea && savedAddress.areaId) {
          const area = { id: savedAddress.areaId, name: savedAddress.areaName || "" };
          void selectArea(area);
        }
      }
    }).catch(() => setAccountRewards(null));
  }, [open, customer?.uid]);

  useEffect(() => {
    if (!usePoints) return;
    if (maximumPointsForOrder < loyaltyRules.minimumRedemptionPoints) {
      setUsePoints(false);
      setPointsToUse(0);
      return;
    }
    setPointsToUse((current) => Math.min(maximumPointsForOrder, Math.max(loyaltyRules.minimumRedemptionPoints, Math.floor(Number(current) || maximumPointsForOrder))));
  }, [loyaltyRules.minimumRedemptionPoints, maximumPointsForOrder, usePoints]);

  useEffect(() => {
    if (useReferralCredit && (availableReferralCredit === 0 || maximumReferralForOrder === 0)) {
      setUseReferralCredit(false);
    }
  }, [availableReferralCredit, maximumReferralForOrder, useReferralCredit]);

  // --- Biteship area search (debounced) ---
  const searchArea = (input) => {
    setAreaSearch(input);
    setSelectedArea(null);
    setShippingOptions([]);
    setSelectedShipping(null);
    setShippingFree(false);
    setShippingMessage("");
    setFreeShippingQuoteToken("");
    if (areaTimeout.current) clearTimeout(areaTimeout.current);
    if (input.trim().length < 3) { setAreaResults([]); return; }
    areaTimeout.current = setTimeout(async () => {
      setAreaLoading(true);
      try {
        const res = await apiFetch(`/api/shipping/areas?input=${encodeURIComponent(input.trim())}`);
        const data = await readJsonResponse(res);
        setAreaResults(data.areas || []);
      } catch { setAreaResults([]); }
      finally { setAreaLoading(false); }
    }, 400);
  };

  const selectArea = async (area) => {
    setSelectedArea(area);
    setAreaSearch(area.name);
    setAreaResults([]);
    setShippingLoading(true);
    setShippingOptions([]);
    setSelectedShipping(null);
    setShippingFree(false);
    try {
      const res = await apiFetch(`/api/shipping/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationAreaId: area.id,
          destinationAreaName: area.name,
          items: cart.map((c) => ({ id: c.id, qty: c.qty })),
        }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghitung ongkir.");
      if (data.freeShipping) {
        setShippingFree(true);
        setFreeShippingQuoteToken(data.quoteToken || "");
        setShippingMessage(data.message || "Gratis ongkir!");
      } else {
        const options = Array.isArray(data.pricing) ? data.pricing : [];
        setShippingOptions(options);
        if (options.length > 0) setSelectedShipping(options[0]);
      }
    } catch (error) {
      setShippingOptions([]);
      setShippingMessage(error.message || "Gagal menghitung ongkir.");
    }
    finally { setShippingLoading(false); }
  };

  const handleClose = () => {
    setStep(0); setChannel(null);
    setCouponInput(""); setAppliedCoupon(null); setCouponError(""); setPaymentError(""); setPaymentResult(null); setPendingPaymentSession(null); setCopiedPaymentId(false);
    setAreaSearch(""); setAreaResults([]); setSelectedArea(null); setShippingOptions([]); setSelectedShipping(null); setShippingFree(false); setShippingMessage(""); setFreeShippingQuoteToken("");
    setUsePoints(false); setUseReferralCredit(false); checkoutIdempotencyKey.current = "";
    onClose();
  };

  const handleConfirm = () => {
    setStep(0); setChannel(null);
    setCouponInput(""); setAppliedCoupon(null); setCouponError(""); setPaymentError(""); setPaymentResult(null); setPendingPaymentSession(null); setCopiedPaymentId(false);
    setAreaSearch(""); setAreaResults([]); setSelectedArea(null); setShippingOptions([]); setSelectedShipping(null); setShippingFree(false); setShippingMessage(""); setFreeShippingQuoteToken("");
    setUsePoints(false); setUseReferralCredit(false); checkoutIdempotencyKey.current = "";
    onConfirm();
  };

  const dialogRef = useModalAccessibility({ open, onClose: handleClose, canClose: !isPaying });

  const syncCheckoutPaymentStatus = useCallback(async (session) => {
    if (!session?.orderId) return null;
    try {
      const response = await apiFetch(`/api/orders/${encodeURIComponent(session.orderId)}/payment-expire-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session.customerAccessToken ? { "X-Customer-Access-Token": session.customerAccessToken } : {}),
        },
        body: JSON.stringify({ phone, customerAccessToken: session.customerAccessToken || "" }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) return null;

      const status = data.status || null;
      if (["expired", "failed", "cancelled"].includes(status)) {
        clearPaymentSession(session.orderId);
        setPendingPaymentSession(null);
        setPaymentResult(status === "expired" ? "expired" : "failed");
        setPaymentError(status === "expired"
          ? "Sesi pembayaran sudah kedaluwarsa. Buat pesanan baru untuk mencoba kembali."
          : "Transaksi tidak dapat dilanjutkan. Silakan buat pesanan baru."
        );
        setStep(3);
      } else if (status === "paid") {
        clearPaymentSession(session.orderId);
        setPendingPaymentSession(null);
        setPaymentResult("success");
        setPaymentError("");
        setStep(3);
      } else if (status === "pending" && data.paymentExpiresAt) {
        setPendingPaymentSession((current) => current?.orderId === session.orderId
          ? { ...current, expiresAt: data.paymentExpiresAt }
          : current
        );
      }
      return status;
    } catch {
      return null;
    }
  }, [phone]);

  useEffect(() => {
    if (!open || step !== 3 || paymentResult === "success" || !pendingPaymentSession?.orderId) return undefined;
    let cancelled = false;
    const check = async () => {
      const status = await syncCheckoutPaymentStatus(pendingPaymentSession);
      if (cancelled || !status) return;
    };
    check();
    const timer = window.setInterval(check, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, step, paymentResult, pendingPaymentSession?.orderId, syncCheckoutPaymentStatus]);

  if (!open) return null;

  const openSnapPayment = async (session) => {
    if (!session?.orderId || (!session?.token && !session?.redirectUrl)) {
      setPaymentError("Sesi pembayaran tidak tersedia.");
      setIsPaying(false);
      return;
    }

    saveOrderToLocalHistory(session.orderId, { email, phone });
    savePaymentSession(session);
    setPaidOrderId(session.orderId);
    setPendingPaymentSession(session);
    setIsPaying(true);

    try {
      await openMidtransPayment({
        token: session.token,
        redirectUrl: session.redirectUrl,
        callbacks: {
          onSuccess: () => {
            clearPaymentSession(session.orderId);
            setPendingPaymentSession(null);
            if (appliedCoupon?.singleUse) {
              try {
                const usedCoupons = JSON.parse(localStorage.getItem("mg_used_coupons") || "[]");
                if (!usedCoupons.includes(appliedCoupon.code)) {
                  usedCoupons.push(appliedCoupon.code);
                  localStorage.setItem("mg_used_coupons", JSON.stringify(usedCoupons));
                }
              } catch { /* abaikan */ }
            }
            setPaymentResult("success");
            setStep(3);
            setIsPaying(false);
          },
          onPending: () => {
            setPaymentResult("pending");
            setStep(3);
            setIsPaying(false);
          },
          onError: () => {
            setPaymentResult("pending");
            setStep(3);
            setIsPaying(false);
            window.setTimeout(async () => {
              const status = await syncCheckoutPaymentStatus(session);
              if (status !== "expired" && status !== "failed") {
                setPaymentError("Pembayaran belum berhasil. Kamu masih dapat mencoba lagi selama waktunya tersedia.");
              }
            }, 350);
          },
          onClose: () => {
            // Popup ditutup bukan berarti order hilang. Simpan sesi dan tampilkan
            // halaman menunggu pembayaran agar pembeli bisa melanjutkan lagi.
            setPaymentResult("pending");
            setStep(3);
            setIsPaying(false);
            window.setTimeout(() => syncCheckoutPaymentStatus(session), 500);
          },
        },
      });
    } catch (error) {
      setPaymentError(error?.message || "Modul pembayaran gagal dibuka.");
      setIsPaying(false);
    }
  };

  const resumeCheckoutPayment = async () => {
    setPaymentError("");
    if (!pendingPaymentSession) return;
    setIsPaying(true);

    const status = await syncCheckoutPaymentStatus(pendingPaymentSession);
    if (["paid", "expired", "failed", "cancelled"].includes(status)) {
      setIsPaying(false);
      return;
    }
    if (pendingPaymentCountdown.expired) {
      setIsPaying(false);
      await syncCheckoutPaymentStatus(pendingPaymentSession);
      setPaymentError("Waktu pembayaran sudah berakhir. Tutup halaman ini lalu buat pesanan baru.");
      return;
    }
    await openSnapPayment(pendingPaymentSession);
  };

  const payWithMidtrans = async () => {
    setPaymentError("");
    if (!name || !phone || !addressDetail || !selectedArea) {
      setPaymentError("Lengkapi nama, no. HP, area tujuan, dan alamat dulu.");
      return;
    }
    if (!shippingFree && !selectedShipping) {
      setPaymentError("Pilih jasa pengiriman dulu.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPaymentError("Format email tidak valid. Kosongkan jika tidak ingin menerima invoice.");
      return;
    }
    saveCustomerData({ name, email, phone, address: fullAddress });
    setIsPaying(true);

    // [FIX #4] Validasi stok dulu sebelum create transaction
    try {
      const stockCheck = await apiFetch(`/api/validate-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map((c) => ({ id: c.id, name: c.name, qty: c.qty })) }),
      });
      const stockResult = await readJsonResponse(stockCheck);
      if (stockCheck.ok && stockResult.valid === false) {
        const msgs = stockResult.issues.map((i) =>
          i.issue === "not_found" ? `${i.name}: produk tidak tersedia` : `${i.name}: sisa stok ${i.available}`
        );
        setPaymentError("Stok berubah: " + msgs.join(", ") + ". Sesuaikan keranjangmu.");
        setIsPaying(false);
        return;
      }
    } catch {
      // Kalau endpoint validate-stock gagal, lanjut saja — create-transaction juga validasi stok
    }

    try {
      if (!checkoutIdempotencyKey.current) {
        checkoutIdempotencyKey.current = createCheckoutIdempotencyKey();
      }
      const authHeaders = customer ? await customerAuthorizationHeader() : {};
      const res = await apiFetch(`/api/create-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          idempotencyKey: checkoutIdempotencyKey.current,
          locale,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          address: fullAddress,
          items: cart.map((c) => ({
            id: c.id,
            name: c.name,
            nameId: c._raw?.name || c.name,
            nameEn: c._raw?.nameEn || (locale === "en" ? c.name : ""),
            price: c.price,
            qty: c.qty,
          })),
          couponCode: appliedCoupon?.code || "",
          loyaltyPointsToRedeem: featureFlags?.loyalty === false ? 0 : loyaltyPointsToRedeem,
          referralCreditToRedeem: featureFlags?.referral === false ? 0 : referralCreditToRedeem,
          heroVariant: featureFlags?.heroExperiment === false ? "" : getMeasuredHeroVariant(),
          shippingQuoteToken: shippingFree ? freeShippingQuoteToken : (selectedShipping?.quoteToken || ""),
          destinationAreaId: selectedArea?.id || "",
          destinationAreaName: selectedArea?.name || "",
        }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat transaksi.");
      invalidateCustomerAccountCache();

      const session = {
        orderId: data.orderId,
        token: data.token,
        redirectUrl: data.redirect_url || "",
        expiresAt: data.paymentExpiresAt || "",
        cancelToken: data.cancelToken || "",
        customerAccessToken: data.customerAccessToken || "",
      };
      if (customer) {
        const existing = accountRewards?.customer?.addresses || [];
        const nextAddress = {
          label: "Alamat utama",
          recipient: name,
          phone,
          address: addressDetailTrimmed,
          areaId: selectedArea?.id || "",
          areaName: selectedArea?.name || "",
        };
        const deduplicated = [nextAddress, ...existing.filter((item) => item.address !== nextAddress.address || item.areaId !== nextAddress.areaId)].slice(0, 5);
        void saveCustomerAddresses(deduplicated).catch(() => {});
      }
      checkoutIdempotencyKey.current = "";
      await openSnapPayment(session);
    } catch (err) {
      if (!String(err.message || "").includes("sedang dibuat")) checkoutIdempotencyKey.current = "";
      setPaymentError(err.message || "Terjadi kesalahan, coba lagi.");
      setIsPaying(false);
    }
  };

  const CARD_ICON = (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="8" fill="#1F2E22"/><rect x="9" y="13" width="22" height="15" rx="2" stroke="white" strokeWidth="1.8"/><path d="M9 18h22" stroke="white" strokeWidth="1.8"/><rect x="12" y="22" width="6" height="2.5" rx="0.5" fill="white"/></svg>
  );

  const copyPaymentOrderId = async () => {
    if (!paidOrderId) return;
    const success = await copyTextWithFallback(paidOrderId);
    if (!success) {
      setPaymentError("ID pesanan tidak dapat disalin otomatis. Silakan blok dan salin secara manual.");
      return;
    }
    setCopiedPaymentId(true);
    window.setTimeout(() => setCopiedPaymentId(false), 1800);
  };

  const CHANNELS = [
    {
      id: "midtrans",
      icon: CARD_ICON,
      label: "Bayar di Website",
      desc: "Transfer bank, e-wallet, QRIS, kartu kredit",
      action: () => setStep(1),
    },
    {
      id: "shopee",
      icon: <ShopeeIcon size={28} />,
      label: "Shopee",
      desc: "Cari ulang produk di Shopee · gratis ongkir & COD",
      action: () => { if (window.confirm("Kamu akan dialihkan ke Shopee.\nKeranjang dari website tidak terbawa — kamu perlu cari dan tambah produk lagi di Shopee.\n\nLanjutkan?")) { window.open(MARKETPLACE_LINKS.shopee, "_blank"); } },
    },
    {
      id: "tiktok",
      icon: <TikTokIcon size={28} />,
      label: "TikTok Shop",
      desc: "Cari ulang produk di TikTok · live & video review",
      action: () => { if (window.confirm("Kamu akan dialihkan ke TikTok Shop.\nKeranjang dari website tidak terbawa — kamu perlu cari produk lagi di TikTok.\n\nLanjutkan?")) { window.open(MARKETPLACE_LINKS.tiktok, "_blank"); } },
    },
    {
      id: "telegram",
      icon: <TelegramIcon size={28} />,
      label: "Bot Telegram",
      desc: "Pesan via bot Telegram kami",
      action: () => { const itemList = cart.map((c) => `${c.name} x${c.qty}`).join("\n"); window.open(`https://t.me/MorgenGeschaftBot?start=${encodeURIComponent(itemList)}`, "_blank"); },
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22,43,69,0.48)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        zIndex: 60,
      }}
      className="checkout-backdrop flex items-center justify-center p-4"
      role="presentation"
    >
      <style>{`
        .checkout-shell {
          scrollbar-width: thin;
          scrollbar-color: #C9C2AD transparent;
        }
        .checkout-shell::-webkit-scrollbar { width: 7px; }
        .checkout-shell::-webkit-scrollbar-thumb { background: #C9C2AD; border-radius: 999px; }
        .checkout-shell input,
        .checkout-shell textarea,
        .checkout-shell select {
          border-radius: 10px;
        }
        .checkout-shell button {
          border-radius: 9px;
        }
        .checkout-shell .checkout-card {
          border-radius: 12px;
        }
        .checkout-shell .checkout-choice {
          border-radius: 12px;
        }
        .checkout-shell .checkout-dropdown {
          border-radius: 10px;
          overflow: hidden;
        }
        @media (max-width: 520px) {
          .checkout-shell {
            width: min(94vw, 500px) !important;
            padding: 22px !important;
            border-radius: 14px !important;
          }
        }
      `}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-dialog-title"
        tabIndex={-1}
        className="checkout-shell"
        style={{
          background: "#F6F1E7",
          width: "min(500px, 94vw)",
          padding: "28px",
          border: "1px solid #E3DCC9",
          borderRadius: "16px",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 28px 80px rgba(22,43,69,.20)",
        }}
      >

        {/* Step 0: Pilih channel */}
        {step === 0 && (
          <>
            <h2 id="checkout-dialog-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "19px", color: "#162B45", marginBottom: "4px" }}>
              Mau beli lewat mana?
            </h2>

            {/* Coupon input */}
            <div className="checkout-card" style={{ background: "#fff", border: "1px solid #E3DCC9", padding: "14px 16px", marginBottom: "16px", marginTop: "12px", boxShadow: "0 8px 22px rgba(22,43,69,.035)" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4C6354", letterSpacing: "0.06em", marginBottom: "8px" }}>KODE PROMO</p>
              {appliedCoupon ? (
                <div className="checkout-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#DCE6D6", padding: "9px 11px" }}>
                  <div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", fontWeight: 600, color: "#1F2E22" }}>{appliedCoupon.code}</p>
                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#4C6354" }}>{appliedCoupon.desc} · hemat {formatIDR(discount)}</p>
                  </div>
                  <button onClick={removeCoupon} style={{ background: "none", border: "none", cursor: "pointer", color: "#4C6354" }}><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      aria-label="Kode kupon"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                      placeholder="Masukkan kode kupon"
                      style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", border: "1px solid #E3DCC9", borderRadius: "10px", padding: "9px 11px", outline: "none", background: "#F6F1E7", letterSpacing: "0.05em" }}
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      style={{ background: "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, padding: "0 15px", border: "none", borderRadius: "9px", cursor: couponLoading ? "wait" : "pointer", opacity: couponLoading || !couponInput.trim() ? .62 : 1 }}
                    >
                      {couponLoading ? "Memeriksa..." : "Pakai"}
                    </button>
                  </div>
                  {couponError && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E", marginTop: "5px" }}>{couponError}</p>}
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #E3DCC9" }}>
                <span>Total bayar</span>
                <span style={{ fontWeight: 700, color: "#162B45", fontSize: "15px" }}>{formatIDR(total)}</span>
              </div>
              {appliedCoupon && (
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#4C6354", marginTop: "3px" }}>
                  <span>Subtotal: {formatIDR(subtotal)}</span>
                  <span>Hemat: −{formatIDR(discount)}</span>
                </div>
              )}
              {customer && accountRewards && (featureFlags?.loyalty !== false || featureFlags?.referral !== false) && (
                <div style={{ borderTop: "1px solid #E3DCC9", marginTop: 10, paddingTop: 10, display: "grid", gap: 10 }}>
                  {featureFlags?.loyalty !== false && <div style={{ border: "1px solid #E7DDC9", borderRadius: 12, background: "#FFFCF6", padding: "10px 11px" }}>
                    <label style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 12, color: "#162B45", cursor: maximumPointsForOrder >= loyaltyRules.minimumRedemptionPoints ? "pointer" : "default" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}><input type="checkbox" checked={usePoints} disabled={maximumPointsForOrder < loyaltyRules.minimumRedemptionPoints} onChange={(event) => { const checked = event.target.checked; setUsePoints(checked); setPointsToUse(checked ? maximumPointsForOrder : 0); }} /> {locale === "en" ? "Use points" : "Gunakan poin"}</span>
                      <strong>{usePoints ? `−${formatIDR(loyaltyDiscount)}` : `${availablePoints.toLocaleString(locale === "en" ? "en-US" : "id-ID")} ${locale === "en" ? "points" : "poin"}`}</strong>
                    </label>
                    {usePoints && <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, alignItems: "center", marginTop: 9 }}>
                      <input type="number" min={loyaltyRules.minimumRedemptionPoints} max={maximumPointsForOrder} step="1" value={pointsToUse} onChange={(event) => setPointsToUse(event.target.value)} aria-label={locale === "en" ? "Points to use" : "Poin yang digunakan"} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD3C0", borderRadius: 9, padding: "8px 9px", color: "#162B45", background: "#fff" }} />
                      <button type="button" onClick={() => setPointsToUse(maximumPointsForOrder)} style={{ border: 0, background: "transparent", color: "#A86200", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 4 }}>{locale === "en" ? "Use max" : "Pakai maks."}</button>
                    </div>}
                    <small style={{ display: "block", color: "#80786B", lineHeight: 1.45, marginTop: 7 }}>{maximumPointsForOrder >= loyaltyRules.minimumRedemptionPoints
                      ? (locale === "en" ? `Minimum ${loyaltyRules.minimumRedemptionPoints} points. Maximum ${maximumPointsForOrder} points for this order.` : `Minimal ${loyaltyRules.minimumRedemptionPoints} poin. Maksimal ${maximumPointsForOrder} poin untuk pesanan ini.`)
                      : (locale === "en" ? `At least ${loyaltyRules.minimumRedemptionPoints} points are required.` : `Minimal ${loyaltyRules.minimumRedemptionPoints} poin diperlukan.`)}</small>
                  </div>}
                  {featureFlags?.referral !== false && <label style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#162B45" }}>
                    <span><input type="checkbox" checked={useReferralCredit} disabled={availableReferralCredit === 0 || maximumReferralForOrder === 0} onChange={(event) => setUseReferralCredit(event.target.checked)} /> {locale === "en" ? "Use referral balance" : "Gunakan saldo referral"}</span>
                    <span>{referralCreditToRedeem > 0 ? `−${formatIDR(referralCreditToRedeem)}` : formatIDR(availableReferralCredit)}</span>
                  </label>}
                  {featureFlags?.referral !== false && accountRewards.customer.referredByCode && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", borderRadius: 9, background: "#FFF7E8", color: "#7B5A20", fontSize: 12 }}>
                      <Check size={14} /> Kode referral {accountRewards.customer.referredByCode} sudah diterapkan pada akun
                    </div>
                  )}
                  {featureFlags?.loyalty !== false && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "#6D665B", fontSize: 11 }}>
                    <span>{locale === "en" ? "Estimated after payment" : "Perkiraan setelah pembayaran"}</span>
                    <strong style={{ color: "#4C6354" }}>+{pointsEstimated} {locale === "en" ? "points" : "poin"}</strong>
                  </div>}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  className="checkout-choice"
                  onClick={() => { setChannel(ch.id); ch.action(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px",
                    background: "#fff",
                    border: "1px solid #E3DCC9",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#1F2E22";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 10px 24px rgba(22,43,69,.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E3DCC9";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ flexShrink: 0 }}>{ch.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "14px", color: "#162B45" }}>{ch.label}</p>
                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558" }}>{ch.desc}</p>
                  </div>
                  <ChevronRight size={16} color="#A39E8E" />
                </button>
              ))}
            </div>
            <button onClick={handleClose} style={{ fontFamily: "'Work Sans', sans-serif", color: "#6B6558", fontSize: "12px", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center", marginTop: "14px" }}>
              Batal
            </button>
          </>
        )}

        {/* Step 1: Data pengiriman & kontak + ongkir */}
        {step === 1 && (() => {
          const phoneClean = phone.replace(/[^0-9+]/g, "");
          const phoneValid = /^(\+62|62|08)\d{8,12}$/.test(phoneClean);
          const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
          const nameValid = name.trim().length >= 2;
          const addressDetailValid = addressDetail.trim().length >= 10;
          const shippingReady = shippingFree || selectedShipping;
          const canProceed = nameValid && phoneValid && emailValid && selectedArea && addressDetailValid && shippingReady;

          return (
          <>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "19px", color: "#162B45" }} className="mb-4">Data pengiriman</h2>
            <input aria-label="Nama penerima" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama penerima" style={{ fontFamily: "'Work Sans', sans-serif", border: `1px solid ${name && !nameValid ? "#C97B5E" : "#E3DCC9"}`, borderRadius: "10px", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-1 outline-none" />
            {name && !nameValid && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E", marginBottom: "4px" }}>Nama minimal 2 karakter.</p>}

            <input aria-label="Nomor HP atau WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\-\s]/g, ""))} placeholder="No. HP/WhatsApp (mis. 08123456789)" type="tel" style={{ fontFamily: "'Work Sans', sans-serif", border: `1px solid ${phone && !phoneValid ? "#C97B5E" : "#E3DCC9"}`, borderRadius: "10px", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-1 outline-none" />
            {phone && !phoneValid && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E", marginBottom: "4px" }}>Format: 08xxxxxxxxxx (10-15 digit).</p>}

            <input aria-label="Email (opsional, untuk struk)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opsional, untuk struk)" type="email" disabled={Boolean(customer)} style={{ fontFamily: "'Work Sans', sans-serif", border: `1px solid ${email && !emailValid ? "#C97B5E" : "#E3DCC9"}`, borderRadius: "10px", background: customer ? "#F3F0E8" : "#fff" }} className="w-full px-3 py-2 text-sm mb-1 outline-none disabled:cursor-not-allowed" />
            {email && !emailValid && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E", marginBottom: "4px" }}>Format email tidak valid.</p>}

            {/* Area search dropdown (Biteship Maps) */}
            <div style={{ position: "relative", marginBottom: "4px" }}>
              <input
                aria-label="Cari kecamatan atau kota tujuan"
                value={areaSearch}
                onChange={(e) => searchArea(e.target.value)}
                placeholder="Ketik kecamatan / kota tujuan (mis. Ungaran, Semarang)"
                style={{ fontFamily: "'Work Sans', sans-serif", border: `1px solid ${areaSearch && !selectedArea ? "#C97B5E" : "#E3DCC9"}`, borderRadius: "10px", background: "#fff" }}
                className="w-full px-3 py-2 text-sm outline-none"
              />
              {areaLoading && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558", padding: "4px 0" }}>Mencari area...</p>}
              {areaResults.length > 0 && !selectedArea && (
                <div className="checkout-dropdown" style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 50, background: "#fff", border: "1px solid #E3DCC9", maxHeight: "180px", overflowY: "auto", boxShadow: "0 12px 28px rgba(22,43,69,.12)" }}>
                  {areaResults.map((a) => (
                    <button key={a.id} onClick={() => selectArea(a)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#162B45", border: "none", background: "none", cursor: "pointer", borderBottom: "1px solid #F0EBE0" }}
                      onMouseEnter={(e) => (e.target.style.background = "#F6F1E7")}
                      onMouseLeave={(e) => (e.target.style.background = "none")}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedArea && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#4C6354", marginBottom: "4px" }}>✓ {selectedArea.name}</p>}

            {/* Detail alamat jalan */}
            <textarea aria-label="Alamat lengkap" value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="Alamat lengkap (jalan, no. rumah, RT/RW, patokan)" style={{ fontFamily: "'Work Sans', sans-serif", border: `1px solid ${addressDetail && !addressDetailValid ? "#C97B5E" : "#E3DCC9"}`, borderRadius: "10px", background: "#fff", resize: "vertical" }} className="w-full px-3 py-2 text-sm mb-1 outline-none" rows={2} />
            {addressDetail && !addressDetailValid && <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E", marginBottom: "4px" }}>Alamat terlalu pendek — pastikan sudah lengkap.</p>}

            {/* Shipping loading — skeleton cards */}
            {shippingLoading && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", marginBottom: "8px" }}>
                  ⏳ Menghitung ongkir dari Biteship...
                </p>
                <style>{shimmerCSS}</style>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", marginBottom: "6px", border: "1px solid #E3DCC9", borderRadius: "10px", background: "#fff" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ width: `${100 + i * 20}px`, height: "14px", borderRadius: "4px", background: "linear-gradient(90deg, #E8E3D5 25%, #F0EBE0 50%, #E8E3D5 75%)", backgroundSize: "200% 100%", animation: "mgShimmer 1.5s ease-in-out infinite", marginBottom: "6px" }} />
                      <div style={{ width: "80px", height: "10px", borderRadius: "4px", background: "linear-gradient(90deg, #E8E3D5 25%, #F0EBE0 50%, #E8E3D5 75%)", backgroundSize: "200% 100%", animation: "mgShimmer 1.5s ease-in-out infinite" }} />
                    </div>
                    <div style={{ width: "70px", height: "14px", borderRadius: "4px", background: "linear-gradient(90deg, #E8E3D5 25%, #F0EBE0 50%, #E8E3D5 75%)", backgroundSize: "200% 100%", animation: "mgShimmer 1.5s ease-in-out infinite" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Free ongkir badge */}
            {shippingFree && (
              <div className="checkout-card" style={{ background: "#DCE6D6", border: "1px solid #C8D8C2", padding: "11px 14px", marginBottom: "12px" }}>
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#1F2E22", fontWeight: 600 }}>🎉 {shippingMessage}</p>
              </div>
            )}

            {/* Courier selection */}
            {!shippingFree && shippingOptions.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", marginBottom: "6px" }}>Pilih jasa pengiriman:</p>
                {shippingOptions.map((opt) => {
                  const isSelected = selectedShipping?.serviceCode === opt.serviceCode && selectedShipping?.company === opt.company;
                  return (
                    <button key={`${opt.company}-${opt.serviceCode}`} className="checkout-choice" onClick={() => setSelectedShipping(opt)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 12px", marginBottom: "6px", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", border: isSelected ? "2px solid #1F2E22" : "1px solid #E3DCC9", borderRadius: "10px", background: isSelected ? "#F6F1E7" : "#fff", cursor: "pointer", textAlign: "left" }}>
                      <div>
                        <span style={{ fontWeight: 600, color: "#162B45" }}>{opt.courierName}</span>
                        <span style={{ color: "#6B6558" }}> — {opt.serviceName}</span>
                        <p style={{ fontSize: "11px", color: "#A39E8E", margin: "2px 0 0" }}>{opt.duration}</p>
                      </div>
                      <span style={{ fontWeight: 700, color: "#1F2E22", whiteSpace: "nowrap", marginLeft: "12px" }}>{formatIDR(opt.price)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* No courier available — with retry */}
            {!shippingFree && selectedArea && !shippingLoading && shippingOptions.length === 0 && (
              <div style={{ background: "#FFF8F0", border: "1px solid #F0E0D0", padding: "12px 14px", borderRadius: "10px", marginBottom: "12px" }}>
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#C97B5E", marginBottom: "8px" }}>
                  Tidak ada kurir tersedia untuk area ini, atau terjadi gangguan koneksi.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => selectArea(selectedArea)}
                    style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, background: "#1F2E22", color: "#F6F1E7", border: "none", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
                  >
                    Coba lagi
                  </button>
                  <button
                    onClick={() => { setSelectedArea(null); setAreaSearch(""); }}
                    style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", background: "none", border: "1px solid #E3DCC9", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
                  >
                    Ganti area
                  </button>
                </div>
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!canProceed} style={{ background: canProceed ? "#1F2E22" : "#C9C2AD", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, borderRadius: "9px", cursor: canProceed ? "pointer" : "not-allowed", boxShadow: canProceed ? "0 10px 22px rgba(31,46,34,.14)" : "none" }} className="w-full py-2.5 text-sm">Lanjut ke pembayaran</button>
            <button onClick={() => setStep(0)} style={{ fontFamily: "'Work Sans', sans-serif", color: "#6B6558", fontSize: "12px", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center", marginTop: "10px" }}>Kembali</button>
          </>
          );
        })()}

        {/* Step 2: Konfirmasi & bayar */}
        {step === 2 && (
          <>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "19px", color: "#162B45" }} className="mb-3">Konfirmasi pesanan</h2>
            <div className="checkout-card" style={{ background: "#fff", border: "1px solid #E3DCC9", padding: "14px 16px", marginBottom: "16px", boxShadow: "0 8px 22px rgba(22,43,69,.035)" }}>
              {cart.map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#162B45", padding: "4px 0" }}>
                  <span>{i.name} ×{i.qty}</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(i.price * i.qty)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #E3DCC9", marginTop: "8px", paddingTop: "8px" }}>
                {(appliedCoupon || shippingFee > 0 || shippingFree) && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", padding: "3px 0" }}>
                    <span>Subtotal</span><span>{formatIDR(subtotal)}</span>
                  </div>
                )}
                {appliedCoupon && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#C97B5E", padding: "3px 0" }}>
                    <span>Diskon ({appliedCoupon.code})</span><span>−{formatIDR(discount)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans',sans-serif", fontSize: 13, color: "#4C6354", padding: "3px 0" }}>
                    <span>{locale === "en" ? `Points (${loyaltyPointsToRedeem})` : `Poin (${loyaltyPointsToRedeem})`}</span><span>−{formatIDR(loyaltyDiscount)}</span>
                  </div>
                )}
                {referralCreditToRedeem > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans',sans-serif", fontSize: 13, color: "#4C6354", padding: "3px 0" }}>
                    <span>{locale === "en" ? "Referral balance" : "Saldo referral"}</span><span>−{formatIDR(referralCreditToRedeem)}</span>
                  </div>
                )}
                {shippingFee > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558", padding: "3px 0" }}>
                    <span>Ongkir ({selectedShipping?.courierName} {selectedShipping?.serviceName})</span><span>{formatIDR(shippingFee)}</span>
                  </div>
                )}
                {shippingFree && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#4C6354", padding: "3px 0" }}>
                    <span>Ongkir</span><span style={{ fontWeight: 600 }}>GRATIS</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "14px", paddingTop: "6px", borderTop: "1px solid #E3DCC9", marginTop: "4px" }}>
                  <span>Total</span><span>{formatIDR(total)}</span>
                </div>
              </div>
              {/* Alamat tujuan */}
              <div style={{ borderTop: "1px solid #F0EBE0", marginTop: "8px", paddingTop: "8px" }}>
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558" }}>📍 {fullAddress}</p>
              </div>
            </div>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", color: "#6B6558" }} className="mb-3">
              Pembayaran diproses langsung di website (Midtrans) — bisa transfer bank, e-wallet, QRIS, atau kartu kredit.
            </p>
            {paymentError && (
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#C97B5E" }} className="mb-3">{paymentError}</p>
            )}
            <button
              onClick={payWithMidtrans}
              disabled={isPaying}
              style={{ background: isPaying ? "#C9C2AD" : "#C97B5E", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, borderRadius: "9px", cursor: isPaying ? "not-allowed" : "pointer", boxShadow: isPaying ? "none" : "0 10px 22px rgba(201,123,94,.18)" }}
              className="w-full py-2.5 text-sm"
            >
              {isPaying ? "Menyiapkan pembayaran..." : "Bayar Sekarang"}
            </button>
            <button onClick={() => setStep(1)} style={{ fontFamily: "'Work Sans', sans-serif", color: "#6B6558", fontSize: "12px", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center", marginTop: "10px" }}>Kembali</button>
          </>
        )}

        {/* Step 3: Status pembayaran */}
        {step === 3 && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div
              style={{
                background: paymentResult === "success"
                  ? "#DCE6D6"
                  : paymentResult === "expired" || paymentResult === "failed"
                  ? "#F3E6E1"
                  : "#FFF1E2",
                borderRadius: "50%",
                width: 50,
                height: 50,
              }}
              className="flex items-center justify-center"
            >
              {paymentResult === "success"
                ? <Check size={23} color="#1F2E22" />
                : paymentResult === "expired" || paymentResult === "failed"
                ? <X size={23} color="#C97B5E" />
                : <span style={{ fontSize: "21px" }}>⏳</span>}
            </div>

            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#F59A1A", letterSpacing: ".12em", marginBottom: "6px" }}>
                STATUS PESANAN
              </p>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", color: "#162B45", margin: 0 }}>
                {channel === "midtrans"
                  ? (paymentResult === "success"
                      ? "Pembayaran berhasil"
                      : paymentResult === "expired" || pendingPaymentCountdown.expired
                      ? "Waktu pembayaran habis"
                      : paymentResult === "failed"
                      ? "Pembayaran gagal"
                      : "Menunggu pembayaran")
                  : "Diarahkan ke toko"}
              </h2>
            </div>

            {paidOrderId && (
              <div className="checkout-card" style={{ width: "100%", background: "#F8F4EC", border: "1px solid #E3DCC9", borderRadius: "12px", padding: "13px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#8B8578" }}>ID pesanan</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#1F2E22" }}>{paidOrderId}</strong>
                    <button
                      type="button"
                      onClick={copyPaymentOrderId}
                      style={{
                        minWidth: copiedPaymentId ? "84px" : "28px",
                        height: "28px",
                        padding: copiedPaymentId ? "0 8px" : 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                        border: "1px solid #D8D0C0",
                        background: copiedPaymentId ? "#EEF2EA" : "#fff",
                        borderRadius: "8px",
                        cursor: "pointer",
                        color: "#4C6354",
                        fontFamily: "'Work Sans', sans-serif",
                        fontSize: "9px",
                        fontWeight: 600,
                        transition: "min-width .18s ease, background .18s ease",
                      }}
                      title={copiedPaymentId ? "ID tersalin" : "Salin ID"}
                      aria-label={copiedPaymentId ? "ID pesanan tersalin" : "Salin ID pesanan"}
                    >
                      {copiedPaymentId ? (
                        <><Check size={12} /> Tersalin</>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4C6354" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                {channel === "midtrans" && (
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #E8E1D5" }}>
                    <div style={{ textAlign: "left" }}>
                      <span style={{ display: "block", fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#8B8578", marginBottom: "3px" }}>Total pembayaran</span>
                      <strong style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", color: "#162B45" }}>{formatIDR(total)}</strong>
                    </div>
                    {!["success", "expired", "failed"].includes(paymentResult) && pendingPaymentCountdown.hasExpiry && (
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "block", fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#8B8578", marginBottom: "3px" }}>Waktu tersisa</span>
                        <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", color: "#C97B5E" }}>
                          {formatPaymentCountdown(pendingPaymentCountdown.remainingMs)}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", lineHeight: 1.65, maxWidth: "410px", margin: "2px 0" }}>
              {channel === "midtrans"
                ? (paymentResult === "success"
                    ? "Pembayaran telah diterima. Pesananmu akan segera diproses dan invoice dikirim ke email yang kamu masukkan."
                    : paymentResult === "expired" || pendingPaymentCountdown.expired
                    ? "Sesi pembayaran telah berakhir. Produk belum dibayar dan kamu perlu membuat pesanan baru."
                    : paymentResult === "failed"
                    ? "Transaksi tidak dapat dilanjutkan. Kamu dapat mencoba membuat pesanan baru."
                    : "Pembayaran belum selesai. Popup boleh ditutup dan sesi pembayaran dapat dibuka kembali sebelum waktunya habis.")
                : "Selesaikan pembelian di tab toko yang baru terbuka."}
            </p>

            {channel === "midtrans" && !["success", "expired", "failed"].includes(paymentResult) && pendingPaymentSession && !pendingPaymentCountdown.expired && (
              <div className="checkout-card" style={{ width: "100%", background: "#FFF8F0", border: "1px solid #F0D9C6", padding: "14px", borderRadius: "12px" }}>
                {pendingPaymentCountdown.hasExpiry && (
                  <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#8A5B35", marginBottom: "9px" }}>
                    Selesaikan sebelum {adminDateLabel(pendingPaymentSession.expiresAt)}
                  </p>
                )}
                <button
                  onClick={resumeCheckoutPayment}
                  disabled={isPaying}
                  style={{ width: "100%", background: isPaying ? "#C9C2AD" : "#1F2E22", color: "#F6F1E7", border: "none", borderRadius: "9px", padding: "11px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 700, cursor: isPaying ? "not-allowed" : "pointer" }}
                >
                  {isPaying ? "Membuka pembayaran..." : "Lanjutkan pembayaran"}
                </button>
              </div>
            )}

            {paymentError && channel === "midtrans" && paymentResult !== "success" && (
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#C97B5E", lineHeight: 1.55 }}>{paymentError}</p>
            )}

            {email && channel === "midtrans" && paymentResult === "success" && (
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#4C6354" }}>Konfirmasi dan invoice dikirim ke {email}</p>
            )}

            {channel === "midtrans" && paymentResult === "success" && (
              <a
                href={`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(whatsappConfirmationText)}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px", width: "100%", background: "#F2F7F0", color: "#2F6E49", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "12px", padding: "10px 14px", border: "1px solid #BED8C5", borderRadius: "9px", cursor: "pointer", textDecoration: "none" }}
              >
                Konfirmasi melalui WhatsApp
              </a>
            )}

            <div style={{ width: "100%", display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
              {channel === "midtrans" && (paymentResult === "expired" || paymentResult === "failed" || pendingPaymentCountdown.expired) ? (
                <>
                  <button
                    onClick={() => {
                      handleClose();
                      if (typeof onRetryOrder === "function") window.setTimeout(onRetryOrder, 40);
                    }}
                    style={{ flex: "1 1 180px", background: "#1F2E22", color: "#F6F1E7", border: "none", borderRadius: "9px", padding: "10px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Buat pesanan ulang
                  </button>
                  <button
                    onClick={() => {
                      handleClose();
                      if (typeof onContinueShopping === "function") window.setTimeout(onContinueShopping, 40);
                    }}
                    style={{ flex: "1 1 150px", background: "#fff", color: "#4C6354", border: "1px solid #D8D0C0", borderRadius: "9px", padding: "10px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Kembali ke katalog
                  </button>
                </>
              ) : (
                <>
                  {paidOrderId && (
                    <button
                      onClick={() => {
                        const trackedId = paidOrderId;
                        handleConfirm();
                        if (typeof onTrackOrder === "function") window.setTimeout(() => onTrackOrder(trackedId), 60);
                      }}
                      style={{ flex: "1 1 170px", background: "#fff", color: "#1F2E22", border: "1px solid #BFC8BC", borderRadius: "9px", padding: "10px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Lihat status pesanan
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleConfirm();
                      if (typeof onContinueShopping === "function") window.setTimeout(onContinueShopping, 40);
                    }}
                    style={{ flex: "1 1 140px", background: "#F8F4EC", color: "#6B6558", border: "1px solid #D8D0C0", borderRadius: "9px", padding: "10px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Lanjut belanja
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { CheckoutModal };
