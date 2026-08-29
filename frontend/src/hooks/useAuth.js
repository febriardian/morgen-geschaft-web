// hooks/useAuth.js
// Extracted from App.jsx — manages Firebase Auth state for admin users.

import { useState, useEffect } from "react";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    let started = false;
    let unsubAuth = () => {};
    let timeoutId = null;
    let idleId = null;

    const startAuthMonitor = async () => {
      if (started) return;
      started = true;
      try {
        const { subscribeToAdminAuth } = await import("../services/firebaseAuth.js");

        if (!active) return;

        unsubAuth = subscribeToAdminAuth(async (fbUser) => {
          if (!fbUser) {
            if (active) {
              setUser(null);
              setCustomer(null);
              setAuthChecked(true);
            }
            return;
          }

          try {
            // The sign-in/restore flow already provides a valid token. Forcing a
            // refresh here caused two extra network round trips on every reload.
            const tokenResult = await fbUser.getIdTokenResult();
            const claims = tokenResult?.claims || {};
            const isAdmin = claims.admin === true;
            const hasVerifiedEmail = fbUser.emailVerified === true;
            const requiresAdminMfa = import.meta.env.VITE_REQUIRE_ADMIN_MFA === "true";
            const hasSecondFactor = Boolean(claims.firebase?.sign_in_second_factor);
            // Verifikasi email tetap wajib selama rollout, meskipun pemaksaan
            // TOTP belum dinyalakan. Akun lama tidak boleh langsung membuka
            // dashboard ketika sesi browser dipulihkan.
            const allowed = isAdmin && hasVerifiedEmail && (!requiresAdminMfa || hasSecondFactor);
            const isCustomer = claims.customer === true && !isAdmin;
            if (active) {
              setUser(allowed ? (fbUser.email || "Admin") : null);
              setCustomer(isCustomer
                ? { uid: fbUser.uid, email: fbUser.email || "" }
                : null);
            }
            if (isCustomer) {
              void import("../services/customerAuth.js")
                .then(({ loadCustomerAccount }) => loadCustomerAccount())
                .catch(() => {});
            }
          } catch (err) {
            console.error("Gagal memverifikasi role admin:", err);
            if (active) setUser(null);
          } finally {
            if (active) setAuthChecked(true);
          }
        });
      } catch (err) {
        console.error("Gagal memuat Firebase Auth:", err);
        if (active) setAuthChecked(true);
      }
    };

    // Account intent starts Firebase immediately. Otherwise restore an existing
    // session as soon as the browser is idle, without blocking first paint.
    window.addEventListener("mg:admin-auth-request", startAuthMonitor);
    window.addEventListener("mg:customer-auth-request", startAuthMonitor);
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(startAuthMonitor, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(startAuthMonitor, 1200);
    }

    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      window.removeEventListener("mg:admin-auth-request", startAuthMonitor);
      window.removeEventListener("mg:customer-auth-request", startAuthMonitor);
      unsubAuth();
    };
  }, []);

  return { user, customer, authChecked };
}
