// hooks/useCart.js
// Extracted from App.jsx — manages cart, wishlist, and toast state.
// Cart & wishlist store only {id, qty} in localStorage; full product data
// is hydrated from the live products array to keep prices/stock current.

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { analytics } from "../services/analytics.js";

/**
 * Hydrate a slim {id, qty} array into full product objects using live data.
 * Items whose product no longer exists or has 0 stock are dropped.
 * Quantities exceeding current stock are clamped.
 */
function hydrateItems(slimItems, products) {
  if (products.length === 0) return [];
  return slimItems
    .map((item) => {
      const p = products.find((prod) => prod.id === item.id);
      if (!p) return null;
      return { ...p, qty: Math.min(item.qty, Math.max(p.stock, 0) || item.qty) };
    })
    .filter(Boolean);
}

/** Slim down a full product+qty object for localStorage. */
function toSlim(item) {
  return { id: item.id, qty: item.qty };
}

export function useCart(products) {
  // localStorage stores only [{id, qty}, ...] — small and never stale
  const [cartSlim, setCartSlim] = useLocalStorage("mg_cart", []);
  const [wishlistSlim, setWishlistSlim] = useLocalStorage("mg_wishlist", []);
  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Hydrate from live product data
  const cart = useMemo(() => hydrateItems(cartSlim, products), [cartSlim, products]);
  const wishlist = useMemo(
    () => hydrateItems(wishlistSlim.map((w) => ({ ...w, qty: w.qty || 1 })), products),
    [wishlistSlim, products]
  );

  // Remove items from localStorage whose product no longer exists or is out of stock
  const prevProductsLen = useRef(0);
  useEffect(() => {
    if (products.length === 0) return;
    if (prevProductsLen.current === products.length) return; // only on product load
    prevProductsLen.current = products.length;

    setCartSlim((prev) => {
      const cleaned = prev
        .map((item) => {
          const p = products.find((prod) => prod.id === item.id);
          if (!p || p.stock === 0) return null;
          return { id: item.id, qty: Math.min(item.qty, p.stock) };
        })
        .filter(Boolean);
      return cleaned.length !== prev.length || cleaned.some((c, i) => c.qty !== prev[i]?.qty)
        ? cleaned : prev;
    });

    setWishlistSlim((prev) => {
      const cleaned = prev.filter((item) => products.some((p) => p.id === item.id));
      return cleaned.length !== prev.length ? cleaned : prev;
    });
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (product) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, product }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const addToCart = (p) => {
    if (p.stock === 0) return;
    const currentInCart = cartSlim.find((i) => i.id === p.id);
    if (currentInCart && currentInCart.qty >= p.stock) {
      showToast({ ...p, _stockWarning: true });
      return;
    }
    setCartSlim((prev) => {
      const found = prev.find((i) => i.id === p.id);
      if (found) {
        if (found.qty >= p.stock) return prev;
        return prev.map((i) => (i.id === p.id ? { id: i.id, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: p.id, qty: 1 }];
    });
    analytics.addToCart(p);
    showToast(p);
  };

  const toggleWishlist = (product) => {
    setWishlistSlim((prev) => {
      const exists = prev.some((w) => w.id === product.id);
      return exists ? prev.filter((w) => w.id !== product.id) : [...prev, { id: product.id, qty: 1 }];
    });
  };

  const addWishlistItemsToCart = (items = []) => {
    const availableItems = items.filter((item) => Number(item.stock || 0) > 0);
    if (availableItems.length === 0) return;

    setCartSlim((previousCart) => {
      let nextCart = [...previousCart];
      availableItems.forEach((item) => {
        const existingIndex = nextCart.findIndex((cartItem) => cartItem.id === item.id);
        if (existingIndex >= 0) {
          const existing = nextCart[existingIndex];
          if (existing.qty < Number(item.stock || 0)) {
            nextCart[existingIndex] = { id: existing.id, qty: existing.qty + 1 };
          }
        } else {
          nextCart.push({ id: item.id, qty: 1 });
        }
      });
      return nextCart;
    });

    availableItems.forEach((item) => analytics.addToCart(item));
    showToast({
      id: "wishlist-batch",
      name: `${availableItems.length} produk wishlist`,
      image: availableItems[0]?.image || "",
    });
    setShowWishlist(false);
    setShowCart(true);
  };

  const changeQty = (id, delta) => {
    setCartSlim((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const newQty = i.qty + delta;
          const product = products.find((p) => p.id === id);
          const maxStock = product ? product.stock : i.qty;
          return { id: i.id, qty: Math.min(newQty, maxStock) };
        })
        .filter((i) => i.qty > 0)
    );
  };

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  // Provide setCart that accepts full objects but stores slim
  const setCart = useCallback((updater) => {
    if (typeof updater === "function") {
      setCartSlim((prevSlim) => {
        const prevHydrated = hydrateItems(prevSlim, products);
        const nextHydrated = updater(prevHydrated);
        return nextHydrated.map(toSlim);
      });
    } else {
      setCartSlim(updater.map(toSlim));
    }
  }, [products, setCartSlim]);

  const setWishlist = useCallback((updater) => {
    if (typeof updater === "function") {
      setWishlistSlim((prevSlim) => {
        const prevHydrated = hydrateItems(prevSlim.map((w) => ({ ...w, qty: w.qty || 1 })), products);
        const nextHydrated = updater(prevHydrated);
        return nextHydrated.map((w) => ({ id: w.id, qty: w.qty || 1 }));
      });
    } else {
      setWishlistSlim(updater.map((w) => ({ id: w.id, qty: w.qty || 1 })));
    }
  }, [products, setWishlistSlim]);

  const handleCheckoutConfirm = () => {
    analytics.purchase("checkout", cart.reduce((s, i) => s + i.price * i.qty, 0));
    setCartSlim([]);
    setShowCheckout(false);
    setShowCart(false);
  };

  return {
    cart, setCart,
    wishlist, setWishlist,
    showCart, setShowCart,
    showWishlist, setShowWishlist,
    showCheckout, setShowCheckout,
    toasts, setToasts,
    addToCart, toggleWishlist, addWishlistItemsToCart,
    changeQty, cartCount,
    handleCheckoutConfirm,
  };
}
