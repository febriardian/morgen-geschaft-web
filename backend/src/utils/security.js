import crypto from "node:crypto";

export function hasAdminClaim(decodedToken) {
  return decodedToken?.admin === true;
}

export function hasAdminMfa(decodedToken) {
  return decodedToken?.email_verified === true
    && typeof decodedToken?.firebase?.sign_in_second_factor === "string"
    && decodedToken.firebase.sign_in_second_factor.length > 0;
}

export function verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, receivedSignature) {
  if (![orderId, statusCode, grossAmount, serverKey, receivedSignature].every((value) => typeof value === "string" && value.length > 0)) {
    return false;
  }
  const expected = crypto.createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function paymentAmountMatches(expectedAmount, receivedAmount) {
  const expected = Number(expectedAmount);
  const received = Number(receivedAmount);
  return Number.isFinite(expected)
    && Number.isFinite(received)
    && expected >= 0
    && received >= 0
    && Math.abs(expected - received) < 0.01;
}

export function resolveOrderStatusTransition(currentStatus, transactionStatus) {
  const current = String(currentStatus || "").toLowerCase();
  const remote = String(transactionStatus || "").toLowerCase();

  if (["capture", "settlement"].includes(remote)) {
    return ["expired", "cancelled", "failed"].includes(current) ? null : "paid";
  }
  if (current === "paid") return null;
  if (remote === "expire") return "expired";
  if (remote === "cancel") return "cancelled";
  if (["deny", "failure"].includes(remote)) return "failed";
  return null;
}

export function isValidReviewPhotoDataUrl(value, maxLength = 650000) {
  return typeof value === "string"
    && value.length <= maxLength
    && /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}
