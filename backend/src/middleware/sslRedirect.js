// middleware/sslRedirect.js
// Enforce HTTPS for real production hosts while keeping local development usable.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function requestHostname(req) {
  const raw = String(req.hostname || req.headers.host || "").toLowerCase();
  return raw.replace(/^\[/, "").replace(/\]$/, "").split(":")[0];
}

export function requireSSL(req, res, next) {
  const configured = process.env.ENFORCE_HTTPS;
  const shouldEnforce = configured == null
    ? process.env.NODE_ENV === "production"
    : configured === "true";

  if (!shouldEnforce) return next();

  // Vite and the local Nginx proxy use HTTP. Never redirect local API calls
  // to https://localhost:3002 because that endpoint has no local TLS server.
  if (LOCAL_HOSTS.has(requestHostname(req))) return next();

  if (req.path === "/api/health") return next();

  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();

  if (proto === "https") return next();

  if (req.path.includes("midtrans-notification")) {
    return res.status(403).json({ error: "HTTPS required for webhooks." });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl || req.url}`);
  }

  return res.status(403).json({ error: "HTTPS required." });
}
