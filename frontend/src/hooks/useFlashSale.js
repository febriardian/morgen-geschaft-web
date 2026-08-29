import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, readJsonResponse } from "../services/apiClient.js";
import {
  applyFlashSalePrices,
  flashSaleRemainingMs,
  isPublicFlashSaleActive,
} from "../features/flashSale/flashSaleUtils.js";

export function useFlashSale(products) {
  const [sale, setSale] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [clock, setClock] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const startedAt = Date.now();
      const response = await apiFetch(
        "/api/flash-sales/current",
        { headers: { Accept: "application/json" } },
        { timeoutMs: 12000, expectJson: true }
      );
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Flash sale tidak tersedia.");

      const receivedAt = Date.now();
      const serverTime = new Date(data.serverTime || receivedAt).getTime();
      const midpoint = startedAt + Math.round((receivedAt - startedAt) / 2);
      setServerOffsetMs(Number.isFinite(serverTime) ? serverTime - midpoint : 0);
      setClock(receivedAt);
      setSale(data.active && data.sale ? data.sale : null);
    } catch (error) {
      setSale(null);
      // Flash sale adalah peningkatan opsional. Storefront tetap memakai harga
      // normal ketika API sedang tidak tersedia; detail tetap tercatat di
      // backend/Sentry tanpa memenuhi console pengunjung dengan error polling.
      if (import.meta.env.DEV) {
        console.debug("Flash sale tidak tersedia:", error?.message || error);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30000);
    const refresh = () => load();
    const refreshFromAdmin = (event) => {
      if (!event?.detail?.type || event.detail.type === "flash-sale") load();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("mg:public-content-updated", refreshFromAdmin);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("mg:public-content-updated", refreshFromAdmin);
    };
  }, [load]);

  const serverNow = clock + serverOffsetMs;
  const active = isPublicFlashSaleActive(sale, serverNow);
  const remainingMs = flashSaleRemainingMs(sale, serverNow);

  useEffect(() => {
    if (!sale) return undefined;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [sale]);

  useEffect(() => {
    if (!sale || remainingMs > 0) return undefined;
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load, remainingMs, sale]);

  const pricedProducts = useMemo(() => {
    if (!active || !sale) return products;

    // Harga tidak berubah setiap detik selama jadwal aktif. Gunakan satu waktu
    // yang pasti berada di dalam rentang sale agar countdown dapat berdetak
    // tanpa membuat ulang seluruh katalog pada setiap tick.
    const startAt = new Date(sale.startAt).getTime();
    const endAt = new Date(sale.endAt).getTime();
    const activeTimestamp = Math.max(startAt, Math.min(endAt - 1, Date.now() + serverOffsetMs));
    return applyFlashSalePrices(products, sale, activeTimestamp);
  }, [active, products, sale, serverOffsetMs]);

  return {
    products: pricedProducts,
    flashSale: active ? sale : null,
    remainingMs,
    refreshFlashSale: load,
  };
}
