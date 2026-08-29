import { useState, useEffect, useCallback, useRef } from "react";
import { PAGE_ROUTE_NAVIGATE_DELAY, PAGE_ROUTE_TRANSITION_DURATION } from "../config/constants.js";



// Transisi route bersama untuk katalog, ulasan, daftar artikel, dan detail artikel.
// Metadata transisi ikut dikirim lewat location.state agar animasi tetap berlanjut
// ketika komponen sumber dilepas dan komponen halaman tujuan mulai dirender.
function usePageRouteTransition(location, navigate) {
  const [routeTransition, setRouteTransition] = useState({
    visible: false,
    label: "Menyiapkan halaman",
  });
  const routeTransitionTimersRef = useRef([]);

  const clearRouteTransitionTimers = useCallback(() => {
    routeTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    routeTransitionTimersRef.current = [];
  }, []);

  useEffect(() => {
    const incoming = location.state?.routeTransition;
    const startedAt = Number(incoming?.startedAt || 0);
    const label = String(incoming?.label || "Menyiapkan halaman");
    const elapsed = startedAt > 0 ? Date.now() - startedAt : PAGE_ROUTE_TRANSITION_DURATION;
    const remaining = Math.max(0, PAGE_ROUTE_TRANSITION_DURATION - elapsed);

    if (!startedAt || remaining <= 0) return undefined;

    clearRouteTransitionTimers();
    setRouteTransition({ visible: true, label });

    const closeTimer = window.setTimeout(() => {
      setRouteTransition({ visible: false, label });
      routeTransitionTimersRef.current = [];
    }, remaining);
    routeTransitionTimersRef.current = [closeTimer];

    return clearRouteTransitionTimers;
  }, [
    location.key,
    location.state?.routeTransition?.startedAt,
    location.state?.routeTransition?.label,
    clearRouteTransitionTimers,
  ]);

  useEffect(() => clearRouteTransitionTimers, [clearRouteTransitionTimers]);

  const navigateWithRouteTransition = useCallback((destination, options = {}, label = "Menyiapkan halaman") => {
    clearRouteTransitionTimers();

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      navigate(destination, options);
      return;
    }

    const routeTransitionMeta = { label, startedAt: Date.now() };
    setRouteTransition({ visible: true, label });

    const navigateTimer = window.setTimeout(() => {
      navigate(destination, {
        ...options,
        state: {
          ...(options.state || {}),
          routeTransition: routeTransitionMeta,
        },
      });
    }, PAGE_ROUTE_NAVIGATE_DELAY);

    const closeTimer = window.setTimeout(() => {
      setRouteTransition({ visible: false, label });
      routeTransitionTimersRef.current = [];
    }, PAGE_ROUTE_TRANSITION_DURATION);

    routeTransitionTimersRef.current = [navigateTimer, closeTimer];
  }, [navigate, clearRouteTransitionTimers]);

  return { routeTransition, navigateWithRouteTransition };
}

export { usePageRouteTransition };

