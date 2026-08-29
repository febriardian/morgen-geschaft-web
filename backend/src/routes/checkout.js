// routes/checkout.js
// Endpoint: create-transaction, midtrans-notification (webhook), validate-stock

import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { hashCustomerCancelToken } from "../utils/index.js";
import { rateLimit, webhookRateLimit } from "../middleware/rateLimiter.js";
import { cancelMidtransTransaction, createSnapTransaction } from "../services/midtrans.js";
import { handleOrderBecamePaid, restoreReservedStock, releaseCouponClaim } from "../services/orders.js";
import { log } from "../services/logger.js";
import { shippingItemsFingerprint, verifyShippingQuoteToken } from "../services/shippingQuote.js";
import { calculateCouponDiscount, calculateOrderTotal, normalizeRequestedItems } from "../services/pricing.js";
import { paymentAmountMatches, resolveOrderStatusTransition, verifyMidtransSignature } from "../utils/security.js";
import { parseCidr, ipMatchesCidrs } from "../utils/webhookIp.js";
import { notifyOrderCreated, notifyAdminNewOrder } from "../services/whatsapp.js";
import { trackFunnelEvent } from "../services/funnelAnalytics.js";
import { optionalCustomerUser } from "../middleware/auth.js";
import {
  ensureCustomerProfile,
  loyaltyRedemptionValue,
  maximumRedeemablePoints,
  releaseLoyaltyReservation,
  reserveRewardTransactions,
} from "../services/loyalty.js";
import {
  deriveCheckoutToken,
  generateSecureOrderId,
  hashOpaqueToken,
  isValidIdempotencyKey,
} from "../utils/customerSecurity.js";
import {
  buildCurrentFlashSalesQuery,
  getProductFlashSalePrice,
  resolveActiveFlashSale,
} from "../services/flashSales.js";
import { getFeatureFlags } from "../services/featureFlags.js";

const router = Router();

const rawPaymentExpiry = Number.parseInt(process.env.PAYMENT_EXPIRY_MINUTES || "15", 10);
const PAYMENT_EXPIRY_MINUTES = Math.min(7 * 24 * 60, Math.max(5, Number.isFinite(rawPaymentExpiry) ? rawPaymentExpiry : 15));

