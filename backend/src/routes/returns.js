import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { getAdminDb } from "../config/firebaseAdmin.js";
import { optionalCustomerUser, verifyAdmin } from "../middleware/auth.js";
import {
  rateLimit,
  returnEvidenceRateLimit,
  returnSubmitRateLimit,
} from "../middleware/rateLimiter.js";
import { deleteUploadedImage, uploadImageWithFallback } from "../services/imageCdn.js";
import { log } from "../services/logger.js";
import { saveNotification } from "../services/notifications.js";
import {
  getReturnEligibility,
  isRequestedReturnResolution,
  isReturnIssueType,
  isReturnResolution,
  normalizePhone,
  parseClaimedItems,
  resolveReturnStatusTransition,
  returnRequestId,
  serializePublicReturnRequest,
} from "../services/returnRequests.js";
import { sniffImageType } from "../utils/imageType.js";
import { sanitizeText } from "../utils/index.js";
import { verifyOpaqueToken } from "../utils/customerSecurity.js";
import { getFeatureFlags } from "../services/featureFlags.js";

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const ORDER_ID_PATTERN = /^MG-[A-Za-z0-9-]{8,64}$/;
const MAX_EVIDENCE_FILES = 3;
const MAX_TOTAL_EVIDENCE_FILES = 9;

router.use("/api/returns", async (_req, res, next) => {
  try {
    if (!(await getFeatureFlags()).returns) {
      return res.status(503).json({ error: "Pengajuan retur sedang dinonaktifkan sementara." });
    }
    return next();
  } catch {
    return res.status(503).json({ error: "Konfigurasi fitur belum tersedia." });
  }
});

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => {
      const extension = MIME_TO_EXT[file.mimetype] || ".bin";
      callback(
        null,
        `${Date.now()}_return_${createHash("sha256")
          .update(`${file.originalname}-${Math.random()}`)
          .digest("hex")
          .slice(0, 16)}${extension}`
      );
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: MAX_EVIDENCE_FILES,
    fields: 20,
  },
  fileFilter: (_req, file, callback) => {
    if (MIME_TO_EXT[file.mimetype]) callback(null, true);
    else callback(new Error("Format harus JPG, PNG, atau WebP."));
  },
});

function routeError(message, statusCode = 400, code = "INVALID_REQUEST") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanText(value, { label, min = 0, max = 1000 }) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw.length < min) throw routeError(`${label} minimal ${min} karakter.`);
  if (raw.length > max) throw routeError(`${label} maksimal ${max} karakter.`);
  return sanitizeText(raw, max);
}

function safeOrderId(value) {
  const orderId = String(value || "").trim();
  if (!ORDER_ID_PATTERN.test(orderId)) {
    throw routeError("ID pesanan tidak valid.");
  }
  return orderId;
}

function riskProfileId(phone) {
  return createHash("sha256").update(normalizePhone(phone)).digest("hex");
}

async function cleanupLocalFiles(files) {
  await Promise.all((files || []).map((file) => fs.promises.unlink(file.path).catch(() => {})));
}

async function cleanupUncommittedEvidence(evidence, files) {
  await Promise.all(
    (evidence || [])
      .filter((item) => item?.storage === "cloudinary" && item?.publicId)
      .map((item) => deleteUploadedImage(item.publicId))
  );
  await cleanupLocalFiles(files);
}

async function verifyEvidenceFiles(files) {
  for (const file of files || []) {
    const handle = await fs.promises.open(file.path, "r");
    try {
      const buffer = Buffer.alloc(12);
      await handle.read(buffer, 0, 12, 0);
      if (!sniffImageType(buffer)) {
        throw routeError(
          "Salah satu bukti bukan gambar JPG, PNG, atau WebP yang valid.",
          400,
          "INVALID_EVIDENCE"
        );
      }
    } finally {
      await handle.close();
    }
  }
}

async function storeEvidence(files, source) {
  const createdAt = new Date().toISOString();
  return Promise.all(
    (files || []).map(async (file) => {
      const stored = await uploadImageWithFallback(file, {
        folder: "returns",
        tags: ["morgen-geschaft", "return-evidence"],
      });
      return {
        url: stored.url,
        storage: stored.storage,
        publicId: stored.publicId || "",
        createdAt,
        source,
      };
    })
  );
}

