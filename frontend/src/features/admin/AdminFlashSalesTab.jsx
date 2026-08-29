import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock3, Pencil, Plus, RefreshCw, Square, Zap } from "lucide-react";
import { auth } from "../../services/firebaseAuth.js";
import { apiFetch, readJsonResponse } from "../../services/apiClient.js";
import { flashSaleAdminStatus, localDateTimeInput } from "../flashSale/flashSaleUtils.js";
import "../flashSale/FlashSale.css";

const STATUS_LABELS = {
  active: "Sedang aktif",
  upcoming: "Terjadwal",
  ended: "Selesai",
  stopped: "Dihentikan",
  invalid: "Jadwal tidak valid",
};

function defaultEditor() {
  const startAt = new Date(Date.now() + 5 * 60 * 1000);
  startAt.setSeconds(0, 0);
  const endAt = new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
  return {
    id: "",
    titleId: "Flash Sale Morgen",
    titleEn: "Morgen Flash Sale",
    discountPercent: 20,
    startAt: localDateTimeInput(startAt),
    endAt: localDateTimeInput(endAt),
    productIds: [],
  };
}

function editorFromSale(sale) {
  return {
    id: sale.id,
    titleId: sale.titleId || "",
    titleEn: sale.titleEn || "",
    discountPercent: Number(sale.discountPercent || 0),
    startAt: localDateTimeInput(sale.startAt),
    endAt: localDateTimeInput(sale.endAt),
    productIds: Array.isArray(sale.productIds) ? sale.productIds : [],
  };
}

function dateLabel(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function adminRequest(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sesi admin belum tersedia.");
  const token = await user.getIdToken();
  const response = await apiFetch(
    path,
    {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    },
    { timeoutMs: 20000, expectJson: true }
  );
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || `Permintaan gagal (${response.status}).`);
  return data;
}

