import fs from "node:fs/promises";
import { v2 as cloudinary } from "cloudinary";
import { log } from "./logger.js";

const DEFAULT_ROOT_FOLDER = "morgen-geschaft";
const LOCAL_UPLOAD_PATTERN = /^\/uploads\/[A-Za-z0-9._-]+$/;

function cleanEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanFolderSegment(value, fallback) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}

export function getCloudinaryConfig(env = process.env) {
  const cloudName = cleanEnvValue(env.CLOUDINARY_CLOUD_NAME);
  const apiKey = cleanEnvValue(env.CLOUDINARY_API_KEY);
  const apiSecret = cleanEnvValue(env.CLOUDINARY_API_SECRET);
  const values = {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    cloudName,
    apiKey,
    apiSecret,
    requested: Object.values(values).some(Boolean),
    configured: missing.length === 0,
    missing,
    rootFolder: cleanFolderSegment(env.CLOUDINARY_FOLDER, DEFAULT_ROOT_FOLDER),
  };
}

export function getCloudinaryStatus(env = process.env) {
  const config = getCloudinaryConfig(env);
  return {
    requested: config.requested,
    configured: config.configured,
    status: config.configured
      ? "configured"
      : config.requested
        ? "misconfigured"
        : "disabled",
    missing: config.missing,
    rootFolder: config.rootFolder,
  };
}

function configureClient(client, config) {
  client.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
}

export function isAllowedUploadedImageUrl(value, env = process.env) {
  if (typeof value !== "string" || !value) return false;
  if (LOCAL_UPLOAD_PATTERN.test(value)) return true;

  const { cloudName } = getCloudinaryConfig(env);
  if (!cloudName) return false;

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "res.cloudinary.com" ||
      parsed.port ||
      parsed.username ||
      parsed.password
    ) {
      return false;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    return (
      parts.length >= 5 &&
      parts[0] === cloudName &&
      parts[1] === "image" &&
      parts[2] === "upload"
    );
  } catch {
    return false;
  }
}

export async function verifyCloudinaryConnection(options = {}) {
  const env = options.env || process.env;
  const client = options.client || cloudinary;
  const config = getCloudinaryConfig(env);

  if (!config.configured) {
    return {
      ...getCloudinaryStatus(env),
      status: config.requested ? "misconfigured" : "disabled",
    };
  }

  try {
    configureClient(client, config);
    const result = await client.api.ping();
    if (String(result?.status || "").toLowerCase() !== "ok") {
      throw new Error("Cloudinary ping tidak mengembalikan status ok.");
    }
    return {
      ...getCloudinaryStatus(env),
      status: "ready",
    };
  } catch (error) {
    return {
      ...getCloudinaryStatus(env),
      status: "error",
      lastError: error?.message || "Cloudinary connection failed.",
    };
  }
}

export async function uploadImageWithFallback(file, options = {}, dependencies = {}) {
  const env = dependencies.env || process.env;
  const client = dependencies.client || cloudinary;
  const removeFile = dependencies.removeFile || fs.unlink;
  const logger = dependencies.logger || log;
  const config = getCloudinaryConfig(env);
  const localUrl = options.localUrl || `/uploads/${file.filename}`;
  const localResult = {
    url: localUrl,
    filename: file.filename,
    storage: "local",
    publicId: "",
  };

  if (!config.configured) {
    if (config.requested) {
      logger("warn", "cloudinary", "Cloudinary ENV belum lengkap; upload memakai penyimpanan lokal", {
        missing: config.missing,
      });
    }
    return localResult;
  }

  const folder = `${config.rootFolder}/${cleanFolderSegment(options.folder, "uploads")}`;

  try {
    configureClient(client, config);
    const result = await client.uploader.upload(file.path, {
      folder,
      resource_type: "image",
      type: "upload",
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      tags: Array.isArray(options.tags) ? options.tags.slice(0, 10) : [],
    });

    if (!result?.secure_url || !isAllowedUploadedImageUrl(result.secure_url, env)) {
      throw new Error("Cloudinary tidak mengembalikan URL gambar yang valid.");
    }

    try {
      await removeFile(file.path);
    } catch (error) {
      logger("warn", "cloudinary", "Upload berhasil, tetapi file lokal sementara gagal dihapus", {
        error: error?.message,
      });
    }

    return {
      url: result.secure_url,
      filename: file.filename,
      storage: "cloudinary",
      publicId: String(result.public_id || ""),
      width: Number(result.width || 0),
      height: Number(result.height || 0),
      format: String(result.format || ""),
      bytes: Number(result.bytes || 0),
    };
  } catch (error) {
    logger("warn", "cloudinary", "Upload Cloudinary gagal; file lokal dipertahankan sebagai fallback", {
      error: error?.message,
      folder,
    });
    return localResult;
  }
}

export async function deleteUploadedImage(publicId, dependencies = {}) {
  const env = dependencies.env || process.env;
  const client = dependencies.client || cloudinary;
  const logger = dependencies.logger || log;
  const config = getCloudinaryConfig(env);
  const normalizedPublicId = String(publicId || "").trim();
  const allowedPrefix = `${config.rootFolder}/`;

  if (
    !config.configured ||
    !normalizedPublicId ||
    !normalizedPublicId.startsWith(allowedPrefix)
  ) {
    return false;
  }

  try {
    configureClient(client, config);
    const result = await client.uploader.destroy(normalizedPublicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
    return ["ok", "not found"].includes(
      String(result?.result || "").toLowerCase(),
    );
  } catch (error) {
    logger(
      "warn",
      "cloudinary",
      "Gagal membersihkan upload Cloudinary yang tidak terpakai",
      {
        error: error?.message,
        publicId: normalizedPublicId,
      },
    );
    return false;
  }
}