function statusPublicNote(status, customMessage = "") {
  if (customMessage) return customMessage;
  const notes = {
    submitted: "Pengajuan diterima dan menunggu pemeriksaan.",
    reviewing: "Pengajuan sedang diperiksa oleh tim Morgen Geschäft.",
    waiting_customer: "Tim membutuhkan informasi atau bukti tambahan.",
    approved: "Pengajuan telah disetujui.",
    return_in_transit: "Barang retur sedang dikirim kembali.",
    return_received: "Barang retur telah diterima oleh tim.",
    rejected: "Pengajuan tidak dapat disetujui.",
    completed: "Pengajuan telah diselesaikan.",
  };
  return notes[status] || "Status pengajuan diperbarui.";
}

function notificationForStatus(request, status) {
  const id = request.id || returnRequestId(request.orderId);
  const statusCopy = {
    submitted: {
      title: `Komplain ${id} diterima`,
      body: "Pengajuan akan diperiksa oleh tim Morgen Geschäft.",
      titleEn: `Claim ${id} received`,
      bodyEn: "Your request will be reviewed by the Morgen Geschäft team.",
    },
    reviewing: {
      title: `Komplain ${id} sedang ditinjau`,
      body: "Tim sedang memeriksa detail dan bukti yang dikirim.",
      titleEn: `Claim ${id} is under review`,
      bodyEn: "The team is checking the submitted details and evidence.",
    },
    waiting_customer: {
      title: `Komplain ${id} memerlukan jawaban`,
      body: "Buka Lacak Pesanan untuk melihat permintaan informasi tambahan.",
      titleEn: `Claim ${id} needs your response`,
      bodyEn: "Open Track Order to view the request for more information.",
    },
    approved: {
      title: `Komplain ${id} disetujui`,
      body: "Buka Lacak Pesanan untuk melihat keputusan dan instruksi berikutnya.",
      titleEn: `Claim ${id} approved`,
      bodyEn: "Open Track Order to view the decision and next instructions.",
    },
    return_in_transit: {
      title: `Retur ${id} sedang dikirim`,
      body: "Data pengiriman retur sudah diterima.",
      titleEn: `Return ${id} is in transit`,
      bodyEn: "Your return-shipment details have been received.",
    },
    return_received: {
      title: `Retur ${id} sudah diterima`,
      body: "Tim akan menyelesaikan penggantian atau refund sesuai keputusan.",
      titleEn: `Return ${id} received`,
      bodyEn: "The team will complete the approved replacement or refund.",
    },
    rejected: {
      title: `Keputusan komplain ${id}`,
      body: "Buka Lacak Pesanan untuk melihat alasan keputusan.",
      titleEn: `Decision for claim ${id}`,
      bodyEn: "Open Track Order to view the decision reason.",
    },
    completed: {
      title: `Komplain ${id} selesai`,
      body: "Penggantian atau refund telah dicatat sebagai selesai.",
      titleEn: `Claim ${id} completed`,
      bodyEn: "The replacement or refund has been recorded as completed.",
    },
  };
  return statusCopy[status] || statusCopy.submitted;
}

function notifyReturnStatus(request, status) {
  const copy = notificationForStatus(request, status);
  return saveNotification(copy.title, copy.body, "/id#lacak", "pesanan", request.orderId, {
    titleEn: copy.titleEn,
    bodyEn: copy.bodyEn,
    urlEn: "/en#track-order",
  });
}

function adminReturnRecord(document) {
  const data = document.data();
  return {
    id: data.id || returnRequestId(data.orderId),
    documentId: document.id,
    ...data,
  };
}