// FIX #4: Optional Midtrans webhook IP whitelist
// Set MIDTRANS_WEBHOOK_IPS di .env untuk enforce (comma-separated).
// Support: individual IP (103.208.23.1) atau CIDR (103.208.23.0/24)
// Jika tidak diset, hanya log IP tanpa blocking.
const WEBHOOK_ALLOWED_IPS = (process.env.MIDTRANS_WEBHOOK_IPS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const PARSED_WEBHOOK_CIDRS = WEBHOOK_ALLOWED_IPS.map(parseCidr).filter(Boolean);

function isWebhookIpAllowed(ip) {
  if (PARSED_WEBHOOK_CIDRS.length === 0) return true; // no whitelist configured
  return ipMatchesCidrs(ip, PARSED_WEBHOOK_CIDRS);
}

async function cleanupFailedCheckout(context, reason = "checkout_error") {
  if (!context?.db || !Array.isArray(context.verifiedItems)) return "not-needed";

  let safeToRelease = context.midtransAttempted !== true;
  if (context.midtransAttempted) {
    try {
      const cancellation = await cancelMidtransTransaction(context.orderId);
      safeToRelease = cancellation.ok === true;
    } catch (error) {
      log("error", "checkout", "Tidak dapat memastikan pembatalan Midtrans", {
        orderId: context.orderId,
        error: error.message,
      });
      safeToRelease = false;
    }
  }

  if (!safeToRelease) {
    if (context.orderCreated) {
      await context.db.collection("orders").doc(context.orderId).update({
        paymentSessionStatus: "uncertain",
        failReason: "midtrans_state_uncertain",
        updatedAt: new Date().toISOString(),
      }).catch((error) => log("error", "checkout", "Gagal menandai status transaksi tidak pasti", {
        orderId: context.orderId,
        error: error.message,
      }));
    }
    return "uncertain";
  }

  await restoreReservedStock(context.db, context.verifiedItems);
  if (context.claimRef) {
    await context.claimRef.delete().catch((error) => log("warn", "checkout", "Gagal membersihkan claim kupon", {
      orderId: context.orderId,
      error: error.message,
    }));
  }
  if (context.orderCreated) {
    await context.db.collection("orders").doc(context.orderId).update({
      status: "failed",
      paymentSessionStatus: "failed",
      failReason: reason,
      stockReserved: false,
      updatedAt: new Date().toISOString(),
    }).catch((error) => log("error", "checkout", "Gagal memperbarui order yang gagal", {
      orderId: context.orderId,
      error: error.message,
    }));
    const failedOrder = await context.db.collection("orders").doc(context.orderId).get();
    if (failedOrder.exists) await releaseLoyaltyReservation(context.db, failedOrder.data());
  }
  if (context.checkoutRequestRef) {
    await context.checkoutRequestRef.set({ status: "failed", updatedAt: new Date().toISOString() }, { merge: true });
  }
  return "released";
}

// POST /api/create-transaction
router.post("/api/create-transaction", rateLimit, async (req, res) => {
  let cleanupContext = null;
  try {
    const {
      idempotencyKey, locale, customerName, customerEmail, customerPhone, address, items,
      couponCode, shippingQuoteToken, destinationAreaId, heroVariant,
      loyaltyPointsToRedeem, referralCreditToRedeem,
    } = req.body;
    const featureFlags = await getFeatureFlags();
    if (!featureFlags.loyalty && Number(loyaltyPointsToRedeem || 0) > 0) {
      return res.status(409).json({ error: "Penukaran poin sedang dinonaktifkan." });
    }
    if (!featureFlags.referral && Number(referralCreditToRedeem || 0) > 0) {
      return res.status(409).json({ error: "Program referral sedang dinonaktifkan." });
    }
    const orderLocale = locale === "en" ? "en" : "id";
    const normalizedPhone = String(customerPhone || "").replace(/\D/g, "");
    const normalizedEmail = String(customerEmail || "").trim().toLowerCase();
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return res.status(400).json({ error: "Kunci checkout tidak valid. Muat ulang halaman lalu coba lagi." });
    }
    if (!Array.isArray(items) || items.length === 0 || !destinationAreaId || !shippingQuoteToken) {
      return res.status(400).json({ error: "Data pesanan atau pengiriman tidak lengkap." });
    }
    if (String(customerName || "").trim().length < 2 || String(customerName || "").trim().length > 100) {
      return res.status(400).json({ error: "Nama pelanggan harus 2-100 karakter." });
    }
    if (normalizedPhone.length < 9 || normalizedPhone.length > 16) {
      return res.status(400).json({ error: "Nomor WhatsApp tidak valid." });
    }
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "Email pelanggan tidak valid." });
    }
    if (String(address || "").trim().length < 10 || String(address || "").trim().length > 1000) {
      return res.status(400).json({ error: "Alamat harus 10-1000 karakter." });
    }
    if (String(destinationAreaId).length > 200 || String(shippingQuoteToken).length > 3000) {
      return res.status(400).json({ error: "Data pengiriman tidak valid." });
    }
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) return res.status(500).json({ error: "Server key belum dikonfigurasi." });

    const db = getAdminDb();
    const firebaseUser = await optionalCustomerUser(req);
    if (firebaseUser?.email && firebaseUser.email.toLowerCase() !== normalizedEmail) {
      return res.status(403).json({ error: "Email checkout harus sama dengan akun pelanggan yang sedang masuk." });
    }
    const customerProfile = firebaseUser?.uid
      ? await ensureCustomerProfile(firebaseUser.uid, normalizedEmail)
      : null;
    const normalizedReferralCode = featureFlags.referral
      ? String(customerProfile?.referredByCode || "")
      : "";
    const referrerUid = featureFlags.referral
      ? String(customerProfile?.referredByUid || "")
      : "";

    const checkoutRequestHash = hashOpaqueToken(idempotencyKey);
    const checkoutRequestRef = db.collection("checkoutRequests").doc(checkoutRequestHash);
    const checkoutClaim = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(checkoutRequestRef);
      if (snapshot.exists && snapshot.data().status !== "failed") {
        return { created: false, orderId: snapshot.data().orderId };
      }
      const newOrderId = generateSecureOrderId();
      tx.set(checkoutRequestRef, {
        orderId: newOrderId,
        status: "creating",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { created: true, orderId: newOrderId };
    });
    const orderId = checkoutClaim.orderId;
    const customerAccessToken = deriveCheckoutToken(idempotencyKey, "customer-access");
    const customerCancelToken = deriveCheckoutToken(idempotencyKey, "customer-cancel");
    const failCheckoutClaim = () => checkoutRequestRef.set({
      status: "failed",
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    if (!checkoutClaim.created) {
      const existingSnap = await db.collection("orders").doc(orderId).get();
      if (!existingSnap.exists) {
        return res.status(409).json({ code: "CHECKOUT_IN_PROGRESS", error: "Checkout sedang dibuat. Coba lagi beberapa detik." });
      }
      const existing = existingSnap.data();
      if (existing.snapToken && existing.status === "pending") {
        return res.status(200).json({
          token: existing.snapToken,
          redirect_url: existing.snapRedirectUrl || "",
          orderId,
          paymentExpiresAt: existing.paymentExpiresAt,
          paymentExpiryMinutes: existing.paymentExpiryMinutes || PAYMENT_EXPIRY_MINUTES,
          cancelToken: customerCancelToken,
          customerAccessToken,
          idempotent: true,
        });
      }
      return res.status(409).json({ error: "Checkout ini sudah selesai atau tidak dapat digunakan lagi." });
    }

    cleanupContext = {
      db,
      verifiedItems: [],
      orderId,
      claimRef: null,
      orderCreated: false,
      midtransAttempted: false,
      checkoutRequestRef,
    };

    // FIX #5 + #10: Validasi stok, harga, DAN reserve stok dalam satu Firestore transaction
    // Semua product reads dilakukan paralel via getAll()
    const validItems = normalizeRequestedItems(items);
    if (validItems.length === 0) {
      await failCheckoutClaim();
      return res.status(400).json({ error: "Tidak ada item valid dalam pesanan." });
    }

    const productRefs = validItems.map(item => db.collection("products").doc(item.id));
    const requestedPrices = new Map();
    for (const item of items) {
      const productId = String(item?.id || "").trim();
      const requestedPrice = Number(item?.price);
      if (productId && Number.isFinite(requestedPrice) && requestedPrice >= 0) {
        requestedPrices.set(productId, Math.round(requestedPrice));
      }
    }

    let verifiedItems;

    try {
      verifiedItems = await db.runTransaction(async (tx) => {
        // Harga flash sale dan produk dibaca di transaksi yang sama. Dengan
        // begitu admin tidak dapat mengubah jadwal di tengah validasi checkout.
        const pricingNow = Date.now();
        const saleSnapshot = await tx.get(buildCurrentFlashSalesQuery(db, pricingNow, 20));
        const productSnaps = await tx.getAll(...productRefs);
        const activeSale = featureFlags.flashSale ? resolveActiveFlashSale(
          saleSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
          pricingNow,
        ) : null;

        const outOfStock = [];
        const priceChanges = [];
        const verified = [];

        for (let i = 0; i < validItems.length; i++) {
          const item = validItems[i];
          const productSnap = productSnaps[i];

          if (!productSnap.exists) {
            outOfStock.push({ name: item.name || item.id, reason: "produk tidak ditemukan" });
            continue;
          }
          const productData = productSnap.data();
          const currentStock = Math.max(0, Number(productData.stock || 0));
          const flashPricing = getProductFlashSalePrice(
            { id: item.id, ...productData },
            activeSale,
            pricingNow,
          );
          const productPrice = flashPricing.price;
          if (!Number.isFinite(productPrice) || productPrice <= 0) {
            outOfStock.push({ name: productData.name || item.id, reason: "harga produk tidak valid" });
            continue;
          }
          if (currentStock < item.qty) {
            outOfStock.push({ name: productData.name || item.id, available: currentStock, requested: item.qty });
            continue;
          }

          const requestedPrice = requestedPrices.get(item.id);
          if (requestedPrice !== undefined && requestedPrice !== productPrice) {
            priceChanges.push({
              id: item.id,
              name: String(productData.name || item.id).slice(0, 120),
              price: productPrice,
              regularPrice: flashPricing.regularPrice,
              flashSaleId: flashPricing.flashSaleId,
            });
          }

          verified.push({
            id: item.id,
            name: String(productData.name || item.id).slice(0, 120),
            nameEn: String(productData.nameEn || productData.translations?.en?.name || "").slice(0, 120),
            price: productPrice,
            regularPrice: flashPricing.regularPrice,
            flashSaleId: flashPricing.flashSaleId,
            flashSaleDiscountPercent: flashPricing.discountPercent,
            flashSaleDiscountAmount: flashPricing.discountAmount,
            qty: Math.min(item.qty, currentStock),
          });
        }

        if (outOfStock.length > 0) {
          const msg = outOfStock.map((o) =>
            o.reason ? `${o.name}: ${o.reason}` : `${o.name}: stok tersisa ${o.available}, kamu minta ${o.requested}`
          ).join("; ");
          throw { type: "OUT_OF_STOCK", message: msg };
        }

        if (priceChanges.length > 0) {
          throw { type: "PRICE_CHANGED", prices: priceChanges };
        }

        // Semua validasi harga dan stok sudah selesai. Baru setelah itu stok
        // direservasi, tetap di dalam transaksi atomik yang sama.
        verified.forEach((item, index) => {
          const productData = productSnaps[index].data();
          const currentStock = Math.max(0, Number(productData.stock || 0));
          tx.update(productRefs[index], { stock: currentStock - item.qty });
        });

        return verified;
      });
    } catch (err) {
      if (err.type === "OUT_OF_STOCK") {
        await failCheckoutClaim();
        return res.status(400).json({ error: `Stok tidak cukup: ${err.message}` });
      }
      if (err.type === "PRICE_CHANGED") {
        await failCheckoutClaim();
        return res.status(409).json({
          code: "PRICE_CHANGED",
          error: "Harga produk baru saja berubah karena jadwal flash sale. Periksa kembali keranjang sebelum melanjutkan.",
          prices: err.prices,
        });
      }
      throw err;
    }

    cleanupContext = {
      db,
      verifiedItems,
      orderId,
      claimRef: null,
      orderCreated: false,
      midtransAttempted: false,
      checkoutRequestRef,
    };

    // Validate the signed shipping quote before coupon claims are created.
    const subtotal = verifiedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    let shippingQuote;
    try {
      shippingQuote = verifyShippingQuoteToken(shippingQuoteToken, {
        destinationAreaId,
        itemHash: shippingItemsFingerprint(verifiedItems),
      });
    } catch (quoteError) {
      await cleanupFailedCheckout(cleanupContext, "shipping_quote_invalid");
      cleanupContext = null;
      return res.status(400).json({ error: quoteError.message || "Quote pengiriman tidak valid." });
    }

    const shippingAmount = Math.max(0, Number(shippingQuote.shippingFee || 0));
    const shippingCourier = String(shippingQuote.shippingCourier || "");
    const shippingService = String(shippingQuote.shippingService || "");
    const verifiedDestinationAreaName = String(shippingQuote.destinationAreaName || "");

    // Validate and calculate the coupon with server-side product prices.
    let discountAmount = 0;
    if (couponCode) {
      const normalizedCouponCode = String(couponCode).trim().toUpperCase();
      const couponSnap = await db.collection("coupons").doc(normalizedCouponCode).get();
      if (!couponSnap.exists) {
        await cleanupFailedCheckout(cleanupContext, "coupon_invalid");
        cleanupContext = null;
        return res.status(400).json({ error: "Kupon tidak valid." });
      }
      const couponData = couponSnap.data();

      if (couponData.active === false || (couponData.expiresAt && new Date(couponData.expiresAt) < new Date())) {
        await cleanupFailedCheckout(cleanupContext, "coupon_inactive");
        cleanupContext = null;
        return res.status(400).json({ error: "Kupon sudah tidak berlaku." });
      }
      if (couponData.minOrder && subtotal < Number(couponData.minOrder)) {
        await cleanupFailedCheckout(cleanupContext, "coupon_minimum_not_met");
        cleanupContext = null;
        return res.status(400).json({ error: `Minimum order untuk kupon ini adalah Rp${Number(couponData.minOrder).toLocaleString("id-ID")}.` });
      }

      discountAmount = calculateCouponDiscount(couponData, subtotal);

      // Claim a single-use coupon only after all quote and coupon validation passes.
      if (couponData.singleUse) {
        const identifier = normalizedEmail || normalizedPhone;
        if (!identifier) {
          await cleanupFailedCheckout(cleanupContext, "coupon_identity_missing");
          cleanupContext = null;
          return res.status(400).json({ error: "Email atau nomor WhatsApp diperlukan untuk kupon ini." });
        }
        const claimDocId = `${normalizedCouponCode}__${identifier.replace(/[^a-zA-Z0-9@._-]/g, "_")}`;
        const claimRef = db.collection("couponClaims").doc(claimDocId);

        try {
          await db.runTransaction(async (tx) => {
            const claimSnap = await tx.get(claimRef);
            if (claimSnap.exists) throw { type: "COUPON_ALREADY_USED" };

            // tx.get pada query agar pengecekan "sudah dipakai" ikut dalam
            // conflict set transaksi (mencegah race antar checkout bersamaan).
            const usedQuery = await tx.get(
              db.collection("orders")
                .where("couponCode", "==", normalizedCouponCode)
                .where("status", "in", ["paid", "processing", "shipped", "delivered"])
                .limit(10)
            );
            const alreadyUsed = usedQuery.docs.some((document) => {
              const order = document.data();
              return (normalizedEmail && order.customerEmail === normalizedEmail)
                || (normalizedPhone && order.customerPhone === normalizedPhone);
            });
            if (alreadyUsed) throw { type: "COUPON_ALREADY_USED" };

            tx.set(claimRef, {
              couponCode: normalizedCouponCode,
              customerEmail: normalizedEmail,
              customerPhone: normalizedPhone,
              claimedAt: new Date().toISOString(),
              status: "pending",
            });
          });
          cleanupContext.claimRef = claimRef;
        } catch (claimError) {
          if (claimError.type === "COUPON_ALREADY_USED") {
            await cleanupFailedCheckout(cleanupContext, "coupon_already_used");
            cleanupContext = null;
            return res.status(400).json({ error: "Kupon ini sudah pernah digunakan oleh pelanggan ini." });
          }
          throw claimError;
        }
      }
    }

    const couponDiscountAmount = discountAmount;
    const requestedPoints = Math.max(0, Math.floor(Number(loyaltyPointsToRedeem) || 0));
    const loyaltyDiscountAmount = loyaltyRedemptionValue(requestedPoints);
    const requestedReferralCredit = Math.max(0, Math.floor(Number(referralCreditToRedeem) || 0));
    if (loyaltyDiscountAmount < 0 || requestedReferralCredit % 10_000 !== 0) {
      await cleanupFailedCheckout(cleanupContext, "reward_invalid");
      cleanupContext = null;
      return res.status(400).json({ error: "Nominal penukaran reward tidak valid." });
    }
    if (requestedPoints > maximumRedeemablePoints(subtotal)) {
      await cleanupFailedCheckout(cleanupContext, "points_exceed_limit");
      cleanupContext = null;
      return res.status(400).json({ error: "Potongan poin maksimal 20% dari subtotal produk." });
    }
    if ((requestedPoints > 0 || requestedReferralCredit > 0) && !firebaseUser?.uid) {
      await cleanupFailedCheckout(cleanupContext, "reward_auth_required");
      cleanupContext = null;
      return res.status(401).json({ error: "Masuk ke akun pelanggan untuk memakai reward." });
    }
    const rewardDiscountAmount = Math.max(0, loyaltyDiscountAmount) + requestedReferralCredit;
    if (rewardDiscountAmount > Math.max(0, subtotal - couponDiscountAmount)) {
      await cleanupFailedCheckout(cleanupContext, "reward_exceeds_subtotal");
      cleanupContext = null;
      return res.status(400).json({ error: "Reward yang dipakai melebihi nilai produk setelah kupon." });
    }
    discountAmount += rewardDiscountAmount;
    const totals = calculateOrderTotal(verifiedItems, discountAmount, shippingAmount);
    discountAmount = totals.discountAmount;
    const expectedAmount = totals.total;
    if (expectedAmount < 0) {
      await cleanupFailedCheckout(cleanupContext, "total_invalid");
      cleanupContext = null;
      return res.status(400).json({ error: "Total pembayaran tidak valid." });
    }

    const paymentStartedAtDate = new Date();
    const paymentStartedAt = paymentStartedAtDate.toISOString();
    const paymentExpiresAt = new Date(paymentStartedAtDate.getTime() + PAYMENT_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const customerCancelTokenHash = hashCustomerCancelToken(customerCancelToken);
    const customerAccessTokenHash = hashOpaqueToken(customerAccessToken);
    const flashSaleDiscount = verifiedItems.reduce(
      (sum, item) => sum + Number(item.flashSaleDiscountAmount || 0) * item.qty,
      0,
    );
    const flashSaleIds = [...new Set(
      verifiedItems.map((item) => item.flashSaleId).filter(Boolean),
    )];

    const orderPayload = {
      orderId, locale: orderLocale, status: "pending", amount: expectedAmount, subtotal, discount: discountAmount,
      heroVariant: heroVariant === "A" || heroVariant === "B" ? heroVariant : "",
      couponDiscount: couponDiscountAmount,
      loyaltyDiscount: Math.max(0, loyaltyDiscountAmount),
      loyaltyPointsRedeemed: requestedPoints,
      referralCreditRedeemed: requestedReferralCredit,
      referralCode: normalizedReferralCode,
      referrerUid,
      flashSaleDiscount,
      flashSaleIds,
      shippingFee: shippingAmount, shippingCourier: shippingCourier || "", shippingService: shippingService || "",
      destinationAreaId: destinationAreaId || "", destinationAreaName: verifiedDestinationAreaName,
      couponCode: couponCode ? String(couponCode).trim().toUpperCase() : "", customerName: String(customerName || "").trim(), customerEmail: normalizedEmail,
      // Simpan id klaim kupon sekali-pakai agar bisa dilepas bila pembayaran gagal.
      couponClaimId: cleanupContext.claimRef ? cleanupContext.claimRef.id : "",
      customerPhone: normalizedPhone, address: String(address || "").trim(),
      items: verifiedItems.map((it) => ({
        id: it.id,
        name: it.name,
        nameEn: it.nameEn || "",
        price: it.price,
        regularPrice: it.regularPrice,
        flashSaleId: it.flashSaleId || "",
        flashSaleDiscountPercent: it.flashSaleDiscountPercent || 0,
        qty: it.qty,
      })),
      paymentSessionStatus: "creating",
      customerCancelTokenHash,
      customerAccessTokenHash,
      customerUid: firebaseUser?.uid || "",
      checkoutRequestHash,
      customerCancelEnabled: true,
      stockReserved: true, // FIX #5: flag stok sudah direserve
      paymentStartedAt,
      paymentExpiresAt,
      paymentExpiryMinutes: PAYMENT_EXPIRY_MINUTES,
      reminderSent: false,
      createdAt: paymentStartedAt,
      updatedAt: paymentStartedAt,
    };

    await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId);
      if (!firebaseUser?.uid || (requestedPoints === 0 && requestedReferralCredit === 0)) {
        tx.create(orderRef, orderPayload);
        return;
      }
      const profileRef = db.collection("customerProfiles").doc(firebaseUser.uid);
      const profileSnapshot = await tx.get(profileRef);
      if (!profileSnapshot.exists) throw Object.assign(new Error("Profil pelanggan belum tersedia."), { code: "PROFILE_MISSING" });
      const profile = profileSnapshot.data();
      if (Number(profile.points || 0) < requestedPoints || Number(profile.referralCredit || 0) < requestedReferralCredit) {
        throw Object.assign(new Error("Saldo reward tidak mencukupi."), { code: "REWARD_BALANCE" });
      }
      tx.update(profileRef, {
        points: Number(profile.points || 0) - requestedPoints,
        referralCredit: Number(profile.referralCredit || 0) - requestedReferralCredit,
        updatedAt: paymentStartedAt,
      });
      reserveRewardTransactions(tx, db, {
        customerUid: firebaseUser.uid,
        orderId,
        points: requestedPoints,
        pointValue: Math.max(0, loyaltyDiscountAmount),
        referralCredit: requestedReferralCredit,
        createdAt: paymentStartedAt,
      });
      tx.create(orderRef, orderPayload);
    });
    cleanupContext.orderCreated = true;
    cleanupContext.midtransAttempted = true;

    const midtransRes = await createSnapTransaction(verifiedItems, {
      orderId, expectedAmount, customerName: String(customerName || "").trim(), customerEmail: normalizedEmail, customerPhone: normalizedPhone,
      discountAmount, couponCode: couponCode ? String(couponCode).trim().toUpperCase() : "", shippingAmount, shippingCourier, shippingService,
      paymentStartedAtDate, PAYMENT_EXPIRY_MINUTES,
    });

    const data = await midtransRes.json();
    if (!midtransRes.ok) {
      log("error", "checkout", "Midtrans create-transaction error", { data });
      // FIX #5: Restore stock jika Midtrans gagal
      await restoreReservedStock(db, verifiedItems);
      // FIX: Clean up coupon claim so customer can retry
      if (couponCode && (normalizedEmail || normalizedPhone)) {
        const identifier = normalizedEmail || normalizedPhone;
        const normalizedCouponCode = String(couponCode).trim().toUpperCase();
        const claimDocId = `${normalizedCouponCode}__${identifier.replace(/[^a-zA-Z0-9@._-]/g, "_")}`;
        await db.collection("couponClaims").doc(claimDocId).delete().catch((e) =>
          log("warn", "checkout", "Failed to clean up coupon claim", { error: e.message })
        );
      }
      await db.collection("orders").doc(orderId).update({
        status: "failed", paymentSessionStatus: "failed", failReason: "create_transaction_error",
        stockReserved: false, updatedAt: new Date().toISOString(),
      });
      const failedOrder = await db.collection("orders").doc(orderId).get();
      if (failedOrder.exists) await releaseLoyaltyReservation(db, failedOrder.data());
      await checkoutRequestRef.set({ status: "failed", updatedAt: new Date().toISOString() }, { merge: true });
      return res.status(midtransRes.status).json({ error: data.error_messages || "Gagal membuat transaksi." });
    }
    await db.collection("orders").doc(orderId).update({
      snapToken: data.token,
      snapRedirectUrl: data.redirect_url || "",
      paymentSessionStatus: "active",
      updatedAt: new Date().toISOString(),
    });
    await checkoutRequestRef.set({ status: "active", updatedAt: new Date().toISOString() }, { merge: true });
    cleanupContext = null;

    const notificationOrder = {
      orderId,
      locale: orderLocale,
      customerName: String(customerName || "").trim(),
      customerEmail: normalizedEmail,
      customerPhone: normalizedPhone,
      items: verifiedItems.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
      })),
      total: expectedAmount,
      amount: expectedAmount,
    };

    // Opsional dan fire-and-forget. Checkout tetap sukses walau provider
    // WhatsApp atau pencatatan funnel sedang tidak tersedia.
    notifyOrderCreated(notificationOrder, orderId).catch((error) =>
      log("warn", "checkout", "Gagal kirim WhatsApp pelanggan", { error: error.message, orderId }),
    );
    notifyAdminNewOrder(notificationOrder, orderId).catch((error) =>
      log("warn", "checkout", "Gagal kirim WhatsApp admin", { error: error.message, orderId }),
    );
    trackFunnelEvent("checkout").catch(() => {});

    return res.status(200).json({
      token: data.token,
      redirect_url: data.redirect_url,
      orderId,
      paymentExpiresAt,
      paymentExpiryMinutes: PAYMENT_EXPIRY_MINUTES,
      cancelToken: customerCancelToken,
      customerAccessToken,
    });
  } catch (err) {
    log("error", "checkout", "create-transaction error", { error: err.message });
    const cleanupResult = await cleanupFailedCheckout(cleanupContext, "unexpected_checkout_error");
    const uncertain = cleanupResult === "uncertain";
    return res.status(uncertain ? 502 : 500).json({
      error: uncertain
        ? "Status pembayaran belum dapat dipastikan. Jangan mengulang pembayaran sebelum menghubungi Customer Service."
        : "Terjadi kesalahan di server.",
    });
  }
});

