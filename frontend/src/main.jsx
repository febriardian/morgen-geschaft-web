import "./index.css";
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

// CatalogPage/ReviewsPage/FaqPage hanya me-render <App /> yang sudah dimuat
// eager, jadi lazy-loading tidak memindahkannya ke chunk lain (hanya menambah
// overhead Suspense). Impor statis dari modul App yang sama.
import App, { CatalogPage, ReviewsPage, FaqPage } from "./App.jsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundaries.jsx";
import { LocaleProvider, useLocale } from "./i18n/LocaleContext.jsx";
import {
  blogCategoryIdFromSlug,
  categoryIdFromSlug,
  getStoredLocale,
  routePath,
} from "./i18n/locale.js";
import { scheduleErrorMonitoring } from "./services/errorMonitoring.js";

const BlogListPage = React.lazy(() =>
  import("./features/blog/Blog.jsx").then((module) => ({ default: module.BlogListPage }))
);
const BlogDetailPage = React.lazy(() =>
  import("./features/blog/Blog.jsx").then((module) => ({ default: module.BlogDetailPage }))
);
const PrivacyPage = React.lazy(() =>
  import("./pages/StaticPages.jsx").then((module) => ({ default: module.PrivacyPage }))
);
const TermsPage = React.lazy(() =>
  import("./pages/StaticPages.jsx").then((module) => ({ default: module.TermsPage }))
);
const InstallPage = React.lazy(() =>
  import("./pages/StaticPages.jsx").then((module) => ({ default: module.InstallPage }))
);
const NotFoundPage = React.lazy(() =>
  import("./pages/StaticPages.jsx").then((module) => ({ default: module.NotFoundPage }))
);

function RouteFallback() {
  const { t } = useLocale();
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        background: "#F6F1E7",
      }}
    >
      <p
        style={{
          fontFamily: "'Work Sans', sans-serif",
          color: "#6B6558",
          fontSize: "13px",
        }}
      >
        {t("Memuat halaman...", "Loading page...")}
      </p>
    </div>
  );
}

function RootRedirect() {
  return <Navigate to={routePath(getStoredLocale(), "home")} replace />;
}

function LegacyRedirect({ routeKey }) {
  const params = useParams();
  const location = useLocation();
  const locale = getStoredLocale();
  let destination = routePath(locale, routeKey, params);

  if (routeKey === "catalog") {
    destination = routePath(locale, "catalog", {
      categoryId: categoryIdFromSlug("id", params.category || ""),
    });
  }
  if (routeKey === "blogCategory") {
    destination = routePath(locale, "blogCategory", {
      categoryId: blogCategoryIdFromSlug("id", params.category || ""),
    });
  }

  return <Navigate to={`${destination}${location.hash || ""}`} replace state={location.state} />;
}

function LocalizedRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route path="/id" element={<App />} />
        <Route path="/en" element={<App />} />
        <Route path="/id/produk/:id" element={<App />} />
        <Route path="/en/product/:id" element={<App />} />

        <Route path="/id/katalog" element={<CatalogPage />} />
        <Route path="/id/katalog/:category" element={<CatalogPage />} />
        <Route path="/en/catalog" element={<CatalogPage />} />
        <Route path="/en/catalog/:category" element={<CatalogPage />} />

        <Route path="/id/ulasan" element={<ReviewsPage />} />
        <Route path="/en/reviews" element={<ReviewsPage />} />
        <Route path="/id/faq" element={<FaqPage />} />
        <Route path="/en/faq" element={<FaqPage />} />
        <Route path="/id/kuis-tipe-kulit" element={<App />} />
        <Route path="/en/skin-type-quiz" element={<App />} />

        <Route path="/id/artikel" element={<BlogListPage />} />
        <Route path="/id/artikel/kategori/:category" element={<BlogListPage />} />
        <Route path="/id/artikel/:blogId" element={<BlogDetailPage />} />
        <Route path="/en/articles" element={<BlogListPage />} />
        <Route path="/en/articles/category/:category" element={<BlogListPage />} />
        <Route path="/en/articles/:blogId" element={<BlogDetailPage />} />

        <Route path="/id/kebijakan-privasi" element={<PrivacyPage />} />
        <Route path="/en/privacy-policy" element={<PrivacyPage />} />
        <Route path="/id/syarat-ketentuan" element={<TermsPage />} />
        <Route path="/en/terms-and-conditions" element={<TermsPage />} />
        <Route path="/id/install" element={<InstallPage />} />
        <Route path="/en/install" element={<InstallPage />} />

        {/* Backward-compatible redirects for existing links and saved browser history. */}
        <Route path="/produk/:id" element={<LegacyRedirect routeKey="product" />} />
        <Route path="/katalog" element={<LegacyRedirect routeKey="catalog" />} />
        <Route path="/katalog/:category" element={<LegacyRedirect routeKey="catalog" />} />
        <Route path="/ulasan" element={<LegacyRedirect routeKey="reviews" />} />
        <Route path="/faq" element={<LegacyRedirect routeKey="faq" />} />
        <Route path="/kuis-tipe-kulit" element={<LegacyRedirect routeKey="skinQuiz" />} />
        <Route path="/blog" element={<LegacyRedirect routeKey="blog" />} />
        <Route
          path="/blog/kategori/:category"
          element={<LegacyRedirect routeKey="blogCategory" />}
        />
        <Route path="/blog/:blogId" element={<LegacyRedirect routeKey="blogDetail" />} />
        <Route path="/kebijakan-privasi" element={<LegacyRedirect routeKey="privacy" />} />
        <Route path="/syarat-ketentuan" element={<LegacyRedirect routeKey="terms" />} />
        <Route path="/install" element={<LegacyRedirect routeKey="install" />} />

        <Route path="/id/*" element={<NotFoundPage />} />
        <Route path="/en/*" element={<NotFoundPage />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  );
}

scheduleErrorMonitoring();

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    },
    { once: true }
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <ErrorBoundary>
          <LocalizedRoutes />
        </ErrorBoundary>
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
