import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  GeoPoint,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendDir, "..");

dotenv.config({
  path: path.join(backendDir, ".env"),
});

const outputDir = path.join(projectRoot, "storage", "backups", "firestore");

const retentionDays = Math.max(
  1,
  Number.parseInt(
    process.env.FIRESTORE_BACKUP_RETENTION_DAYS || "30",
    10,
  ) || 30,
);

const serviceAccountBase64 =
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!serviceAccountBase64) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_BASE64 tidak ditemukan di backend/.env",
  );
}

let serviceAccount;

try {
  const decoded = Buffer.from(
    serviceAccountBase64,
    "base64",
  ).toString("utf8");

  serviceAccount = JSON.parse(decoded);
} catch (error) {
  throw new Error(
    `FIREBASE_SERVICE_ACCOUNT_BASE64 tidak valid: ${error.message}`,
  );
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

function serializeFirestoreValue(value) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return {
      __type: "undefined",
    };
  }

  if (value instanceof Timestamp) {
    return {
      __type: "timestamp",
      iso: value.toDate().toISOString(),
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  if (value instanceof GeoPoint) {
    return {
      __type: "geopoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (
    value?.constructor?.name === "DocumentReference" &&
    typeof value.path === "string"
  ) {
    return {
      __type: "document-reference",
      path: value.path,
    };
  }

  if (value instanceof Date) {
    return {
      __type: "date",
      iso: value.toISOString(),
    };
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type: "bytes",
      base64: value.toString("base64"),
    };
  }

  if (value instanceof Uint8Array) {
    return {
      __type: "bytes",
      base64: Buffer.from(value).toString("base64"),
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  if (typeof value === "object") {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = serializeFirestoreValue(item);
    }

    return result;
  }

  return value;
}

let totalDocuments = 0;
let totalCollections = 0;

async function exportCollection(collectionRef) {
  totalCollections += 1;

  console.log(`Membaca collection: ${collectionRef.path}`);

  const snapshot = await collectionRef.get();
  const documents = {};

  for (const documentSnapshot of snapshot.docs) {
    totalDocuments += 1;

    const subcollectionRefs =
      await documentSnapshot.ref.listCollections();

    const subcollections = {};

    for (const subcollectionRef of subcollectionRefs) {
      subcollections[subcollectionRef.id] =
        await exportCollection(subcollectionRef);
    }

    documents[documentSnapshot.id] = {
      path: documentSnapshot.ref.path,
      data: serializeFirestoreValue(
        documentSnapshot.data(),
      ),
      subcollections,
    };
  }

  return {
    path: collectionRef.path,
    documentCount: snapshot.size,
    documents,
  };
}

async function removeOldBackups() {
  const entries = await fs.readdir(outputDir, {
    withFileTypes: true,
  });

  const expirationTime =
    Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !entry.name.startsWith("firestore-") ||
      !entry.name.endsWith(".json")
    ) {
      continue;
    }

    const fullPath = path.join(outputDir, entry.name);
    const stats = await fs.stat(fullPath);

    if (stats.mtimeMs < expirationTime) {
      await fs.unlink(fullPath);
      console.log(`Backup lama dihapus: ${entry.name}`);
    }
  }
}

async function createBackup() {
  await fs.mkdir(outputDir, {
    recursive: true,
  });

  const rootCollections = await db.listCollections();

  const backup = {
    metadata: {
      formatVersion: 1,
      projectId: serviceAccount.project_id,
      createdAt: new Date().toISOString(),
      retentionDays,
    },
    collections: {},
  };

  for (const collectionRef of rootCollections) {
    backup.collections[collectionRef.id] =
      await exportCollection(collectionRef);
  }

  backup.metadata.totalCollections = totalCollections;
  backup.metadata.totalDocuments = totalDocuments;

  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");

  const fileName = `firestore-${timestamp}.json`;
  const finalPath = path.join(outputDir, fileName);
  const temporaryPath = `${finalPath}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(backup, null, 2),
    "utf8",
  );

  await fs.rename(temporaryPath, finalPath);
  await removeOldBackups();

  const stats = await fs.stat(finalPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log("");
  console.log("Backup Firestore selesai.");
  console.log(`File       : ${finalPath}`);
  console.log(`Collection : ${totalCollections}`);
  console.log(`Dokumen    : ${totalDocuments}`);
  console.log(`Ukuran     : ${sizeMB} MB`);
}

createBackup()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error("");
    console.error("Backup Firestore gagal:");
    console.error(error);
    process.exitCode = 1;
  });