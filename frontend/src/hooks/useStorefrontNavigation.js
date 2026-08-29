// useStorefrontNavigation.js
// Handler navigasi storefront yang diekstrak dari App.jsx (buka/tutup produk,
// katalog, ulasan, FAQ, blog, section). Logika dipindah apa adanya; App.jsx
// meneruskan state & setter yang dibutuhkan lewat satu objek dependency.

import { analytics } from "../services/analytics.js";
import { toSlug } from "../utils/general.js";
import { CATEGORIES } from "../config/constants.js";
import { captureReturnContext, returnToCapturedContext } from "../utils/navigation.js";
import { localizedSectionHash, parseLocalizedPath } from "../i18n/locale.js";

export const CATALOG_SCROLL_MEMORY_KEY = "mg_catalog_return_scroll";

export function useStorefrontNavigation({
  navigate,
  location,
  route,
  locale,
  routeInfo,
  isProductPage,
  isCatalogPage,
  isReviewsPage,
  isFaqPage,
  navigateWithRouteTransition,
  setSelected,
  setView,
  setOpenNavMenu,
  setOpenMobileNav,
  setShowMobileMenu,
}) {
  const isCatalogDestination = (value) => {
    const pathOnly = String(value || "").split(/[?#]/)[0];
    return parseLocalizedPath(pathOnly).key === "catalog";
  };

  const isSkinQuizDestination = (value) => {
    const pathOnly = String(value || "").split(/[?#]/)[0];
    return parseLocalizedPath(pathOnly).key === "skinQuiz";
  };

  const navigateWithMenuTransition = (destination, options = {}, label = "Menyiapkan halaman") => {
    setOpenNavMenu(null);
    setOpenMobileNav(null);
    setShowMobileMenu(false);
    navigateWithRouteTransition(destination, options, label);
  };

  const openProduct = (product, extraState = {}) => {
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;
    const openedFromProduct = isProductPage;
    const previousPath = openedFromProduct
      ? String(location.state?.from || route("catalog"))
      : currentUrl;
    const previousScrollY = openedFromProduct
      ? Number(location.state?.fromScrollY || 0)
      : window.scrollY;
    const catalogState = openedFromProduct
      ? location.state?.catalogState || null
      : isCatalogPage
        ? location.state || null
        : null;

    if (!openedFromProduct && isCatalogPage) {
      try {
        sessionStorage.setItem(
          CATALOG_SCROLL_MEMORY_KEY,
          JSON.stringify({
            path: currentUrl,
            scrollY: previousScrollY,
          })
        );
      } catch {}
    }

    setSelected(product);
    analytics.viewProduct(product);
    const quizNavigationState = openedFromProduct
      ? {
          skinQuizSession: location.state?.skinQuizSession,
          skinQuizReturnState: location.state?.skinQuizReturnState,
        }
      : {
          skinQuizSession: extraState.skinQuizSession,
          skinQuizReturnState: extraState.skinQuizReturnState,
        };
    navigate(route("product", { id: `${toSlug(product.name)}-${product.id}` }), {
      state: {
        from: previousPath,
        fromScrollY: previousScrollY,
        catalogState,
        ...quizNavigationState,
      },
    });
  };

  const closeProduct = () => {
    const previousPath = String(location.state?.from || "");
    const previousScrollY = Number(location.state?.fromScrollY || 0);
    const catalogState = location.state?.catalogState || null;

    if (isCatalogDestination(previousPath)) {
      navigate(previousPath, {
        state: {
          ...(catalogState || {}),
          restoreScrollY: previousScrollY,
        },
      });
      return;
    }

    if (isSkinQuizDestination(previousPath)) {
      navigate(previousPath, {
        state: {
          ...(location.state?.skinQuizReturnState || {}),
          quizSession: location.state?.skinQuizSession,
        },
      });
      return;
    }

    // Produk yang dibuka dari beranda tidak kembali ke home. Arahkan ke
    // katalog, tetapi simpan posisi home agar tombol kembali katalog tetap tepat.
    navigate(route("catalog"), {
      state: {
        from: previousPath.startsWith("/") ? previousPath : route("home"),
        scrollY: previousScrollY,
      },
    });
  };

  const openAllProducts = () => {
    navigateWithMenuTransition(
      route("catalog"),
      {
        state: {
          from: `${location.pathname}${location.search}${location.hash}`,
          scrollY: window.scrollY,
        },
      },
      "Menyiapkan semua produk"
    );
  };

  const closeCatalogPage = () => {
    const previousPath = String(location.state?.from || route("home"));
    const previousScrollY = Number(location.state?.scrollY || 0);
    navigate(previousPath.startsWith("/") ? previousPath : route("home"), {
      state: { restoreScrollY: previousScrollY },
    });
  };

  const closeReviewsPage = () => {
    returnToCapturedContext(navigate, location.state, "testimoni");
  };

  const closeFaqPage = () => {
    returnToCapturedContext(navigate, location.state, "faq");
  };

  const closeSkinQuizPage = () => {
    returnToCapturedContext(navigate, location.state);
  };

  const scrollToSection = (id) => {
    setView("store");
    setOpenNavMenu(null);

    if (routeInfo.key !== "home") {
      navigate(`${route("home")}#${localizedSectionHash(locale, id)}`);
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 120);
      return;
    }

    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const openCatalogCategory = (categoryId) => {
    const destination = route("catalog", { categoryId });
    const categoryLabel =
      CATEGORIES.find((category) => category.id === categoryId)?.label || "produk";
    const navigationState = isCatalogPage
      ? location.state
      : {
          from: `${location.pathname}${location.search}${location.hash}`,
          scrollY: window.scrollY,
        };

    navigateWithMenuTransition(
      destination,
      { state: navigationState },
      categoryId === "semua" ? "Menyiapkan semua produk" : `Menyiapkan ${categoryLabel}`
    );
  };

  const openReviewsPage = ({ openReviewForm = false } = {}) => {
    setOpenNavMenu(null);

    if (isReviewsPage) {
      if (openReviewForm) window.dispatchEvent(new CustomEvent("mg:open-review-form"));
      return;
    }

    navigateWithMenuTransition(
      route("reviews"),
      {
        state: {
          ...captureReturnContext(location),
          openReviewForm,
        },
      },
      "Menyiapkan ulasan"
    );
  };

  const openReviewFormFromNav = () => {
    openReviewsPage({ openReviewForm: true });
  };

  const openFaqPage = () => {
    setOpenNavMenu(null);

    if (isFaqPage) return;

    navigateWithMenuTransition(
      route("faq"),
      { state: captureReturnContext(location) },
      "Menyiapkan FAQ"
    );
  };

  const openSkinQuizPage = () => {
    setOpenNavMenu(null);

    if (routeInfo.key === "skinQuiz") return;

    navigateWithMenuTransition(
      route("skinQuiz"),
      { state: captureReturnContext(location) },
      locale === "en" ? "Preparing skin type quiz" : "Menyiapkan kuis tipe kulit"
    );
  };

  const openBlogCategory = (categoryValue) => {
    const destination =
      categoryValue === "semua"
        ? route("blog")
        : route("blogCategory", { categoryId: categoryValue });
    navigateWithMenuTransition(
      destination,
      {
        state: {
          from: `${location.pathname}${location.search}${location.hash}`,
          scrollY: window.scrollY,
        },
      },
      "Menyiapkan artikel"
    );
  };

  const openBlogPost = (post, extraState = {}) => {
    if (!post) return;
    navigateWithMenuTransition(
      route("blogDetail", { blogId: `${toSlug(post.title)}-${post.id}` }),
      {
        state: {
          fromList: route("blog"),
          listScrollY: 0,
          returnFrom: `${location.pathname}${location.search}${location.hash}`,
          returnScrollY: window.scrollY,
          ...extraState,
        },
      },
      "Membuka artikel"
    );
  };

  return {
    isCatalogDestination,
    isSkinQuizDestination,
    navigateWithMenuTransition,
    openProduct,
    closeProduct,
    openAllProducts,
    closeCatalogPage,
    closeReviewsPage,
    closeFaqPage,
    closeSkinQuizPage,
    scrollToSection,
    openCatalogCategory,
    openReviewsPage,
    openReviewFormFromNav,
    openFaqPage,
    openSkinQuizPage,
    openBlogCategory,
    openBlogPost,
  };
}