export function AdminFlashSalesTab({ products = [] }) {
  const [sales, setSales] = useState([]);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stoppingId, setStoppingId] = useState("");
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [productSearch, setProductSearch] = useState("");

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminRequest("/api/admin/flash-sales");
      const serverTime = new Date(data.serverTime || Date.now()).getTime();
      setServerOffsetMs(Number.isFinite(serverTime) ? serverTime - Date.now() : 0);
      setSales(Array.isArray(data.sales) ? data.sales : []);
      setClock(Date.now());
    } catch (requestError) {
      setError(requestError?.message || "Gagal memuat jadwal flash sale.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const now = clock + serverOffsetMs;
  const sortedSales = useMemo(
    () =>
      [...sales].sort(
        (a, b) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime()
      ),
    [sales]
  );
  const activeSale = sortedSales.find((sale) => flashSaleAdminStatus(sale, now) === "active");
  const upcomingCount = sortedSales.filter(
    (sale) => flashSaleAdminStatus(sale, now) === "upcoming"
  ).length;
  const availableProducts = useMemo(
    () =>
      products
        .filter((product) => product.isArchived !== true)
        .filter((product) => {
          const query = productSearch.trim().toLowerCase();
          if (!query) return true;
          return `${product.name || ""} ${product.id || ""}`.toLowerCase().includes(query);
        })
        .sort((a, b) => Number(a.order ?? 999999) - Number(b.order ?? 999999)),
    [productSearch, products]
  );

  const toggleProduct = (productId) => {
    setEditor((current) => {
      if (!current) return current;
      const selected = current.productIds.includes(productId);
      return {
        ...current,
        productIds: selected
          ? current.productIds.filter((id) => id !== productId)
          : [...current.productIds, productId],
      };
    });
  };

  const saveSale = async () => {
    if (!editor || saving) return;
    setSaving(true);
    setError("");
    try {
      const startAt = new Date(editor.startAt);
      const endAt = new Date(editor.endAt);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        throw new Error("Waktu mulai dan selesai wajib diisi.");
      }

      const payload = {
        titleId: editor.titleId,
        titleEn: editor.titleEn,
        discountPercent: Number(editor.discountPercent),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        productIds: editor.productIds,
      };
      const path = editor.id
        ? `/api/admin/flash-sales/${encodeURIComponent(editor.id)}`
        : "/api/admin/flash-sales";
      await adminRequest(path, {
        method: editor.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      setEditor(null);
      setProductSearch("");
      window.dispatchEvent(
        new CustomEvent("mg:public-content-updated", { detail: { type: "flash-sale" } })
      );
      await loadSales();
    } catch (requestError) {
      setError(requestError?.message || "Gagal menyimpan flash sale.");
    } finally {
      setSaving(false);
    }
  };

  const stopSale = async (sale) => {
    if (
      !window.confirm(
        `Hentikan "${sale.titleId}" sekarang? Harga normal akan langsung berlaku kembali.`
      )
    ) {
      return;
    }
    setStoppingId(sale.id);
    setError("");
    try {
      await adminRequest(`/api/admin/flash-sales/${encodeURIComponent(sale.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "stop" }),
      });
      window.dispatchEvent(
        new CustomEvent("mg:public-content-updated", { detail: { type: "flash-sale" } })
      );
      await loadSales();
    } catch (requestError) {
      setError(requestError?.message || "Gagal menghentikan flash sale.");
    } finally {
      setStoppingId("");
    }
  };

  return (
    <div className="admin-flash-sale">
      <div className="admin-flash-sale-summary">
        <article className={activeSale ? "is-active" : ""}>
          <span>
            <Zap size={16} /> STATUS SAAT INI
          </span>
          <strong>{activeSale ? activeSale.titleId : "Tidak ada flash sale aktif"}</strong>
          <small>
            {activeSale
              ? `${activeSale.discountPercent}% · selesai ${dateLabel(activeSale.endAt)}`
              : "Harga katalog normal sedang berlaku."}
          </small>
        </article>
        <article>
          <span>
            <CalendarClock size={16} /> JADWAL BERIKUTNYA
          </span>
          <strong>{upcomingCount}</strong>
          <small>{upcomingCount ? "flash sale terjadwal" : "Belum ada jadwal mendatang"}</small>
        </article>
      </div>

      <div className="admin-flash-sale-toolbar">
        <div>
          <p>FLASH SALE TERJADWAL</p>
          <h2>Atur harga khusus berdasarkan waktu server</h2>
          <span>Satu jadwal aktif pada satu waktu agar harga checkout selalu jelas.</span>
        </div>
        <div>
          <button type="button" className="secondary" onClick={loadSales} disabled={loading}>
            <RefreshCw size={14} className={loading ? "is-spinning" : ""} />
            Perbarui
          </button>
          <button type="button" className="primary" onClick={() => setEditor(defaultEditor())}>
            <Plus size={14} /> Jadwalkan
          </button>
        </div>
      </div>

      {error && <p className="admin-flash-sale-error">{error}</p>}

      <div className="admin-flash-sale-list">
        {loading && sales.length === 0 && (
          <p className="admin-flash-sale-empty">Memuat jadwal flash sale...</p>
        )}
        {!loading && sales.length === 0 && (
          <div className="admin-flash-sale-empty">
            <Clock3 size={24} />
            <strong>Belum ada flash sale</strong>
            <span>Buat jadwal pertama untuk menampilkan countdown dan harga khusus di toko.</span>
          </div>
        )}

        {sortedSales.map((sale) => {
          const status = flashSaleAdminStatus(sale, now);
          const canStop = status === "active" || status === "upcoming";
          return (
            <article key={sale.id} className={`admin-flash-sale-row is-${status}`}>
              <div className="admin-flash-sale-row-main">
                <span className={`admin-flash-sale-status is-${status}`}>
                  {STATUS_LABELS[status] || status}
                </span>
                <h3>{sale.titleId}</h3>
                <p>{sale.titleEn}</p>
              </div>
              <div className="admin-flash-sale-row-meta">
                <span>
                  <b>{sale.discountPercent}%</b>
                  <small>Diskon</small>
                </span>
                <span>
                  <b>{sale.productIds?.length || 0}</b>
                  <small>Produk</small>
                </span>
                <span>
                  <b>{dateLabel(sale.startAt)}</b>
                  <small>Mulai</small>
                </span>
                <span>
                  <b>{dateLabel(sale.endAt)}</b>
                  <small>Selesai</small>
                </span>
              </div>
              <div className="admin-flash-sale-row-actions">
                {status !== "stopped" && (
                  <button type="button" onClick={() => setEditor(editorFromSale(sale))}>
                    <Pencil size={13} /> Edit
                  </button>
                )}
                {canStop && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => stopSale(sale)}
                    disabled={stoppingId === sale.id}
                  >
                    <Square size={12} />
                    {stoppingId === sale.id ? "Menghentikan..." : "Hentikan"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {editor && (
        <div className="admin-modal-backdrop admin-flash-sale-modal-backdrop">
          <div
            className="admin-flash-sale-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-flash-sale-editor-title"
          >
            <div className="admin-flash-sale-modal-head">
              <div>
                <p>JADWAL FLASH SALE</p>
                <h2 id="admin-flash-sale-editor-title">
                  {editor.id ? "Edit jadwal" : "Buat jadwal baru"}
                </h2>
              </div>
              <button type="button" onClick={() => setEditor(null)} aria-label="Tutup">
                ×
              </button>
            </div>

            <div className="admin-flash-sale-form-grid">
              <label>
                Nama Indonesia
                <input
                  value={editor.titleId}
                  onChange={(event) => setEditor({ ...editor, titleId: event.target.value })}
                  maxLength={100}
                  placeholder="Contoh: Flash Sale Akhir Pekan"
                />
              </label>
              <label>
                English name
                <input
                  value={editor.titleEn}
                  onChange={(event) => setEditor({ ...editor, titleEn: event.target.value })}
                  maxLength={100}
                  placeholder="Example: Weekend Flash Sale"
                />
              </label>
              <label>
                Diskon (%)
                <input
                  type="number"
                  min="1"
                  max="90"
                  step="1"
                  value={editor.discountPercent}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      discountPercent: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Mulai
                <input
                  type="datetime-local"
                  value={editor.startAt}
                  onChange={(event) => setEditor({ ...editor, startAt: event.target.value })}
                />
              </label>
              <label>
                Selesai
                <input
                  type="datetime-local"
                  value={editor.endAt}
                  onChange={(event) => setEditor({ ...editor, endAt: event.target.value })}
                />
              </label>
            </div>

            <section className="admin-flash-sale-products">
              <div>
                <span>
                  <b>Pilih produk</b>
                  <small>{editor.productIds.length} dipilih</small>
                </span>
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Cari produk..."
                />
              </div>
              <div className="admin-flash-sale-product-grid">
                {availableProducts.map((product) => (
                  <label
                    key={product.id}
                    className={editor.productIds.includes(product.id) ? "is-selected" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={editor.productIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                    />
                    <span>
                      <b>{product.name}</b>
                      <small>
                        {product.id} · stok {product.stock || 0}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <p className="admin-flash-sale-note">
              Waktu mengikuti zona pada perangkat admin lalu disimpan sebagai waktu server. Jadwal
              yang bertabrakan akan ditolak otomatis.
            </p>

            <div className="admin-flash-sale-modal-actions">
              <button type="button" className="secondary" onClick={() => setEditor(null)}>
                Batal
              </button>
              <button type="button" className="primary" onClick={saveSale} disabled={saving}>
                {saving ? "Menyimpan..." : editor.id ? "Simpan perubahan" : "Jadwalkan flash sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
