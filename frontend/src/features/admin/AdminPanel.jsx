import { useState, useMemo, useEffect } from "react";
import { ShoppingBag, Plus, Lock, Pencil, Trash2, ExternalLink, Star, Bell, Tag, Megaphone, Package, FileText, RotateCcw, Zap } from "lucide-react";
import { collection, deleteDoc, doc, setDoc, onSnapshot } from "firebase/firestore";
import { CATEGORIES } from "../../config/constants.js";
import { PRODUCTS_SEED } from "../../config/seedData.js";
import { ProductQRModal } from "../catalog/Catalog.jsx";
import { addNotification, db } from "../../services/firebase.js";
import { assertAdminAccess, auth } from "../../services/firebaseAuth.js";
import { adminDateLabel, formatIDR, generateQRUrl, resolveProductImage } from "../../utils/general.js";
import { AdminPagination, AdminImageUpload } from "./adminShared.jsx";
import { AdminDashboardTab } from "./AdminDashboardTab.jsx";
import { AdminOrdersTab } from "./AdminOrdersTab.jsx";
import { AdminReviewsTab } from "./AdminReviewsTab.jsx";
import { AdminPushTab } from "./AdminPushTab.jsx";
import { AdminStockNotifyTab } from "./AdminStockNotifyTab.jsx";
import { AdminShippingTab } from "./AdminShippingTab.jsx";
import { AdminBlogTab } from "./AdminBlogTab.jsx";
import { AdminReturnsTab } from "./AdminReturnsTab.jsx";
import { AdminFlashSalesTab } from "./AdminFlashSalesTab.jsx";