// POST /api/midtrans-notification — Webhook
router.post("/api/midtrans-notification", webhookRateLimit, async (req, res) => {
  try {
    const body = req.body;
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;
    if (!order_id || !status_code || !gross_amount || !signature_key) return res.status(400).json({ error: "Notifikasi tidak lengkap." });

    // Type validation — semua field webhook harus string
    if (typeof order_id !== "string" || typeof status_code !== "string" ||
        typeof gross_amount !== "string" || typeof signature_key !== "string" ||
        (transaction_status !== undefined && typeof transaction_status !== "string")) {
      log("warn", "webhook", "Webhook payload type mismatch", { order_id: typeof order_id, status_code: typeof status_code });
      return res.status(400).json({ error: "Invalid payload types." });
    }

    // FIX #4: Log source IP + optional IP whitelist
    const sourceIp = String(req.ip || req.connection?.remoteAddress || "unknown").replace(/^::ffff:/, "");
    log("info", "webhook", `Midtrans notification from ${sourceIp}`, {
      ip: sourceIp, orderId: order_id, status: transaction_status,
    });
    if (!isWebhookIpAllowed(req.ip)) {
      log("warn", "webhook", `Webhook IP ${sourceIp} not in whitelist — REJECTED`, { ip: sourceIp, orderId: order_id });
      return res.status(403).json({ error: "IP tidak diizinkan." });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!verifyMidtransSignature(order_id, status_code, gross_amount, serverKey, signature_key)) {
      log("warn", "webhook", "Signature tidak valid", { orderId: order_id });
      return res.status(403).json({ error: "Signature tidak valid." });
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(order_id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(200).json({ message: "Order tidak ditemukan, diabaikan." });

    const order = orderSnap.data();

    const nextStatus = resolveOrderStatusTransition(order.status, transaction_status);
    if (nextStatus === "paid" && !paymentAmountMatches(order.amount, gross_amount)) {
      log("warn", "webhook", "gross_amount tidak cocok dengan order.amount", {
        orderId: order_id, grossAmount: gross_amount, orderAmount: order.amount,
      });
      await orderRef.update({
        paymentSessionStatus: "amount_mismatch",
        manualReviewRequired: true,
        receivedGrossAmount: String(gross_amount),
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({ message: "Nominal tidak cocok; pembayaran ditahan untuk review." });
    }
    const isSuccess = nextStatus === "paid";
    const isExpired = nextStatus === "expired";
    const isCancelled = nextStatus === "cancelled";
    const isFailed = nextStatus === "failed";

    if (isSuccess) {
      await handleOrderBecamePaid(order_id, {
        paymentType: body.payment_type,
        transactionId: body.transaction_id,
        transactionStatus: transaction_status,
        settlementTime: body.settlement_time,
        transactionTime: body.transaction_time,
      });
    } else if (isExpired && order.status !== "paid") {
      // FIX #5: Restore stock saat expire via webhook
      if (order.stockReserved) {
        await restoreReservedStock(db, order.items || []);
      }
      await orderRef.update({
        status: "expired",
        paymentSessionStatus: "expired",
        failReason: "payment_expired",
        transactionStatus: transaction_status,
        snapToken: null,
        snapRedirectUrl: null,
        stockReserved: false,
        expiredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else if (isCancelled && order.status !== "paid") {
      // FIX #5: Restore stock saat cancel via webhook
      if (order.stockReserved) {
        await restoreReservedStock(db, order.items || []);
      }
      const cancelledAt = new Date().toISOString();
      await orderRef.update({
        status: "cancelled",
        paymentSessionStatus: "cancelled",
        failReason: "payment_cancelled",
        transactionStatus: transaction_status,
        snapToken: null,
        snapRedirectUrl: null,
        stockReserved: false,
        cancellationSource: order.cancellationSource || "payment_gateway",
        cancelledBy: order.cancelledBy || "system",
        cancelledAt: order.cancelledAt || cancelledAt,
        customerCancelEnabled: false,
        updatedAt: cancelledAt,
      });
    } else if (isFailed && order.status !== "paid") {
      // FIX #5: Restore stock saat fail via webhook
      if (order.stockReserved) {
        await restoreReservedStock(db, order.items || []);
      }
      await orderRef.update({
        status: "failed",
        paymentSessionStatus: "failed",
        failReason: transaction_status,
        transactionStatus: transaction_status,
        snapToken: null,
        snapRedirectUrl: null,
        stockReserved: false,
        updatedAt: new Date().toISOString(),
      });
    }

    // Lepas klaim kupon sekali-pakai bila pembayaran gagal/kedaluwarsa/dibatalkan
    // agar pelanggan dapat memakainya lagi. Klaim TIDAK dilepas untuk order paid.
    const isTerminalPaymentFailure = isExpired || isCancelled || isFailed
      || ["expired", "cancelled", "failed"].includes(order.status);
    if (isTerminalPaymentFailure && order.status !== "paid") {
      await releaseCouponClaim(db, order);
      const failedOrder = await orderRef.get();
      if (failedOrder.exists) await releaseLoyaltyReservation(db, failedOrder.data());
    }

    return res.status(200).json({ message: "OK" });
  } catch (err) {
    log("error", "webhook", "midtrans-notification error", { error: err.message });
    return res.status(200).json({ message: "Error dicatat di server." });
  }
});

// POST /api/validate-stock
router.post("/api/validate-stock", rateLimit, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Data item tidak lengkap." });
    const db = getAdminDb();

    // FIX #10: Parallel reads
    const refs = items.map(item => db.collection("products").doc(item.id));
    const snaps = await db.getAll(...refs);

    const issues = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const snap = snaps[i];
      if (!snap.exists) { issues.push({ id: item.id, name: item.name, issue: "not_found" }); continue; }
      const currentStock = snap.data().stock || 0;
      if (currentStock < item.qty) issues.push({ id: item.id, name: item.name, issue: "insufficient", available: currentStock, requested: item.qty });
    }
    if (issues.length > 0) return res.status(200).json({ valid: false, issues });
    trackFunnelEvent("addToCart").catch(() => {});
    return res.status(200).json({ valid: true });
  } catch (err) {
    log("error", "checkout", "validate-stock error", { error: err.message });
    return res.status(500).json({ error: "Gagal validasi stok." });
  }
});

export default router;