async function getOwnedOrder(req, db, orderId, phone) {
  const orderSnapshot = await db.collection("orders").doc(orderId).get();
  if (!orderSnapshot.exists) {
    throw routeError("Pesanan tidak ditemukan.", 404, "ORDER_NOT_FOUND");
  }
  const order = orderSnapshot.data();
  const firebaseUser = await optionalCustomerUser(req);
  const accessToken = String(req.headers["x-customer-access-token"] || req.body?.customerAccessToken || "");
  const legacyEmailOwner = !order.customerAccessTokenHash
    && firebaseUser?.email
    && String(order.customerEmail || "").trim().toLowerCase() === String(firebaseUser.email).trim().toLowerCase();
  const authorized = (firebaseUser?.uid && order.customerUid === firebaseUser.uid)
    || (order.customerAccessTokenHash && verifyOpaqueToken(accessToken, order.customerAccessTokenHash))
    || legacyEmailOwner;
  if (!authorized) {
    throw routeError(
      "Pesanan tidak ditemukan. Periksa ID dan nomor WhatsApp.",
      404,
      "ORDER_NOT_FOUND"
    );
  }
  return {
    ref: orderSnapshot.ref,
    order,
  };
}

// POST /api/returns — pelanggan membuat satu pengajuan untuk satu pesanan.
router.post(
  "/api/returns",
  returnSubmitRateLimit,
  evidenceUpload.array("evidence", MAX_EVIDENCE_FILES),
  async (req, res) => {
    const uploadedFiles = req.files || [];
    let storedEvidence = [];
    let evidenceCommitted = false;
    try {
      const orderId = safeOrderId(req.body?.orderId);
      const phone = String(req.body?.phone || "");
      if (normalizePhone(phone).length < 9) {
        throw routeError("Nomor WhatsApp tidak valid.");
      }

      const issueType = String(req.body?.issueType || "");
      if (!isReturnIssueType(issueType)) {
        throw routeError("Jenis masalah tidak valid.");
      }
      const requestedResolution = String(req.body?.requestedResolution || "");
      if (!isRequestedReturnResolution(requestedResolution)) {
        throw routeError("Pilihan penyelesaian tidak valid.");
      }
      if (String(req.body?.policyAccepted || "") !== "true") {
        throw routeError("Persetujuan kebijakan komplain wajib dicentang.");
      }

      const description = cleanText(req.body?.description, {
        label: "Penjelasan",
        min: 20,
        max: 1500,
      });
      if (uploadedFiles.length < 1) {
        throw routeError("Unggah minimal satu foto bukti.", 400, "EVIDENCE_REQUIRED");
      }
      await verifyEvidenceFiles(uploadedFiles);

      const db = getAdminDb();
      const { ref: orderRef, order } = await getOwnedOrder(req, db, orderId, phone);
      const requestRef = db.collection("returnRequests").doc(orderId);
      const existingSnapshot = await requestRef.get();
      const eligibility = getReturnEligibility(
        order,
        existingSnapshot.exists ? existingSnapshot.data() : null
      );
      if (!eligibility.eligible) {
        const messages = {
          already_submitted: "Pesanan ini sudah memiliki pengajuan komplain.",
          not_delivered: "Komplain produk dapat diajukan setelah pesanan berstatus sampai.",
          delivery_time_missing: "Waktu penerimaan pesanan belum tercatat. Hubungi admin.",
          window_expired: "Batas pengajuan 3×24 jam setelah pesanan diterima sudah berakhir.",
        };
        throw routeError(
          messages[eligibility.reason] || "Pesanan belum memenuhi syarat pengajuan.",
          409,
          eligibility.reason.toUpperCase()
        );
      }

      const claimed = parseClaimedItems(req.body?.selectedItems, order.items);
      const customerPhoneNormalized = normalizePhone(order.customerPhone);
      const [priorRequests, riskProfileSnapshot] = await Promise.all([
        db
          .collection("returnRequests")
          .where("customerPhoneNormalized", "==", customerPhoneNormalized)
          .limit(20)
          .get(),
        db.collection("customerRiskProfiles").doc(riskProfileId(customerPhoneNormalized)).get(),
      ]);
      storedEvidence = await storeEvidence(uploadedFiles, "initial");
      const now = new Date().toISOString();
      const requestId = returnRequestId(orderId);
      const request = {
        id: requestId,
        orderId,
        status: "submitted",
        issueType,
        description,
        requestedResolution,
        resolution: "",
        selectedItems: claimed.items,
        claimedAmount: claimed.claimedAmount,
        orderAmount: Number(order.amount || 0),
        evidence: storedEvidence,
        customerReplies: [],
        customerName: String(order.customerName || "").slice(0, 150),
        customerPhone: String(order.customerPhone || "").slice(0, 40),
        customerPhoneNormalized,
        customerEmail: String(order.customerEmail || "").slice(0, 200),
        customerComplaintCount: priorRequests.size + 1,
        customerRiskFlag:
          riskProfileSnapshot.exists && riskProfileSnapshot.data()?.riskFlag === true,
        customerRiskReason: riskProfileSnapshot.exists
          ? String(riskProfileSnapshot.data()?.reason || "").slice(0, 500)
          : "",
        latestAdminMessage: "",
        returnRequired: false,
        returnInstructions: "",
        refundAmount: 0,
        statusHistory: [
          {
            status: "submitted",
            at: now,
            actor: "customer",
            publicNote: statusPublicNote("submitted"),
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      await db.runTransaction(async (transaction) => {
        const [freshOrderSnapshot, freshRequestSnapshot] = await Promise.all([
          transaction.get(orderRef),
          transaction.get(requestRef),
        ]);
        if (!freshOrderSnapshot.exists) {
          throw routeError("Pesanan tidak ditemukan.", 404, "ORDER_NOT_FOUND");
        }
        if (freshRequestSnapshot.exists) {
          throw routeError(
            "Pesanan ini sudah memiliki pengajuan komplain.",
            409,
            "ALREADY_SUBMITTED"
          );
        }
        const freshEligibility = getReturnEligibility(freshOrderSnapshot.data());
        if (!freshEligibility.eligible) {
          throw routeError(
            "Masa pengajuan sudah berakhir atau status pesanan berubah.",
            409,
            "NOT_ELIGIBLE"
          );
        }
        transaction.create(requestRef, request);
        transaction.update(orderRef, {
          returnRequestId: requestId,
          returnStatus: "submitted",
          returnRequestedAt: now,
          updatedAt: now,
        });
      });
      evidenceCommitted = true;

      void notifyReturnStatus(request, "submitted");
      return res.status(201).json({
        message: "Pengajuan komplain berhasil dikirim.",
        returnRequest: serializePublicReturnRequest(orderId, request),
      });
    } catch (error) {
      if (!evidenceCommitted) {
        await cleanupUncommittedEvidence(storedEvidence, uploadedFiles);
      }
      log("warn", "returns", "create return request failed", {
        error: error.message,
        code: error.code || "",
      });
      return res.status(error.statusCode || 500).json({
        error: error.statusCode ? error.message : "Gagal mengirim pengajuan. Coba lagi sebentar.",
        code: error.code || "RETURN_CREATE_FAILED",
      });
    }
  }
);

// POST /api/returns/:orderId/response — jawaban/bukti tambahan pelanggan.
router.post(
  "/api/returns/:orderId/response",
  returnEvidenceRateLimit,
  evidenceUpload.array("evidence", MAX_EVIDENCE_FILES),
  async (req, res) => {
    const uploadedFiles = req.files || [];
    let storedEvidence = [];
    let evidenceCommitted = false;
    try {
      const orderId = safeOrderId(req.params.orderId);
      const phone = String(req.body?.phone || "");
      const messageRaw = String(req.body?.message || "").trim();
      if (!messageRaw && uploadedFiles.length === 0) {
        throw routeError("Isi jawaban atau unggah bukti tambahan.");
      }
      const message = messageRaw
        ? cleanText(messageRaw, { label: "Jawaban", min: 5, max: 1000 })
        : "";
      await verifyEvidenceFiles(uploadedFiles);

      const db = getAdminDb();
      await getOwnedOrder(req, db, orderId, phone);
      const requestRef = db.collection("returnRequests").doc(orderId);
      const initialSnapshot = await requestRef.get();
      if (!initialSnapshot.exists) {
        throw routeError("Pengajuan tidak ditemukan.", 404, "RETURN_NOT_FOUND");
      }
      const initialRequest = initialSnapshot.data();
      if (!resolveReturnStatusTransition(initialRequest.status, "customer_response")) {
        throw routeError(
          "Pengajuan ini sedang tidak menunggu jawaban pelanggan.",
          409,
          "INVALID_RETURN_STATUS"
        );
      }
      if (
        (initialRequest.evidence?.length || 0) + uploadedFiles.length >
        MAX_TOTAL_EVIDENCE_FILES
      ) {
        throw routeError(`Total bukti maksimal ${MAX_TOTAL_EVIDENCE_FILES} foto.`);
      }

      storedEvidence = await storeEvidence(uploadedFiles, "customer_response");
      const now = new Date().toISOString();
      let updatedRequest;

      await db.runTransaction(async (transaction) => {
        const freshSnapshot = await transaction.get(requestRef);
        if (!freshSnapshot.exists) {
          throw routeError("Pengajuan tidak ditemukan.", 404, "RETURN_NOT_FOUND");
        }
        const fresh = freshSnapshot.data();
        const nextStatus = resolveReturnStatusTransition(fresh.status, "customer_response");
        if (!nextStatus) {
          throw routeError(
            "Status pengajuan sudah berubah. Muat ulang halaman.",
            409,
            "INVALID_RETURN_STATUS"
          );
        }
        if ((fresh.evidence?.length || 0) + storedEvidence.length > MAX_TOTAL_EVIDENCE_FILES) {
          throw routeError(`Total bukti maksimal ${MAX_TOTAL_EVIDENCE_FILES} foto.`);
        }

        const reply = {
          message,
          evidence: storedEvidence,
          createdAt: now,
        };
        updatedRequest = {
          ...fresh,
          status: nextStatus,
          evidence: [...(fresh.evidence || []), ...storedEvidence],
          customerReplies: [...(fresh.customerReplies || []), reply],
          latestCustomerResponseAt: now,
          updatedAt: now,
          statusHistory: [
            ...(fresh.statusHistory || []),
            {
              status: nextStatus,
              at: now,
              actor: "customer",
              publicNote: "Jawaban dan bukti tambahan telah dikirim.",
            },
          ],
        };
        transaction.update(requestRef, updatedRequest);
        transaction.update(db.collection("orders").doc(orderId), {
          returnStatus: nextStatus,
          updatedAt: now,
        });
      });
      evidenceCommitted = true;

      void notifyReturnStatus(updatedRequest, "submitted");
      return res.status(200).json({
        message: "Jawaban tambahan berhasil dikirim.",
        returnRequest: serializePublicReturnRequest(orderId, updatedRequest),
      });
    } catch (error) {
      if (!evidenceCommitted) {
        await cleanupUncommittedEvidence(storedEvidence, uploadedFiles);
      }
      log("warn", "returns", "customer response failed", {
        error: error.message,
        code: error.code || "",
      });
      return res.status(error.statusCode || 500).json({
        error: error.statusCode ? error.message : "Gagal mengirim jawaban tambahan.",
        code: error.code || "RETURN_RESPONSE_FAILED",
      });
    }
  }
);

// POST /api/returns/:orderId/shipment — diisi hanya setelah admin meminta retur.
router.post("/api/returns/:orderId/shipment", rateLimit, async (req, res) => {
  try {
    const orderId = safeOrderId(req.params.orderId);
    const phone = String(req.body?.phone || "");
    const courier = cleanText(req.body?.courier, {
      label: "Nama kurir",
      min: 2,
      max: 50,
    });
    const trackingNumber = String(req.body?.trackingNumber || "").trim();
    if (
      trackingNumber.length < 4 ||
      trackingNumber.length > 100 ||
      !/^[A-Za-z0-9._/ -]+$/.test(trackingNumber)
    ) {
      throw routeError("Nomor resi retur tidak valid.");
    }

    const db = getAdminDb();
    await getOwnedOrder(req, db, orderId, phone);
    const requestRef = db.collection("returnRequests").doc(orderId);
    const now = new Date().toISOString();
    let updatedRequest;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) {
        throw routeError("Pengajuan tidak ditemukan.", 404, "RETURN_NOT_FOUND");
      }
      const request = snapshot.data();
      const nextStatus = resolveReturnStatusTransition(request.status, "submit_return_shipment");
      if (!nextStatus || request.returnRequired !== true) {
        throw routeError(
          "Barang belum boleh dikirim balik atau status pengajuan sudah berubah.",
          409,
          "RETURN_NOT_AUTHORIZED"
        );
      }

      updatedRequest = {
        ...request,
        status: nextStatus,
        returnShipment: {
          courier,
          trackingNumber,
          submittedAt: now,
          receivedAt: "",
        },
        updatedAt: now,
        statusHistory: [
          ...(request.statusHistory || []),
          {
            status: nextStatus,
            at: now,
            actor: "customer",
            publicNote: `Resi retur ${trackingNumber} telah dikirim.`,
          },
        ],
      };
      transaction.update(requestRef, updatedRequest);
      transaction.update(db.collection("orders").doc(orderId), {
        returnStatus: nextStatus,
        updatedAt: now,
      });
    });

    void notifyReturnStatus(updatedRequest, "return_in_transit");
    return res.status(200).json({
      message: "Data pengiriman retur berhasil disimpan.",
      returnRequest: serializePublicReturnRequest(orderId, updatedRequest),
    });
  } catch (error) {
    log("warn", "returns", "return shipment failed", {
      error: error.message,
      code: error.code || "",
    });
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Gagal menyimpan data pengiriman retur.",
      code: error.code || "RETURN_SHIPMENT_FAILED",
    });
  }
});

