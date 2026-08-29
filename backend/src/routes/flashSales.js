import { Router } from "express";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { verifyAdmin } from "../middleware/auth.js";
import {
  buildCurrentFlashSalesQuery,
  buildPotentialFlashSaleConflictsQuery,
  executeFlashSaleQuery,
  findFlashSaleConflict,
  getProductFlashSalePrice,
  normalizeFlashSaleInput,
  recordsFromFlashSaleSnapshot,
  resolveActiveFlashSale,
  serializeFlashSale,
} from "../services/flashSales.js";
import { log } from "../services/logger.js";
import { captureException } from "../services/sentry.js";
import { getFeatureFlags } from "../services/featureFlags.js";

const router = Router();
const FLASH_SALES_COLLECTION = "flashSales";
const FLASH_SALE_LIST_LIMIT = 200;

async function readFlashSales(db) {
  const query = db
    .collection(FLASH_SALES_COLLECTION)
    .orderBy("startAt", "desc")
    .limit(FLASH_SALE_LIST_LIMIT);
  return executeFlashSaleQuery(query);
}

async function readCurrentFlashSales(db, nowValue) {
  const query = buildCurrentFlashSalesQuery(db, nowValue);
  return executeFlashSaleQuery(query);
}

async function assertProductsExist(db, productIds, transaction = null) {
  const references = productIds.map((productId) => db.collection("products").doc(productId));
  const snapshots =
    references.length === 0
      ? []
      : transaction
        ? await transaction.getAll(...references)
        : await db.getAll(...references);

  const missing = snapshots
    .filter((snapshot) => !snapshot.exists || snapshot.data()?.isArchived === true)
    .map((snapshot) => snapshot.id);

  if (missing.length > 0) {
    const error = new Error(`Produk tidak ditemukan atau sudah diarsipkan: ${missing.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  return snapshots;
}

function conflictMessage(conflict) {
  const title = String(conflict?.titleId || conflict?.id || "jadwal lain");
  return `Jadwal bertabrakan dengan "${title}". Hentikan atau ubah jadwal tersebut terlebih dahulu.`;
}

router.get("/api/flash-sales/current", async (_req, res) => {
  const now = Date.now();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Morgen-Route", "flash-sale-v3");

  try {
    if (!(await getFeatureFlags()).flashSale) {
      return res.status(200).json({ active: false, serverTime: new Date(now).toISOString() });
    }
    const db = getAdminDb();
    const sales = await readCurrentFlashSales(db, now);
    const activeSale = resolveActiveFlashSale(sales, now);

    if (!activeSale) {
      return res.status(200).json({
        active: false,
        serverTime: new Date(now).toISOString(),
        sale: null,
      });
    }

    // Normalisasi lebih dulu agar dokumen lama/tidak lengkap tidak dapat
    // menjatuhkan endpoint publik.
    const publicSale = serializeFlashSale(activeSale, now);
    const productReferences = publicSale.productIds.map((productId) =>
      db.collection("products").doc(productId)
    );
    const productSnapshots =
      productReferences.length > 0 ? await db.getAll(...productReferences) : [];
    const availableProductSnapshots = productSnapshots.filter(
      (snapshot) => snapshot.exists && snapshot.data()?.isArchived !== true
    );

    if (availableProductSnapshots.length === 0) {
      return res.status(200).json({
        active: false,
        serverTime: new Date(now).toISOString(),
        sale: null,
      });
    }

    const prices = availableProductSnapshots.map((snapshot) => {
      const product = { id: snapshot.id, ...snapshot.data() };
      const pricing = getProductFlashSalePrice(product, activeSale, now);
      return {
        productId: product.id,
        regularPrice: pricing.regularPrice,
        salePrice: pricing.price,
        discountAmount: pricing.discountAmount,
      };
    });

    return res.status(200).json({
      active: true,
      serverTime: new Date(now).toISOString(),
      sale: {
        ...publicSale,
        productIds: availableProductSnapshots.map((snapshot) => snapshot.id),
        prices,
      },
    });
  } catch (error) {
    log("error", "flash-sale", "fetch current flash sale failed", {
      error: error.message,
      code: error.code || null,
    });
    captureException(error, {
      feature: "flash-sale",
      operation: "fetch-current",
    });
    // Flash sale adalah komponen promosi opsional. Kegagalan baca tidak boleh
    // menjatuhkan storefront atau mencetak HTTP 500 berulang di browser.
    return res.status(200).json({
      active: false,
      serverTime: new Date(now).toISOString(),
      sale: null,
      temporarilyUnavailable: true,
    });
  }
});

router.get("/api/admin/flash-sales", verifyAdmin, async (_req, res) => {
  const now = Date.now();
  try {
    const db = getAdminDb();
    const sales = (await readFlashSales(db))
      .map((sale) => serializeFlashSale(sale, now))
      .sort((a, b) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime());

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      serverTime: new Date(now).toISOString(),
      sales,
    });
  } catch (error) {
    log("error", "flash-sale", "admin list flash sale failed", {
      error: error.message,
    });
    return res.status(500).json({ error: "Gagal memuat jadwal flash sale." });
  }
});

router.post("/api/admin/flash-sales", verifyAdmin, async (req, res) => {
  try {
    const payload = normalizeFlashSaleInput(req.body);
    const db = getAdminDb();
    const documentRef = db.collection(FLASH_SALES_COLLECTION).doc();
    const now = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const salesSnapshot = await transaction.get(
        buildPotentialFlashSaleConflictsQuery(db, payload.endAt)
      );
      await assertProductsExist(db, payload.productIds, transaction);

      const conflict = findFlashSaleConflict(recordsFromFlashSaleSnapshot(salesSnapshot), payload);
      if (conflict) {
        const error = new Error(conflictMessage(conflict));
        error.statusCode = 409;
        throw error;
      }

      transaction.set(documentRef, {
        ...payload,
        createdAt: now,
        createdBy: req.adminEmail || req.adminUid,
        updatedAt: now,
        updatedBy: req.adminEmail || req.adminUid,
      });
    });

    return res.status(201).json({
      message: "Flash sale berhasil dijadwalkan.",
      sale: serializeFlashSale({ id: documentRef.id, ...payload, createdAt: now, updatedAt: now }),
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    log(statusCode >= 500 ? "error" : "warn", "flash-sale", "create flash sale failed", {
      error: error.message,
      admin: req.adminEmail || req.adminUid,
    });
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "Gagal menjadwalkan flash sale." : error.message,
    });
  }
});

router.patch("/api/admin/flash-sales/:saleId", verifyAdmin, async (req, res) => {
  const saleId = String(req.params.saleId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(saleId)) {
    return res.status(400).json({ error: "ID flash sale tidak valid." });
  }

  try {
    const db = getAdminDb();
    const documentRef = db.collection(FLASH_SALES_COLLECTION).doc(saleId);
    const now = new Date().toISOString();

    if (req.body?.action === "stop") {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        if (!snapshot.exists) {
          const error = new Error("Flash sale tidak ditemukan.");
          error.statusCode = 404;
          throw error;
        }
        transaction.update(documentRef, {
          status: "stopped",
          stoppedAt: now,
          stoppedBy: req.adminEmail || req.adminUid,
          updatedAt: now,
          updatedBy: req.adminEmail || req.adminUid,
        });
      });

      return res.status(200).json({ message: "Flash sale berhasil dihentikan." });
    }

    const payload = normalizeFlashSaleInput(req.body);
    await db.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(documentRef);
      const salesSnapshot = await transaction.get(
        buildPotentialFlashSaleConflictsQuery(db, payload.endAt)
      );
      if (!existingSnapshot.exists) {
        const error = new Error("Flash sale tidak ditemukan.");
        error.statusCode = 404;
        throw error;
      }

      await assertProductsExist(db, payload.productIds, transaction);
      const conflict = findFlashSaleConflict(
        recordsFromFlashSaleSnapshot(salesSnapshot),
        payload,
        saleId
      );
      if (conflict) {
        const error = new Error(conflictMessage(conflict));
        error.statusCode = 409;
        throw error;
      }

      transaction.update(documentRef, {
        ...payload,
        stoppedAt: null,
        stoppedBy: null,
        updatedAt: now,
        updatedBy: req.adminEmail || req.adminUid,
      });
    });

    return res.status(200).json({
      message: "Jadwal flash sale berhasil diperbarui.",
      sale: serializeFlashSale({ id: saleId, ...payload, updatedAt: now }),
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    log(statusCode >= 500 ? "error" : "warn", "flash-sale", "update flash sale failed", {
      error: error.message,
      saleId,
      admin: req.adminEmail || req.adminUid,
    });
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "Gagal memperbarui flash sale." : error.message,
    });
  }
});

export default router;
