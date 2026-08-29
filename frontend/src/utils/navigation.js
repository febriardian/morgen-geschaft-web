import { getLocaleFromPath, getStoredLocale, routePath } from "../i18n/locale.js";

// Simpan konteks halaman sebelum berpindah ke halaman standalone.
// Selain posisi scroll, simpan section aktif dan offset di dalam section agar
// posisi tetap akurat walaupun tinggi konten beranda berubah setelah data dimuat.
function captureReturnContext(location) {
  const fallbackHome = routePath(getLocaleFromPath(location?.pathname) || getStoredLocale(), "home");
  const pathname = String(location?.pathname || fallbackHome);
  const search = String(location?.search || "");
  const from = `${pathname}${search}`.startsWith("/") ? `${pathname}${search}` : fallbackHome;
  const scrollY = typeof window !== "undefined" ? Math.max(0, Number(window.scrollY || 0)) : 0;

  let fromSection = "";
  let sectionOffset = 0;

  if (typeof document !== "undefined") {
    const marker = 112;
    const sections = Array.from(document.querySelectorAll("section[id], footer[id]"));
    let activeSection = null;

    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom > marker) {
        activeSection = section;
        break;
      }
      if (rect.top <= marker) activeSection = section;
    }

    if (activeSection?.id) {
      const absoluteTop = activeSection.getBoundingClientRect().top + scrollY;
      fromSection = activeSection.id;
      sectionOffset = Math.max(0, scrollY - absoluteTop);
    }
  }

  return { from, scrollY, fromSection, sectionOffset };
}

function returnToCapturedContext(navigate, navigationState, fallbackSection = "") {
  const rawFrom = String(navigationState?.from || "");
  const locale = getLocaleFromPath(rawFrom) || getLocaleFromPath(window.location.pathname) || getStoredLocale();
  const fallbackHome = routePath(locale, "home");
  const safeFrom = rawFrom.startsWith("/") ? rawFrom : fallbackHome;
  const from = safeFrom === "/" || safeFrom.startsWith("/#") ? fallbackHome : safeFrom;
  const savedScrollY = Number(navigationState?.scrollY);
  const savedSection = String(navigationState?.fromSection || "").trim();
  const savedSectionOffset = Number(navigationState?.sectionOffset);
  const destinationState = {};

  if (savedSection) {
    destinationState.restoreSection = savedSection;
    if (Number.isFinite(savedSectionOffset) && savedSectionOffset >= 0) {
      destinationState.restoreSectionOffset = savedSectionOffset;
    }
  } else if (Number.isFinite(savedScrollY) && savedScrollY >= 0) {
    destinationState.restoreScrollY = savedScrollY;
  } else if (fallbackSection) {
    destinationState.restoreSection = fallbackSection;
  }

  if (from === fallbackHome) destinationState.returnTransition = "home";
  navigate(from, { state: destinationState });
}

export { captureReturnContext, returnToCapturedContext };