// GET /api/admin/returns — daftar komplain untuk panel admin.
router.get("/api/admin/returns", verifyAdmin, async (req, res) => {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection("returnRequests").limit(250).get();
    let requests = snapshot.docs
      .map(adminReturnRecord)
      .sort(
        (left, right) =>
          new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
      );

    const status = String(req.query.status || "").trim();
    if (status && status !== "all") {
      requests = requests.filter((request) => request.status === status);
    }
    return res.status(200).json({ requests });
  } catch (error) {
    log("error", "returns", "admin list returns failed", {
      error: error.message,
    });
    return res.status(500).json({ error: "Gagal memuat daftar komplain." });
  }
});

// PATCH /api/admin/returns/:orderId — keputusan dan audit admin.
router.patch("/api/admin/returns/:orderId", verifyAdmin, async (req, res) => {
  try {
    const orderId = safeOrderId(req.params.orderId);
    const action = String(req.body?.action || "");
    const db = getAdminDb();
    const requestRef = db.collection("returnRequests").doc(orderId);
    const orderRef = db.collection("orders").doc(orderId);
    const now = new Date().toISOString();
    let updatedRequest;
    let notifyStatus = "";

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) {
        throw routeError("Pengajuan tidak ditemukan.", 404, "RETURN_NOT_FOUND");
      }
      const request = snapshot.data();

      if (action === "save_note") {
        const note = cleanText(req.body?.internalNote, {
          label: "Catatan internal",
          min: 3,
          max: 1000,
        });
        updatedRequest = {
          ...request,
          internalNotes: [
            ...(request.internalNotes || []),
            {
              note,
              at: now,
              admin: req.adminEmail || req.adminUid || "admin",
            },
          ].slice(-30),
          updatedAt: now,
        };
        transaction.update(requestRef, updatedRequest);
        return;
      }

      if (action === "set_risk") {
        if (typeof req.body?.riskFlag !== "boolean") {
          throw routeError("Nilai tanda risiko tidak valid.");
        }
        const reason = cleanText(req.body?.riskReason || "", {
          label: "Alasan risiko",
          min: req.body.riskFlag ? 5 : 0,
          max: 500,
        });
        updatedRequest = {
          ...request,
          customerRiskFlag: req.body.riskFlag,
          customerRiskReason: reason,
          customerRiskUpdatedAt: now,
          updatedAt: now,
        };
        const profileRef = db
          .collection("customerRiskProfiles")
          .doc(riskProfileId(request.customerPhoneNormalized));
        transaction.update(requestRef, updatedRequest);
        transaction.set(
          profileRef,
          {
            riskFlag: req.body.riskFlag,
            reason,
            phoneLast4: String(request.customerPhoneNormalized || "").slice(-4),
            updatedAt: now,
            updatedBy: req.adminEmail || req.adminUid || "admin",
          },
          { merge: true }
        );
        return;
      }

      const nextStatus = resolveReturnStatusTransition(request.status, action);
      if (!nextStatus) {
        throw routeError(
          "Tindakan tidak sesuai dengan status pengajuan saat ini.",
          409,
          "INVALID_RETURN_STATUS"
        );
      }

      let message = "";
      const updates = {};

      if (action === "request_info" || action === "reject") {
        message = cleanText(req.body?.message, {
          label: action === "reject" ? "Alasan penolakan" : "Permintaan informasi",
          min: 5,
          max: 1000,
        });
        updates.latestAdminMessage = message;
      }

      if (action === "approve") {
        const resolution = String(req.body?.resolution || "");
        if (!isReturnResolution(resolution)) {
          throw routeError("Jenis penyelesaian tidak valid.");
        }
        const returnRequired = req.body?.returnRequired === true;
        const returnInstructions = returnRequired
          ? cleanText(req.body?.returnInstructions, {
              label: "Instruksi retur",
              min: 10,
              max: 1200,
            })
          : "";
        const refundAmount = resolution === "refund" ? Number(req.body?.refundAmount || 0) : 0;
        if (
          resolution === "refund" &&
          (!Number.isFinite(refundAmount) ||
            refundAmount < 1 ||
            refundAmount > Number(request.orderAmount || 0))
        ) {
          throw routeError("Nominal refund harus lebih dari 0 dan tidak melebihi total pesanan.");
        }
        message = cleanText(req.body?.message || "", {
          label: "Pesan keputusan",
          min: 0,
          max: 1000,
        });
        Object.assign(updates, {
          resolution,
          returnRequired,
          returnInstructions,
          refundAmount,
          approvedAt: now,
          latestAdminMessage:
            message ||
            (returnRequired
              ? "Pengajuan disetujui. Ikuti instruksi retur sebelum mengirim barang."
              : "Pengajuan disetujui dan sedang diproses."),
        });
        message = updates.latestAdminMessage;
      }

      if (action === "mark_return_received") {
        updates.returnShipment = {
          ...(request.returnShipment || {}),
          receivedAt: now,
        };
        updates.returnReceivedAt = now;
      }

      if (action === "complete") {
        if (request.returnRequired === true && request.status !== "return_received") {
          throw routeError(
            "Tunggu sampai barang retur diterima sebelum menyelesaikan pengajuan.",
            409,
            "RETURN_NOT_RECEIVED"
          );
        }
        message = cleanText(req.body?.message || "", {
          label: "Catatan penyelesaian",
          min: 0,
          max: 1000,
        });
        if (request.resolution === "refund") {
          updates.refundReference = cleanText(req.body?.refundReference, {
            label: "Referensi refund",
            min: 3,
            max: 120,
          });
        } else if (request.resolution === "replacement") {
          updates.replacementTracking = cleanText(req.body?.replacementTracking, {
            label: "Resi penggantian",
            min: 3,
            max: 120,
          });
        } else {
          throw routeError("Keputusan pengajuan belum ditetapkan.");
        }
        updates.completedAt = now;
        updates.latestAdminMessage =
          message ||
          (request.resolution === "refund"
            ? "Refund telah diproses dan pengajuan dinyatakan selesai."
            : "Barang pengganti telah dikirim dan pengajuan dinyatakan selesai.");
        message = updates.latestAdminMessage;
      }

      updatedRequest = {
        ...request,
        ...updates,
        status: nextStatus,
        updatedAt: now,
        statusHistory: [
          ...(request.statusHistory || []),
          {
            status: nextStatus,
            at: now,
            actor: "admin",
            admin: req.adminEmail || req.adminUid || "admin",
            publicNote: statusPublicNote(nextStatus, message),
          },
        ],
      };
      transaction.update(requestRef, updatedRequest);
      transaction.update(orderRef, {
        returnStatus: nextStatus,
        returnResolution: updatedRequest.resolution || "",
        updatedAt: now,
      });
      notifyStatus = nextStatus;
    });

    if (notifyStatus) void notifyReturnStatus(updatedRequest, notifyStatus);
    return res.status(200).json({
      message: "Pengajuan berhasil diperbarui.",
      request: updatedRequest,
    });
  } catch (error) {
    log("warn", "returns", "admin return update failed", {
      error: error.message,
      code: error.code || "",
    });
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Gagal memperbarui pengajuan.",
      code: error.code || "RETURN_UPDATE_FAILED",
    });
  }
});

export default router;
