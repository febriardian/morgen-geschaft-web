// services/logger.js
// Structured logging — JSON per line, parseable oleh monitoring tools

export function log(level, context, message, extra = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ctx: context,
    msg: message,
    ...extra,
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}
