import fs from "node:fs/promises";
import path from "node:path";
import { initializeApp, getApps } from "firebase-admin/app";
import {
  GeoPoint,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";

const backupPath = process.argv[2];

if (!backupPath) {
  console.error("Pemakaian: node firestore-restore-emulator.mjs <path-backup.json>");
  process.exit(1);
}

const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || "").trim();
const allowedHosts = new Set(["127.0.0.1:8080", "localhost:8080"]);

if (!allowedHosts.has(emulatorHost)) {
  console.error(
    "DIBATALKAN: FIRESTORE_EMULATOR_HOST harus 127.0.0.1:8080 atau localhost:8080. " +
      "Script ini sengaja menolak koneksi ke Firestore production.",
  );
  process.exit(2);
}

const projectId = String(
  process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    "demo-morgen-restore",
).trim();

if (!projectId.startsWith("demo-")) {
  console.error(
    `DIBATALKAN: projectId harus diawali demo-. Nilai saat ini: ${projectId || "(kosong)"}`,
  );
  process.exit(3);
}

const OMIT_VALUE = Symbol("omit-firestore-value");

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function reviveFirestoreValue(value, db, insideArray = false) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const revived = reviveFirestoreValue(item, db, true);
      return revived === OMIT_VALUE ? null : revived;
    });
  }

  if (!value || typeof value !== "object") return value;

  if (value.__type === "undefined") {
    return insideArray ? null : OMIT_VALUE;
  }

  if (value.__type === "timestamp") {
    if (typeof value.iso === "string" && value.iso) {
      const parsed = new Date(value.iso);
      if (!Number.isNaN(parsed.getTime())) return Timestamp.fromDate(parsed);
    }

    const seconds = Number(value.seconds);
    const nanoseconds = Number(value.nanoseconds || 0);
    if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
      return new Timestamp(seconds, nanoseconds);
    }
  }

  if (value.__type === "geopoint") {
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return new GeoPoint(latitude, longitude);
    }
  }

  if (value.__type === "document-reference" && typeof value.path === "string") {
    return db.doc(value.path);
  }

  if (value.__type === "date" && typeof value.iso === "string") {
    const parsed = new Date(value.iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (value.__type === "bytes" && typeof value.base64 === "string") {
    return Buffer.from(value.base64, "base64");
  }

  // Kompatibilitas dengan backup lama yang menyimpan Timestamp tanpa __type.
  const keys = Object.keys(value);
  const seconds = value._seconds ?? value.seconds;
  const nanoseconds = value._nanoseconds ?? value.nanoseconds;

  if (
    Number.isFinite(Number(seconds)) &&
    Number.isFinite(Number(nanoseconds)) &&
    keys.every((key) =>
      ["_seconds", "seconds", "_nanoseconds", "nanoseconds"].includes(key),
    )
  ) {
    return new Timestamp(Number(seconds), Number(nanoseconds));
  }

  if (
    Number.isFinite(Number(value.latitude)) &&
    Number.isFinite(Number(value.longitude)) &&
    keys.every((key) => ["latitude", "longitude"].includes(key))
  ) {
    return new GeoPoint(Number(value.latitude), Number(value.longitude));
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const revived = reviveFirestoreValue(item, db, false);
    if (revived !== OMIT_VALUE) result[key] = revived;
  }
  return result;
}

function getDocumentsObject(rawCollection) {
  if (!rawCollection || typeof rawCollection !== "object") return {};

  // Format backup Morgen Geschäft:
  // { path, documentCount, documents: { docId: { path, data, subcollections } } }
  if (isPlainObject(rawCollection.documents)) return rawCollection.documents;

  // Dukungan format alternatif.
  if (Array.isArray(rawCollection.documents)) {
    return Object.fromEntries(
      rawCollection.documents.map((item, index) => {
        const id = String(item?.id ?? item?._id ?? item?.docId ?? index).trim();
        return [id, item];
      }),
    );
  }

  if (Array.isArray(rawCollection.docs)) {
    return Object.fromEntries(
      rawCollection.docs.map((item, index) => {
        const id = String(item?.id ?? item?._id ?? item?.docId ?? index).trim();
        return [id, item];
      }),
    );
  }

  return rawCollection;
}

function normalizeDocumentEntry(documentId, rawDocument, fallbackCollectionPath, db) {
  if (!rawDocument || typeof rawDocument !== "object" || Array.isArray(rawDocument)) {
    throw new Error(
      `Dokumen ${fallbackCollectionPath}/${documentId} tidak memiliki object data yang valid.`,
    );
  }

  const documentPath = String(
    rawDocument.path || `${fallbackCollectionPath}/${documentId}`,
  ).trim();

  const sourceData = isPlainObject(rawDocument.data)
    ? rawDocument.data
    : Object.fromEntries(
        Object.entries(rawDocument).filter(
          ([key]) => !["id", "_id", "docId", "path", "subcollections"].includes(key),
        ),
      );

  const data = reviveFirestoreValue(sourceData, db);
  if (!isPlainObject(data)) {
    throw new Error(`Data dokumen ${documentPath} bukan object biasa.`);
  }

  const subcollections = isPlainObject(rawDocument.subcollections)
    ? rawDocument.subcollections
    : {};

  return { documentPath, data, subcollections };
}

async function commitDocuments(db, documents) {
  for (let start = 0; start < documents.length; start += 400) {
    const chunk = documents.slice(start, start + 400);
    const batch = db.batch();

    for (const document of chunk) {
      batch.set(db.doc(document.documentPath), document.data);
    }

    await batch.commit();
  }
}

async function restoreCollection(db, rawCollection, fallbackCollectionPath, summary) {
  const collectionPath = String(rawCollection?.path || fallbackCollectionPath).trim();
  const rawDocuments = getDocumentsObject(rawCollection);
  const documents = [];

  for (const [documentId, rawDocument] of Object.entries(rawDocuments)) {
    // Jangan memperlakukan metadata collection sebagai dokumen.
    if (["path", "documentCount", "documents", "docs"].includes(documentId)) continue;

    documents.push(
      normalizeDocumentEntry(documentId, rawDocument, collectionPath, db),
    );
  }

  await commitDocuments(db, documents);

  const restoredSnapshot = await db.collection(collectionPath).get();
  summary.push({
    collection: collectionPath,
    backupDocuments: documents.length,
    emulatorDocuments: restoredSnapshot.size,
    match: documents.length === restoredSnapshot.size,
  });

  for (const document of documents) {
    for (const [subcollectionName, rawSubcollection] of Object.entries(
      document.subcollections,
    )) {
      const fallbackSubcollectionPath = `${document.documentPath}/${subcollectionName}`;
      await restoreCollection(
        db,
        rawSubcollection,
        fallbackSubcollectionPath,
        summary,
      );
    }
  }

  return documents.length;
}

async function main() {
  const absolutePath = path.resolve(backupPath);
  const text = await fs.readFile(absolutePath, "utf8");
  const backup = JSON.parse(text);

  if (!isPlainObject(backup.collections)) {
    throw new Error("Format backup tidak valid: properti collections tidak ditemukan.");
  }

  if (getApps().length === 0) initializeApp({ projectId });
  const db = getFirestore();

  console.log("Restore aman ke Firestore Emulator");
  console.log(`Backup    : ${absolutePath}`);
  console.log(`Emulator  : ${emulatorHost}`);
  console.log(`Project ID: ${projectId}`);
  console.log("");

  let totalWritten = 0;
  const summary = [];

  for (const [collectionName, rawCollection] of Object.entries(backup.collections)) {
    totalWritten += await restoreCollection(
      db,
      rawCollection,
      collectionName,
      summary,
    );
  }

  console.table(summary);

  const failed = summary.filter((item) => !item.match);
  if (failed.length > 0) {
    throw new Error(`${failed.length} collection mempunyai jumlah dokumen yang tidak cocok.`);
  }

  console.log(`\nRESTORE TEST BERHASIL: ${totalWritten} dokumen root ditulis ke emulator.`);
  console.log("Subcollection juga dipulihkan dan diperiksa secara terpisah pada tabel.");
  console.log("Tidak ada data production yang diubah.");
}

main().catch((error) => {
  console.error("\nRESTORE TEST GAGAL:", error?.stack || error?.message || error);
  process.exitCode = 1;
});
