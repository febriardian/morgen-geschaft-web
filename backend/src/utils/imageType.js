// utils/imageType.js
// Deteksi tipe gambar dari magic bytes — MIME dari client tidak bisa dipercaya.
// Dipisah dari routes/admin.js agar bisa diuji langsung.

export function sniffImageType(buf) {
  if (!buf || typeof buf.length !== "number") return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
