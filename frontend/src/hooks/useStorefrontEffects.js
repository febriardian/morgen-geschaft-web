// useStorefrontEffects.js
// Efek UI mandiri yang diekstrak dari App.jsx: reset scroll halaman produk,
// pemulihan posisi scroll, reveal section, mode compact GesaChat, transisi
// kembali-ke-beranda, dan scroll ke hash section. Logika dipindah apa adanya —
// hanya input yang dijadikan argumen eksplisit agar App.jsx lebih ramping.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { internalSectionId } from "../i18n/locale.js";

// Transisi "kembali ke beranda" tampil singkat (720ms) saat navigasi balik.
export function useHomeReturnTransition(routeKey, location) {
  const [showHomeReturnTransition, setShowHomeReturnTransition] = useState(false);

  useEffect(() => {
    const shouldShow = routeKey === "home" && location.state?.returnTransition === "home";
    if (!shouldShow) {
      setShowHomeReturnTransition(false);
      return undefined;
    }

    setShowHomeReturnTransition(true);
    const timer = window.setTimeout(() => setShowHomeReturnTransition(false), 720);
    return () => window.clearTimeout(timer);
  }, [location.key, location.pathname, location.state?.returnTransition]);

  return showHomeReturnTransition;
}

// Detail produk selalu dimulai dari paling atas.
export function useProductPageScrollReset(isProductPage, locationKey, productId, selectedId) {
  useLayoutEffect(() => {
    if (!isProductPage) return undefined;

    const scrollTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollTop();

    let secondFrame = null;
    const firstFrame = window.requestAnimationFrame(() => {
      scrollTop();
      secondFrame = window.requestAnimationFrame(scrollTop);
    });
    const settleTimer = window.setTimeout(scrollTop, 140);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
    };
  }, [isProductPage, locationKey, productId, selectedId]);
}

// Pulihkan section atau posisi scroll ketika kembali dari halaman lain.
export function useScrollRestoration(location, productsLoading, blogPostsLength) {
  useLayoutEffect(() => {
    const restoreSection = String(location.state?.restoreSection || "").trim();
    const restoreSectionOffset = Number(location.state?.restoreSectionOffset);
    const restoreScrollY = Number(location.state?.restoreScrollY);

    let secondFrame = null;
    let retryTimer = null;

    const restore = () => {
      if (restoreSection) {
        const target = document.getElementById(restoreSection);
        if (target) {
          const absoluteTop = target.getBoundingClientRect().top + window.scrollY;
          const targetTop = Number.isFinite(restoreSectionOffset) && restoreSectionOffset >= 0
            ? Math.max(0, absoluteTop + restoreSectionOffset)
            : Math.max(0, absoluteTop - 76);
          window.scrollTo({ top: targetTop, left: 0, behavior: "auto" });
          return true;
        }
        return false;
      }

      if (Number.isFinite(restoreScrollY) && restoreScrollY >= 0) {
        window.scrollTo({ top: restoreScrollY, left: 0, behavior: "auto" });
        return true;
      }

      return false;
    };

    if (!restoreSection && (!Number.isFinite(restoreScrollY) || restoreScrollY < 0)) {
      return undefined;
    }

    const firstFrame = window.requestAnimationFrame(() => {
      restore();
      secondFrame = window.requestAnimationFrame(() => {
        if (!restore()) {
          retryTimer = window.setTimeout(restore, 120);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [location.key, productsLoading, blogPostsLength]);
}

// GesaChat masuk mode compact setelah scroll melewati 320px.
export function useGesaCompact(pathname, search, view) {
  const [gesaCompact, setGesaCompact] = useState(false);

  useEffect(() => {
    let frameId = null;

    const updateGesaCompact = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setGesaCompact(window.scrollY > 320);
      });
    };

    updateGesaCompact();
    window.addEventListener("scroll", updateGesaCompact, { passive: true });
    window.addEventListener("resize", updateGesaCompact);

    return () => {
      window.removeEventListener("scroll", updateGesaCompact);
      window.removeEventListener("resize", updateGesaCompact);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [pathname, search, view]);

  return gesaCompact;
}

// Animasi reveal untuk setiap section utama (kecuali di dalam admin shell).
export function useSectionReveal(view, pathname, search, selected) {
  useLayoutEffect(() => {
    if (view === "admin") return undefined;

    const root = document.getElementById("root") || document.body;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observed = new WeakSet();
    let frameId = null;
    let lateTimer = null;
    let settleTimer = null;

    const observer = prefersReducedMotion
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            });
          },
          { threshold: 0.08, rootMargin: "0px 0px -7% 0px" }
        );

    const registerSections = () => {
      frameId = null;
      const sections = Array.from(root.querySelectorAll("section, footer")).filter((element) => {
        if (element.closest(".admin-shell")) return false;
        if (element.tagName === "SECTION" && element.parentElement?.closest("section")) return false;
        return true;
      });

      sections.forEach((section) => {
        if (observed.has(section)) return;
        observed.add(section);
        section.classList.add("mg-section-reveal");

        if (prefersReducedMotion) {
          section.classList.add("is-visible");
        } else {
          observer.observe(section);
        }
      });
    };

    const scheduleRegister = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(registerSections);
    };

    scheduleRegister();
    // React state updates used to trigger a root-wide MutationObserver that
    // repeatedly queried and restyled the full page. A small number of bounded
    // passes covers async sections without creating forced-reflow churn.
    lateTimer = window.setTimeout(scheduleRegister, 260);
    settleTimer = window.setTimeout(scheduleRegister, 1200);

    return () => {
      observer?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
      if (lateTimer) window.clearTimeout(lateTimer);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [pathname, search, view, selected]);
}

// Navigasi section beranda memakai hash bersih (mis. /#promo) dan mengoreksi
// posisi setelah produk selesai dimuat (layout stabil).
export function useHashSectionScroll(locale, location, productsLoading) {
  const pendingScrollRef = useRef(null);

  useEffect(() => {
    const scrollTarget = internalSectionId(locale, location.hash);
    if (scrollTarget) {
      pendingScrollRef.current = scrollTarget;
      const element = document.getElementById(scrollTarget);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.pathname, location.hash, locale]);

  useEffect(() => {
    if (productsLoading || !pendingScrollRef.current) return;
    const target = pendingScrollRef.current;
    pendingScrollRef.current = null;
    setTimeout(() => {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [productsLoading]);
}