export function AdminPanel({ products, coupons: initialCoupons = [] }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [adminOrderPreset, setAdminOrderPreset] = useState(null);
  const [qrProduct, setQrProduct] = useState(null);
  const [showSiteQR, setShowSiteQR] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [adminProducts, setAdminProducts] = useState(products);
  const [adminCoupons, setAdminCoupons] = useState(initialCoupons);
  const [productView, setProductView] = useState("active");
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStockFilter, setProductStockFilter] = useState("all");
  const [productSort, setProductSort] = useState("default");
  const [productPage, setProductPage] = useState(1);
  const PRODUCT_ADMIN_PAGE_SIZE = 8;
  const siteUrl = window.location.origin;
  const blank = {
    id: "", name: "", tag: "", blurb: "",
    nameEn: "", tagEn: "", blurbEn: "", ingredientsEn: [],
    price: 0, stock: 0, image: "", images: [], ingredients: [], category: "facewash",
    bpomNumber: "", netContent: "", batchInfo: "", expiryInfo: "", warnings: "", warningsEn: "",
  };
  const notifyProductsUpdated = () => {
    window.dispatchEvent(
      new CustomEvent("mg:public-content-updated", { detail: { type: "products" } })
    );
  };

  useEffect(() => setAdminProducts((current) => current.length > 0 ? current : products), [products]);
  useEffect(() => setAdminCoupons((current) => current.length > 0 ? current : initialCoupons), [initialCoupons]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "coupons"), (snap) => {
      const rows = snap.docs.map((item) => {
        const data = item.data();
        return { ...data, code: item.id, isPublic: data.isPublic !== false };
      });
      rows.sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
      setAdminCoupons(rows);
    }, () => setAdminCoupons(initialCoupons));
    return () => unsub();
  }, [initialCoupons]);
  useEffect(() => {
    const seedOrder = PRODUCTS_SEED.map((product) => product.id);
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      const rows = snap.docs.map((item) => ({ ...item.data(), id: item.id }));
      rows.sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : seedOrder.indexOf(a.id);
        const orderB = typeof b.order === "number" ? b.order : seedOrder.indexOf(b.id);
        if (orderA === -1 && orderB === -1) return String(a.name || "").localeCompare(String(b.name || ""));
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      });
      setAdminProducts(rows);
    }, () => setAdminProducts(products));
    return () => unsub();
  }, [products]);

  const activeAdminProducts = useMemo(() => adminProducts.filter((product) => product.isArchived !== true), [adminProducts]);
  const archivedAdminProducts = useMemo(() => adminProducts.filter((product) => product.isArchived === true), [adminProducts]);
  const filteredAdminProducts = useMemo(() => {
    const source = productView === "archived" ? archivedAdminProducts : activeAdminProducts;
    const queryText = productSearch.trim().toLowerCase();
    const filtered = source.filter((product) => {
      const haystack = `${product.name || ""} ${product.tag || ""} ${product.id || ""}`.toLowerCase();
      const matchesSearch = !queryText || haystack.includes(queryText);
      const matchesCategory = productCategoryFilter === "all" || product.category === productCategoryFilter;
      const stock = Number(product.stock || 0);
      const matchesStock = productView === "archived" || productStockFilter === "all" || (productStockFilter === "out" ? stock <= 0 : productStockFilter === "low" ? stock > 0 && stock <= 3 : stock > 3);
      return matchesSearch && matchesCategory && matchesStock;
    });
    return [...filtered].sort((a, b) => {
      if (productSort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (productSort === "price-low") return Number(a.price || 0) - Number(b.price || 0);
      if (productSort === "price-high") return Number(b.price || 0) - Number(a.price || 0);
      if (productSort === "stock-low") return Number(a.stock || 0) - Number(b.stock || 0);
      if (productSort === "stock-high") return Number(b.stock || 0) - Number(a.stock || 0);
      return Number(a.order ?? 999999) - Number(b.order ?? 999999);
    });
  }, [productView, archivedAdminProducts, activeAdminProducts, productSearch, productCategoryFilter, productStockFilter, productSort]);

  const totalProductPages = Math.max(1, Math.ceil(filteredAdminProducts.length / PRODUCT_ADMIN_PAGE_SIZE));
  const pagedAdminProducts = filteredAdminProducts.slice((productPage - 1) * PRODUCT_ADMIN_PAGE_SIZE, productPage * PRODUCT_ADMIN_PAGE_SIZE);
  const canReorderProducts = productView === "active" && !productSearch.trim() && productCategoryFilter === "all" && productStockFilter === "all" && productSort === "default";
  useEffect(() => { setProductPage(1); }, [productView, productSearch, productCategoryFilter, productStockFilter, productSort]);
  useEffect(() => { if (productPage > totalProductPages) setProductPage(totalProductPages); }, [productPage, totalProductPages]);

  const save = async (product) => {
    setSaving(true);
    try {
      await assertAdminAccess();
      const payload = {
        ...product,
        name: String(product.name || "").trim(),
        tag: String(product.tag || "").trim(),
        blurb: String(product.blurb || "").trim(),
        nameEn: String(product.nameEn || "").trim(),
        tagEn: String(product.tagEn || "").trim(),
        blurbEn: String(product.blurbEn || "").trim(),
        ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
        ingredientsEn: Array.isArray(product.ingredientsEn) ? product.ingredientsEn : [],
        bpomNumber: String(product.bpomNumber || "").trim(),
        netContent: String(product.netContent || "").trim(),
        batchInfo: String(product.batchInfo || "").trim(),
        expiryInfo: String(product.expiryInfo || "").trim(),
        warnings: String(product.warnings || "").trim(),
        warningsEn: String(product.warningsEn || "").trim(),
        isArchived: false,
      };
      if (!payload.name) throw new Error("Nama produk wajib diisi.");
      if (product.id && adminProducts.find((item) => item.id === product.id)) {
        await setDoc(doc(db, "products", product.id), payload, { merge: true });
      } else {
        const newId = "p" + Date.now();
        await setDoc(doc(db, "products", newId), { ...payload, id: newId });
        addNotification(
          "Produk baru: " + payload.name,
          payload.blurb || "Lihat produk terbaru di Morgen Geschäft!",
          "/id#katalog",
          "produk",
          {
            titleEn: `New product: ${payload.nameEn || payload.name}`,
            bodyEn: payload.blurbEn || "Discover the latest product at Morgen Geschäft!",
            urlEn: "/en#catalog",
          }
        );
      }
      notifyProductsUpdated();
      setEditing(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = async (id) => {
    const product = adminProducts.find((item) => item.id === id);
    if (!product) return;
    const confirmation = window.prompt(`Arsipkan produk "${product.name}"? Ketik nama produk persis untuk melanjutkan.`);
    if (confirmation !== product.name) return;
    try {
      const firebaseUser = await assertAdminAccess();
      await setDoc(doc(db, "products", id), {
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: firebaseUser.email || "admin",
      }, { merge: true });
      notifyProductsUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const restoreProduct = async (product) => {
    if (!window.confirm(`Pulihkan produk "${product.name}" ke katalog aktif?`)) return;
    try {
      const firebaseUser = await assertAdminAccess();
      await setDoc(doc(db, "products", product.id), {
        isArchived: false,
        restoredAt: new Date().toISOString(),
        restoredBy: firebaseUser.email || "admin",
      }, { merge: true });
      notifyProductsUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const permanentlyDeleteProduct = async (product) => {
    const confirmation = window.prompt(`Hapus permanen produk "${product.name}"? Ketik HAPUS PERMANEN untuk melanjutkan.`);
    if (confirmation !== "HAPUS PERMANEN") return;
    try {
      await assertAdminAccess();
      await deleteDoc(doc(db, "products", product.id));
      notifyProductsUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const reorderProduct = async (product, direction) => {
    const ordered = [...activeAdminProducts].sort((a, b) => Number(a.order ?? 999999) - Number(b.order ?? 999999));
    const index = ordered.findIndex((item) => item.id === product.id);
    const newIndex = index + direction;
    if (index < 0 || newIndex < 0 || newIndex >= ordered.length) return;
    try {
      await assertAdminAccess();
      const target = ordered[newIndex];
      await setDoc(doc(db, "products", product.id), { order: newIndex }, { merge: true });
      await setDoc(doc(db, "products", target.id), { order: index }, { merge: true });
      notifyProductsUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const downloadBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      products: adminProducts,
      coupons: adminCoupons,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `morgen-geschaft-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resetData = async () => {
    if (resetConfirm !== "RESET") return;
    setResetting(true);
    try {
      const firebaseUser = await assertAdminAccess();
      await Promise.all(PRODUCTS_SEED.map((product) => setDoc(doc(db, "products", product.id), { ...product, isArchived: false }, { merge: true })));
      const extras = adminProducts.filter((product) => !PRODUCTS_SEED.some((seed) => seed.id === product.id));
      await Promise.all(extras.map((product) => setDoc(doc(db, "products", product.id), {
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: firebaseUser.email || "admin",
      }, { merge: true })));
      notifyProductsUpdated();
      setResetConfirm("");
      alert("Produk awal berhasil dipulihkan. Produk tambahan dipindahkan ke arsip, bukan dihapus permanen.");
    } catch (err) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  const [editingCoupon, setEditingCoupon] = useState(null);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const blankCoupon = { code: "", type: "percent", value: 0, desc: "", minOrder: 0, label: "", active: true, isPublic: true, singleUse: false };

  const saveCoupon = async (coupon) => {
    if (!coupon.code.trim()) return;
    setSavingCoupon(true);
    const code = coupon.code.trim().toUpperCase();
    const isNew = !adminCoupons.find((item) => item.code === code);
    try {
      await assertAdminAccess();
      await setDoc(doc(db, "coupons", code), {
        ...coupon,
        code,
        active: coupon.active !== false,
        isPublic: coupon.isPublic !== false,
        singleUse: coupon.singleUse === true,
      });
      if (isNew) addNotification(
        "Promo baru: " + code,
        coupon.type === "percent" ? `Diskon ${coupon.value}% — ${coupon.desc || "Gunakan sekarang!"}` : `Potongan ${formatIDR(coupon.value)} — ${coupon.desc || "Gunakan sekarang!"}`,
        "/#promo",
        "promo"
      );
      window.dispatchEvent(new CustomEvent("mg:public-content-updated", { detail: { type: "promotions" } }));
      setEditingCoupon(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingCoupon(false);
    }
  };

  const deleteCoupon = async (code) => {
    const confirmation = window.prompt(`Hapus kupon ${code}? Ketik kode kupon untuk melanjutkan.`);
    if (confirmation !== code) return;
    try {
      await assertAdminAccess();
      await deleteDoc(doc(db, "coupons", code));
      window.dispatchEvent(new CustomEvent("mg:public-content-updated", { detail: { type: "promotions" } }));
    } catch (err) {
      alert(err.message);
    }
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: <Package size={16} /> },
    { key: "produk", label: "Produk", icon: <ShoppingBag size={16} /> },
    { key: "pesanan", label: "Pesanan", icon: <Package size={16} /> },
    { key: "retur", label: "Komplain & Retur", icon: <RotateCcw size={16} /> },
    { key: "pengiriman", label: "Pengiriman", icon: <ExternalLink size={16} /> },
    { key: "promo", label: "Promo", icon: <Tag size={16} /> },
    { key: "flash-sale", label: "Flash Sale", icon: <Zap size={16} /> },
    { key: "blog", label: "Artikel", icon: <FileText size={16} /> },
    { key: "ulasan", label: "Ulasan", icon: <Star size={16} /> },
    { key: "notifikasi", label: "Notifikasi", icon: <Megaphone size={16} /> },
    { key: "stok-notify", label: "Permintaan Stok", icon: <Bell size={16} /> },
    { key: "pengaturan", label: "Pengaturan", icon: <Lock size={16} /> },
  ];

  const activeLabel = tabs.find((tab) => tab.key === adminTab)?.label || "Panel Admin";

  const navigateAdmin = (tab, preset = null) => {
    setAdminOrderPreset(tab === "pesanan" ? preset : null);
    setAdminTab(tab);
  };

  return (
    <div className="admin-panel-root">
      <div className="admin-panel-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <img src="/photos/logo-512.webp" alt="Morgen Geschäft" />
            <span><b>Panel Admin</b><small>{auth.currentUser?.email || "Admin"}</small></span>
          </div>
          <nav>
            {tabs.map((tab) => (
              <button key={tab.key} className={adminTab === tab.key ? "active" : ""} onClick={() => navigateAdmin(tab.key)}>
                {tab.icon}<span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="admin-workspace">
          <header className="admin-workspace-head">
            <div>
              <p>ADMINISTRASI TOKO</p>
              <h1>{activeLabel}</h1>
            </div>
            <div className="admin-header-actions">
              {adminTab === "produk" && (
                <>
                  <button className="secondary" onClick={() => setShowSiteQR(true)}>QR Website</button>
                  <button className="primary" onClick={() => setEditing(blank)}><Plus size={14} /> Produk</button>
                </>
              )}
              {adminTab === "promo" && <button className="primary" onClick={() => setEditingCoupon(blankCoupon)}><Plus size={14} /> Kupon</button>}
            </div>
          </header>

          <section className="admin-content-card">
            {adminTab === "dashboard" && <AdminDashboardTab products={activeAdminProducts} onNavigate={navigateAdmin} />}
            {adminTab === "pesanan" && <AdminOrdersTab preset={adminOrderPreset} />}
            {adminTab === "retur" && <AdminReturnsTab />}
            {adminTab === "pengiriman" && <AdminShippingTab />}
            {adminTab === "flash-sale" && <AdminFlashSalesTab products={activeAdminProducts} />}
            {adminTab === "blog" && <AdminBlogTab />}
            {adminTab === "ulasan" && <AdminReviewsTab />}
            {adminTab === "notifikasi" && <AdminPushTab />}
            {adminTab === "stok-notify" && <AdminStockNotifyTab />}

            {adminTab === "promo" && (
              <div className="admin-list-card">
                {adminCoupons.length === 0 && <p className="admin-muted">Belum ada kupon.</p>}
                {adminCoupons.map((coupon) => (
                  <div key={coupon.code} className="admin-generic-row">
                    <span>
                      <b>{coupon.code}</b>
                      <small>{coupon.label} · {coupon.desc} · {coupon.type === "percent" ? `${coupon.value}%` : formatIDR(coupon.value)}</small>
                      <small>{coupon.active === false ? "Nonaktif" : "Aktif"} · {coupon.isPublic !== false ? "Tampil di promo publik" : "Kode privat"}</small>
                    </span>
                    <span className="admin-row-buttons">
                      <button onClick={() => setEditingCoupon(coupon)}><Pencil size={14} /></button>
                      <button onClick={() => deleteCoupon(coupon.code)}><Trash2 size={14} color="#C97B5E" /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {adminTab === "produk" && (
              <div>
                <div className="admin-product-view-tabs">
                  <button className={productView === "active" ? "active" : ""} onClick={() => setProductView("active")}>Produk Aktif ({activeAdminProducts.length})</button>
                  <button className={productView === "archived" ? "active" : ""} onClick={() => setProductView("archived")}>Diarsipkan ({archivedAdminProducts.length})</button>
                </div>

                <div className="admin-data-toolbar">
                  <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama, ID, atau label produk..." />
                  <select value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)}>
                    <option value="all">Semua kategori</option>
                    {CATEGORIES.filter((category) => category.id !== "semua").map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                  </select>
                  {productView === "active" && (
                    <select value={productStockFilter} onChange={(event) => setProductStockFilter(event.target.value)}>
                      <option value="all">Semua stok</option>
                      <option value="out">Stok habis</option>
                      <option value="low">Stok menipis (1–3)</option>
                      <option value="safe">Stok aman (&gt;3)</option>
                    </select>
                  )}
                  <select value={productSort} onChange={(event) => setProductSort(event.target.value)}>
                    <option value="default">Urutan katalog</option>
                    <option value="name">Nama A–Z</option>
                    <option value="price-low">Harga termurah</option>
                    <option value="price-high">Harga termahal</option>
                    <option value="stock-low">Stok paling sedikit</option>
                    <option value="stock-high">Stok paling banyak</option>
                  </select>
                </div>

                <div className="admin-list-card">
                  {pagedAdminProducts.length === 0 && <p className="admin-muted" style={{ padding: "18px" }}>{productView === "archived" ? "Belum ada produk diarsipkan." : "Tidak ada produk yang sesuai filter."}</p>}
                  {pagedAdminProducts.map((product) => {
                    const orderedIndex = activeAdminProducts.findIndex((item) => item.id === product.id);
                    return (
                      <div key={product.id} className={`admin-generic-row admin-product-row ${product.isArchived ? "archived" : ""}`}>
                        <span className="admin-product-main">
                          {canReorderProducts ? (
                            <span className="admin-reorder-buttons">
                              <button onClick={() => reorderProduct(product, -1)} disabled={orderedIndex <= 0}>▲</button>
                              <button onClick={() => reorderProduct(product, 1)} disabled={orderedIndex < 0 || orderedIndex === activeAdminProducts.length - 1}>▼</button>
                            </span>
                          ) : <span className="admin-reorder-placeholder" />}
                          {product.image && <img src={resolveProductImage(product)} alt={product.name} loading="lazy" />}
                          <span>
                            <b>{product.name}</b>
                            <small>{formatIDR(Number(product.price || 0))} · stok {product.stock || 0} · {CATEGORIES.find((category) => category.id === product.category)?.label || "-"}</small>
                            {product.isArchived && <small className="admin-archive-meta">Diarsipkan {adminDateLabel(product.archivedAt)} · {product.archivedBy || "admin"}</small>}
                          </span>
                        </span>
                        <span className="admin-row-buttons">
                          {product.isArchived ? (
                            <>
                              <button onClick={() => restoreProduct(product)} title="Pulihkan produk">Pulihkan</button>
                              <button className="danger" onClick={() => permanentlyDeleteProduct(product)} title="Hapus permanen"><Trash2 size={14} color="#C97B5E" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setQrProduct(product)} title="QR produk"><ExternalLink size={14} /></button>
                              <button onClick={() => setEditing(product)} title="Edit produk"><Pencil size={14} /></button>
                              <button onClick={() => archiveProduct(product.id)} title="Arsipkan produk"><Trash2 size={14} color="#C97B5E" /></button>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <AdminPagination page={productPage} totalPages={totalProductPages} onChange={setProductPage} totalItems={filteredAdminProducts.length} label="produk" />
              </div>
            )}

            {adminTab === "pengaturan" && (
              <div className="admin-settings-grid">
                <article>
                  <h3>Backup data</h3>
                  <p>Unduh salinan produk dan kupon sebelum melakukan perubahan besar.</p>
                  <button className="secondary" onClick={downloadBackup}>Unduh backup JSON</button>
                </article>
                <article className="danger-zone">
                  <h3>Reset produk</h3>
                  <p>Memulihkan produk bawaan. Produk tambahan akan diarsipkan dan tidak dihapus permanen.</p>
                  <label>Ketik <b>RESET</b> untuk mengaktifkan tombol.</label>
                  <input value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} placeholder="RESET" />
                  <button className="danger" disabled={resetConfirm !== "RESET" || resetting} onClick={resetData}>{resetting ? "Memproses..." : "Reset produk"}</button>
                </article>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* QR Code Modal */}
      {qrProduct && <ProductQRModal product={qrProduct} siteUrl={siteUrl} onClose={() => setQrProduct(null)} />}

      {/* Site QR Modal */}
      {showSiteQR && (
        <div className="admin-modal-backdrop admin-qr-backdrop" onClick={() => setShowSiteQR(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="admin-site-qr-title" className="admin-compact-modal" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", maxWidth: "380px", width: "100%", padding: "28px", textAlign: "center", fontFamily: "'Work Sans', sans-serif" }}>
            <img src="/photos/logo-512.webp" alt="Logo" style={{ width: 40, height: 40, margin: "0 auto 8px" }} />
            <h3 id="admin-site-qr-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", color: "#162B45", marginBottom: "4px" }}>Morgen Geschäft</h3>
            <p style={{ fontSize: "11px", color: "#A39E8E", marginBottom: "16px" }}>{siteUrl}</p>
            <img src={generateQRUrl(siteUrl, 300)} alt="QR Code Website" loading="lazy" style={{ width: "200px", height: "200px", margin: "0 auto 16px", border: "1px solid #E3DCC9" }} />
            <p style={{ fontSize: "12px", color: "#6B6558", marginBottom: "16px" }}>Scan untuk mengunjungi website Morgen Geschäft</p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button onClick={async () => {
                try {
                  const res = await fetch(generateQRUrl(siteUrl, 400));
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "QR-Morgen-Geschaft-Website.png"; a.click();
                  URL.revokeObjectURL(url);
                } catch { alert("Gagal download. Klik kanan gambar → Save Image."); }
              }} style={{ background: "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "13px", padding: "8px 20px", border: "none", cursor: "pointer" }}>
                Download PNG
              </button>
              <button onClick={() => navigator.clipboard.writeText(siteUrl)} style={{ border: "1px solid #E3DCC9", background: "#fff", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", padding: "8px 20px", cursor: "pointer", color: "#6B6558" }}>
                Copy URL
              </button>
              <button onClick={() => setShowSiteQR(false)} style={{ border: "1px solid #E3DCC9", background: "#fff", fontFamily: "'Work Sans', sans-serif", fontSize: "13px", padding: "8px 20px", cursor: "pointer", color: "#6B6558" }}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edit produk */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,46,34,0.5)", zIndex: 60 }} className="admin-modal-backdrop flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="admin-product-editor-title" className="admin-product-editor-modal" style={{ background: "#F6F1E7", width: "420px", padding: "24px", border: "1px solid #E3DCC9", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 id="admin-product-editor-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "18px" }} className="mb-3">{editing.id ? "Edit produk" : "Produk baru"}</h3>
            {["name", "tag", "blurb"].map((f) => (
              <input key={f} value={editing[f] || ""} onChange={(e) => setEditing({ ...editing, [f]: e.target.value })} placeholder={f === "name" ? "Nama produk" : f === "tag" ? "Label (mis. NIACINAMIDE · OILY)" : "Deskripsi singkat"} style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
            ))}

            <div style={{ margin: "10px 0 12px", padding: "12px", border: "1px solid #D7D0C2", borderRadius: "10px", background: "#FFFDF8" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: ".08em", color: "#4C6354", marginBottom: "8px" }}>VERSI ENGLISH</p>
              <input value={editing.nameEn || ""} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} placeholder="English product name" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
              <input value={editing.tagEn || ""} onChange={(e) => setEditing({ ...editing, tagEn: e.target.value })} placeholder="English label" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
              <input value={editing.blurbEn || ""} onChange={(e) => setEditing({ ...editing, blurbEn: e.target.value })} placeholder="Short English description" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm outline-none" />
            </div>

            {/* Image upload + manual path */}
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558", marginBottom: "4px" }}>Foto utama</p>
            <div className="flex gap-2 mb-2">
              <input value={editing.image || ""} onChange={(e) => setEditing({ ...editing, image: e.target.value })} placeholder="URL atau path (mis. /photos/nama.png)" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff", flex: 1 }} className="px-3 py-2 text-sm outline-none" />
              <AdminImageUpload
                onUploaded={(url) => {
                  setEditing((prev) => ({
                    ...prev,
                    image: url,
                    images: prev.images && prev.images.length > 0 ? [url, ...prev.images.slice(1)] : [url],
                  }));
                }}
              />
            </div>
            {editing.image && (
              <div style={{ height: "80px", border: "1px solid #E3DCC9", marginBottom: "8px" }} className="flex items-center justify-center overflow-hidden">
                <img src={resolveProductImage(editing)} alt="Preview" loading="lazy" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
              </div>
            )}

            {/* Additional images */}
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558", marginBottom: "4px" }}>Foto tambahan</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
              {(editing.images || []).map((img, idx) => (
                <div key={idx} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <img src={resolveProductImage(img)} alt="" loading="lazy" style={{ width: 32, height: 32, objectFit: "cover", border: "1px solid #E3DCC9", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />
                  <input value={img} onChange={(e) => { const imgs = [...(editing.images || [])]; imgs[idx] = e.target.value; setEditing({ ...editing, images: imgs }); }} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", border: "1px solid #E3DCC9", background: "#fff", flex: 1, padding: "4px 6px", outline: "none" }} />
                  <button onClick={() => { const imgs = (editing.images || []).filter((_, i) => i !== idx); setEditing({ ...editing, images: imgs }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#C97B5E", fontSize: "14px", padding: "0 4px" }}>×</button>
                </div>
              ))}
              <AdminImageUpload
                onUploaded={(url) => setEditing((prev) => ({ ...prev, images: [...(prev.images || []), url] }))}
                label="+ Upload foto"
              />
            </div>

            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558", marginBottom: "4px" }}>Bahan aktif (koma dipisah)</p>
            <input value={(editing.ingredients || []).join(", ")} onChange={(e) => setEditing({ ...editing, ingredients: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="Salicylic Acid, Niacinamide, Glycerin" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558", marginBottom: "4px" }}>Active ingredients — English (comma-separated)</p>
            <input value={(editing.ingredientsEn || []).join(", ")} onChange={(e) => setEditing({ ...editing, ingredientsEn: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="Salicylic Acid, Niacinamide, Glycerin" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
            <div style={{ margin: "10px 0", padding: "12px", border: "1px solid #D7D0C2", borderRadius: "10px", background: "#FFFDF8" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: ".08em", color: "#4C6354", marginBottom: "8px" }}>KEPERCAYAAN & KEPATUHAN PRODUK</p>
              <div className="flex gap-2 mb-2">
                <input value={editing.bpomNumber || ""} onChange={(e) => setEditing({ ...editing, bpomNumber: e.target.value })} placeholder="Nomor BPOM" className="w-1/2 px-3 py-2 text-sm outline-none" style={{ border: "1px solid #E3DCC9", background: "#fff" }} />
                <input value={editing.netContent || ""} onChange={(e) => setEditing({ ...editing, netContent: e.target.value })} placeholder="Isi bersih, mis. 100 ml" className="w-1/2 px-3 py-2 text-sm outline-none" style={{ border: "1px solid #E3DCC9", background: "#fff" }} />
              </div>
              <div className="flex gap-2 mb-2">
                <input value={editing.batchInfo || ""} onChange={(e) => setEditing({ ...editing, batchInfo: e.target.value })} placeholder="Info batch" className="w-1/2 px-3 py-2 text-sm outline-none" style={{ border: "1px solid #E3DCC9", background: "#fff" }} />
                <input value={editing.expiryInfo || ""} onChange={(e) => setEditing({ ...editing, expiryInfo: e.target.value })} placeholder="Info kedaluwarsa" className="w-1/2 px-3 py-2 text-sm outline-none" style={{ border: "1px solid #E3DCC9", background: "#fff" }} />
              </div>
              <textarea value={editing.warnings || ""} onChange={(e) => setEditing({ ...editing, warnings: e.target.value })} placeholder="Peringatan pemakaian dan penyimpanan" rows={2} className="w-full px-3 py-2 text-sm mb-2 outline-none" style={{ border: "1px solid #E3DCC9", background: "#fff", resize: "vertical" }} />
              <textarea value={editing.warningsEn || ""} onChange={(e) => setEditing({ ...editing, warningsEn: e.target.value })} placeholder="Usage and storage warning — English" rows={2} className="w-full px-3 py-2 text-sm outline-none" style={{ border: "1px solid #E3DCC9", background: "#fff", resize: "vertical" }} />
            </div>
            <div className="flex gap-2 mb-2">
              <input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} placeholder="Harga" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-1/2 px-3 py-2 text-sm outline-none" />
              <input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} placeholder="Stok" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-1/2 px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex gap-2 mb-3">
              <select value={editing.category || "facewash"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff", padding: "8px 10px", fontSize: "13px", outline: "none", appearance: "none", cursor: "pointer", flex: 1 }}>
                {CATEGORIES.filter(c => c.id !== "semua").map(c => (<option key={c.id} value={c.id}>{c.label}</option>))}
              </select>
              <input type="number" value={editing.originalPrice || ""} onChange={(e) => setEditing({ ...editing, originalPrice: Number(e.target.value) || 0 })} placeholder="Harga asli (bundle)" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff", flex: 1, padding: "8px 10px", fontSize: "13px", outline: "none" }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => save(editing)} disabled={saving} style={{ background: saving ? "#4C6354" : "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, opacity: saving ? 0.7 : 1 }} className="flex-1 py-2 text-sm">{saving ? "Menyimpan..." : "Simpan"}</button>
              <button onClick={() => setEditing(null)} style={{ border: "1px solid #E3DCC9", fontFamily: "'Work Sans', sans-serif" }} className="flex-1 py-2 text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edit kupon */}
      {editingCoupon && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,46,34,0.5)", zIndex: 60 }} className="admin-modal-backdrop flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="admin-coupon-editor-title" className="admin-coupon-editor-modal" style={{ background: "#F6F1E7", width: "380px", padding: "24px", border: "1px solid #E3DCC9" }}>
            <h3 id="admin-coupon-editor-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "18px" }} className="mb-3">{editingCoupon.code ? "Edit kupon" : "Kupon baru"}</h3>
            <input value={editingCoupon.code} onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })} placeholder="Kode kupon" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 mb-2 outline-none" />
            <input value={editingCoupon.label} onChange={(e) => setEditingCoupon({ ...editingCoupon, label: e.target.value })} placeholder="Label (mis. 20% OFF)" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
            <input value={editingCoupon.desc} onChange={(e) => setEditingCoupon({ ...editingCoupon, desc: e.target.value })} placeholder="Deskripsi" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
            <div className="flex gap-2 mb-2">
              <select value={editingCoupon.type} onChange={(e) => setEditingCoupon({ ...editingCoupon, type: e.target.value })} style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff", padding: "8px 10px", fontSize: "13px", outline: "none", appearance: "none", cursor: "pointer" }} className="w-1/2">
                <option value="percent">Persen (%)</option><option value="fixed">Nominal (Rp)</option>
              </select>
              <input type="number" value={editingCoupon.value} onChange={(e) => setEditingCoupon({ ...editingCoupon, value: Number(e.target.value) })} placeholder="Nilai" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-1/2 px-3 py-2 text-sm outline-none" />
            </div>
            <input type="number" value={editingCoupon.minOrder} onChange={(e) => setEditingCoupon({ ...editingCoupon, minOrder: Number(e.target.value) })} placeholder="Min. order (0 = tanpa min.)" style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff" }} className="w-full px-3 py-2 text-sm mb-2 outline-none" />
            <div className="admin-coupon-options">
              <div>
                <label style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "11px", color: "#6B6558", display: "block", marginBottom: "4px" }}>Kedaluwarsa (opsional)</label>
                <input type="date" value={editingCoupon.expiresAt ? (editingCoupon.expiresAt.length > 10 ? editingCoupon.expiresAt.slice(0, 10) : editingCoupon.expiresAt) : ""} onChange={(e) => setEditingCoupon({ ...editingCoupon, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ fontFamily: "'Work Sans', sans-serif", border: "1px solid #E3DCC9", background: "#fff", width: "100%", padding: "8px 10px", fontSize: "13px", outline: "none" }} />
              </div>
              <label>
                <input type="checkbox" checked={editingCoupon.singleUse === true} onChange={(e) => setEditingCoupon({ ...editingCoupon, singleUse: e.target.checked })} />
                1× per pelanggan
              </label>
              <label>
                <input type="checkbox" checked={editingCoupon.active !== false} onChange={(e) => setEditingCoupon({ ...editingCoupon, active: e.target.checked })} />
                Kupon aktif
              </label>
              <label>
                <input type="checkbox" checked={editingCoupon.isPublic !== false} onChange={(e) => setEditingCoupon({ ...editingCoupon, isPublic: e.target.checked })} />
                Tampilkan di bagian promo publik
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => saveCoupon(editingCoupon)} disabled={savingCoupon} style={{ background: savingCoupon ? "#4C6354" : "#1F2E22", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }} className="flex-1 py-2 text-sm">{savingCoupon ? "Menyimpan..." : "Simpan"}</button>
              <button onClick={() => setEditingCoupon(null)} style={{ border: "1px solid #E3DCC9", fontFamily: "'Work Sans', sans-serif" }} className="flex-1 py-2 text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminPagination, AdminImageUpload } from "./adminShared.jsx";
export { AdminDashboardTab } from "./AdminDashboardTab.jsx";
export { AdminOrdersTab } from "./AdminOrdersTab.jsx";
export { AdminReviewsTab } from "./AdminReviewsTab.jsx";
export { AdminPushTab } from "./AdminPushTab.jsx";
export { AdminStockNotifyTab } from "./AdminStockNotifyTab.jsx";
export { AdminShippingTab } from "./AdminShippingTab.jsx";
export { AdminBlogTab } from "./AdminBlogTab.jsx";
