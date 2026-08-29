import { useState, useEffect } from "react";
import { paymentDate } from "../utils/paymentStorage.js";



function usePaymentCountdown(expiresAt) {
  const [now, setNow] = useState(Date.now());
  const expiresAtMs = paymentDate(expiresAt)?.getTime() || 0;

  useEffect(() => {
    if (!expiresAtMs || expiresAtMs <= Date.now()) {
      setNow(Date.now());
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAtMs]);

  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  return {
    remainingMs,
    expired: Boolean(expiresAtMs && remainingMs <= 0),
    hasExpiry: Boolean(expiresAtMs),
  };
}

export { usePaymentCountdown };

