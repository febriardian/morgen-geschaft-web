// Public storefront data is served by the same-origin backend API. Firestore
// stays admin-only and is imported dynamically after an admin is authenticated.

import { useEffect, useRef, useState } from "react";
import { apiFetch, readJsonResponse } from "../services/apiClient.js";
import {
  BLOGS_CACHE_KEY,
  PRODUCTS_CACHE_KEY,
  fetchPublicBlogs,
  fetchPublicProducts,
  readSessionArray,
  sortBlogs,
  sortProducts,
} from "../services/publicContent.js";

async function productFallback() {
  const { PRODUCTS_SEED } = await import("../config/seedData.js");
  return sortProducts(PRODUCTS_SEED);
}

async function blogFallback() {
  const { BLOG_POSTS } = await import("../config/seedData.js");
  return sortBlogs(BLOG_POSTS);
}

export function useProducts() {
  const cachedProducts = readSessionArray(PRODUCTS_CACHE_KEY);
  const hadCachedProducts = useRef(cachedProducts.length > 0);
  const [products, setProducts] = useState(() => sortProducts(cachedProducts));
  const [productsLoading, setProductsLoading] = useState(!hadCachedProducts.current);

  useEffect(() => {
    let cancelled = false;

    const load = async (refresh = false) => {
      try {
        const data = await fetchPublicProducts({ refresh });
        if (cancelled) return;
        setProducts(data.length > 0 ? data : await productFallback());
      } catch (error) {
        console.warn("Produk publik belum dapat dimuat dari API:", error);
        if (!cancelled && !hadCachedProducts.current) setProducts(await productFallback());
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };

    const refresh = (event) => {
      const type = event?.detail?.type;
      if (!type || type === "products") load(true);
    };
    const refreshOnFocus = () => load(true);

    load();
    window.addEventListener("mg:public-content-updated", refresh);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("mg:public-content-updated", refresh);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  return { products, productsLoading };
}

export function useCoupons() {
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async (refresh = false) => {
      try {
        const response = await apiFetch(
          "/api/promotions",
          {
            headers: { Accept: "application/json" },
            cache: refresh ? "no-store" : "default",
          },
          { timeoutMs: 12000, expectJson: true }
        );
        const data = await readJsonResponse(response);
        if (!cancelled && response.ok) {
          setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
          return;
        }
        throw new Error(data.error || "Promo tidak tersedia.");
      } catch (error) {
        console.warn("Promo publik belum dapat dimuat dari API:", error);
        if (!cancelled) setCoupons([]);
      }
    };

    const refresh = (event) => {
      const type = event?.detail?.type;
      if (!type || type === "promotions") load(true);
    };
    const refreshOnFocus = () => load(true);

    load();
    window.addEventListener("mg:public-content-updated", refresh);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("mg:public-content-updated", refresh);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  return coupons;
}

export function useBlogPosts(user) {
  const cachedPosts = readSessionArray(BLOGS_CACHE_KEY);
  const hadCachedPosts = useRef(cachedPosts.length > 0);
  const [blogPosts, setBlogPosts] = useState(() => sortBlogs(cachedPosts));

  useEffect(() => {
    let cancelled = false;

    const load = async (refresh = false) => {
      try {
        const posts = await fetchPublicBlogs({ refresh });
        if (!cancelled) setBlogPosts(posts.length > 0 ? posts : await blogFallback());
      } catch (error) {
        console.warn("Artikel publik belum dapat dimuat dari API:", error);
        if (!cancelled && !hadCachedPosts.current) setBlogPosts(await blogFallback());
      }
    };

    const refresh = (event) => {
      const type = event?.detail?.type;
      if (!type || type === "blogs") load(true);
    };
    const refreshOnFocus = () => load(true);

    load();
    window.addEventListener("mg:public-content-updated", refresh);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("mg:public-content-updated", refresh);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  // Seed missing defaults only inside an authenticated admin session. These
  // dynamic imports keep Firestore and full seed article bodies out of the
  // public page's critical JavaScript.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const [{ collection, doc, getDocs, setDoc }, { db }, { BLOG_POSTS }] =
          await Promise.all([
            import("firebase/firestore"),
            import("../services/firebase.js"),
            import("../config/seedData.js"),
          ]);
        if (cancelled) return;
        const snapshot = await getDocs(collection(db, "blogs"));
        const existingIds = new Set(snapshot.docs.map((item) => item.id));
        const missing = BLOG_POSTS.filter((post) => !existingIds.has(post.id));
        for (const post of missing) {
          if (cancelled) return;
          await setDoc(doc(db, "blogs", post.id), post);
        }
      } catch (error) {
        if (!String(error?.message || "").includes("permissions")) {
          console.warn("Blog seed belum dapat dijalankan:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return blogPosts;
}
