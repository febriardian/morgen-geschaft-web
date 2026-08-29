import { apiFetch, readJsonResponse } from "./apiClient.js";

const CACHE_VERSION = "v4";
const PRODUCTS_CACHE_KEY = `mg_public_products_${CACHE_VERSION}`;
const BLOGS_CACHE_KEY = `mg_public_blogs_${CACHE_VERSION}`;

function readSessionArray(key) {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeSessionArray(key, value) {
  if (typeof sessionStorage === "undefined" || !Array.isArray(value)) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full/disabled sessionStorage must not block public content.
  }
}

function productOrder(product) {
  if (Number.isFinite(Number(product?.order))) return Number(product.order);
  const numericId = Number.parseInt(String(product?.id || "").replace(/\D+/g, ""), 10);
  return Number.isFinite(numericId) ? numericId + 10000 : Number.MAX_SAFE_INTEGER;
}

function sortProducts(products) {
  return [...products]
    .filter((product) => product && product.isArchived !== true)
    .sort((a, b) => {
      const orderDifference = productOrder(a) - productOrder(b);
      return orderDifference || String(a.name || "").localeCompare(String(b.name || ""));
    });
}

function isPublicBlog(post) {
  const status = String(post?.status || "published").toLowerCase();
  return (
    post &&
    post.isArchived !== true &&
    post.draft !== true &&
    status !== "draft" &&
    status !== "archived"
  );
}

function blogTime(post) {
  const value = post?.date || post?.publishedAt || post?.createdAt || 0;
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortBlogs(posts) {
  return [...posts]
    .filter(isPublicBlog)
    .sort((a, b) => blogTime(b) - blogTime(a) || String(a.id).localeCompare(String(b.id)));
}

async function fetchJsonCollection(path, field, { refresh = false } = {}) {
  const response = await apiFetch(
    path,
    {
      headers: { Accept: "application/json" },
      cache: refresh ? "no-store" : "default",
    },
    { timeoutMs: 15000, expectJson: true }
  );
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || `Gagal memuat ${field}.`);
  return Array.isArray(data[field]) ? data[field] : [];
}

async function fetchPublicProducts(options) {
  const products = sortProducts(
    await fetchJsonCollection("/api/products", "products", options)
  );
  if (products.length > 0) writeSessionArray(PRODUCTS_CACHE_KEY, products);
  return products;
}

async function fetchPublicBlogs(options) {
  const posts = sortBlogs(await fetchJsonCollection("/api/blogs", "posts", options));
  if (posts.length > 0) writeSessionArray(BLOGS_CACHE_KEY, posts);
  return posts;
}

export {
  BLOGS_CACHE_KEY,
  PRODUCTS_CACHE_KEY,
  fetchPublicBlogs,
  fetchPublicProducts,
  isPublicBlog,
  readSessionArray,
  sortBlogs,
  sortProducts,
};
