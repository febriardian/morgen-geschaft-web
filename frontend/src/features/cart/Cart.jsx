import { X, Plus, Minus, Leaf, ChevronRight, Trash2, Heart } from "lucide-react";
import { formatIDR, resolveProductImage } from "../../utils/general.js";
import { useModalAccessibility } from "../../hooks/useModalAccessibility.js";




// ---------- Wishlist Drawer ----------

function WishlistDrawer({ open, onClose, wishlist, onRemove, onAdd, onAddAll, onBrowseCatalog }) {
  const availableItems = wishlist.filter((item) => Number(item.stock || 0) > 0);
  const drawerRef = useModalAccessibility({ open, onClose });

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(22,43,69,0.46)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            zIndex: 49,
            transition: "opacity 0.25s",
          }}
        />
      )}

      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wishlist-drawer-title"
        aria-hidden={!open}
        tabIndex={-1}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(390px, 100%)",
          background: "#F6F1E7",
          borderLeft: "1px solid #E3DCC9",
          zIndex: 50,
          borderRadius: "18px 0 0 18px",
          overflow: "hidden",
          boxShadow: open ? "-18px 0 48px rgba(22,43,69,.13)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: "1px solid #E3DCC9", background: "rgba(255,255,255,.30)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Heart size={17} color="#C97B5E" fill="#C97B5E" />
            <div>
              <h2 id="wishlist-drawer-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", color: "#162B45", margin: 0 }}>Wishlist</h2>
              {wishlist.length > 0 && (
                <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#9A9486", margin: "2px 0 0" }}>
                  {wishlist.length} produk tersimpan
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup wishlist"
            style={{ width: "34px", height: "34px", display: "grid", placeItems: "center", background: "#fff", border: "1px solid #DED6C5", borderRadius: "9px", cursor: "pointer" }}
          >
            <X size={18} color="#162B45" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {wishlist.length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 18px" }}>
              <div style={{ width: "58px", height: "58px", borderRadius: "16px", background: "#FFFDF8", border: "1px solid #E3DCC9", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                <Heart size={26} color="#C9C2AD" strokeWidth={1.3} />
              </div>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", color: "#162B45", marginBottom: "6px" }}>Wishlist masih kosong</p>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#8F897C", lineHeight: 1.65, margin: "0 auto 18px", maxWidth: "250px" }}>
                Simpan produk yang menarik agar mudah ditemukan lagi.
              </p>
              <button
                type="button"
                onClick={() => { onClose(); onBrowseCatalog?.(); }}
                style={{ background: "#1F2E22", color: "#F6F1E7", border: "none", borderRadius: "9px", padding: "10px 16px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
              >
                Lihat katalog
              </button>
            </div>
          )}

          {wishlist.map((item) => {
            const stock = Number(item.stock || 0);
            const outOfStock = stock <= 0;
            const stockLabel = outOfStock ? "Stok habis" : stock <= 3 ? `Stok tersisa ${stock}` : "Stok tersedia";

            return (
              <div key={item.id} style={{ background: "#fff", border: "1px solid #E3DCC9", borderRadius: "12px", padding: "11px", boxShadow: "0 8px 20px rgba(22,43,69,.035)" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  {item.image ? (
                    <img src={resolveProductImage(item)} alt={item.name} loading="lazy" style={{ width: "64px", height: "64px", objectFit: "cover", flexShrink: 0, border: "1px solid #E3DCC9", borderRadius: "10px" }} />
                  ) : (
                    <div style={{ width: "64px", height: "64px", background: "#DCE6D6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", border: "1px solid #E3DCC9" }}>
                      <Leaf size={21} color="#4C6354" />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: "13px", color: "#162B45", lineHeight: 1.35, margin: "0 0 4px" }}>{item.name}</p>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#1F2E22", fontWeight: 600, margin: 0 }}>{formatIDR(item.price)}</p>
                    <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: outOfStock ? "#A9573D" : stock <= 3 ? "#9A6B3F" : "#4C6354", margin: "5px 0 0" }}>
                      {stockLabel}
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "11px" }}>
                  <button
                    onClick={() => onAdd(item)}
                    disabled={outOfStock}
                    style={{
                      minHeight: "36px",
                      background: outOfStock ? "#D4CEBF" : "#1F2E22",
                      color: "#F6F1E7",
                      fontFamily: "'Work Sans', sans-serif",
                      fontSize: "11px",
                      fontWeight: 700,
                      border: "none",
                      cursor: outOfStock ? "not-allowed" : "pointer",
                      padding: "7px 12px",
                      borderRadius: "9px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <Plus size={13} /> {outOfStock ? "Stok habis" : "Tambah ke keranjang"}
                  </button>
                  <button
                    onClick={() => onRemove(item)}
                    style={{ minHeight: "36px", background: "#fff", color: "#A9573D", border: "1px solid #E1B7AA", borderRadius: "9px", cursor: "pointer", padding: "7px 11px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", fontFamily: "'Work Sans', sans-serif", fontSize: "11px", fontWeight: 600 }}
                    title="Hapus dari wishlist"
                    aria-label={`Hapus ${item.name} dari wishlist`}
                  >
                    <Trash2 size={13} /> Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {wishlist.length > 0 && (
          <div style={{ padding: "14px 16px 16px", borderTop: "1px solid #E3DCC9", background: "rgba(255,255,255,.24)" }}>
            {wishlist.length > 1 && (
              <button
                type="button"
                onClick={() => onAddAll?.(availableItems)}
                disabled={availableItems.length === 0}
                style={{ width: "100%", minHeight: "42px", background: availableItems.length === 0 ? "#D4CEBF" : "#1F2E22", color: "#F6F1E7", border: "none", borderRadius: "9px", padding: "10px 14px", fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 700, cursor: availableItems.length === 0 ? "not-allowed" : "pointer" }}
              >
                Tambah semua ke keranjang ({availableItems.length})
              </button>
            )}
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "10px", color: "#8F897C", textAlign: "center", margin: wishlist.length > 1 ? "8px 0 0" : 0 }}>
              {availableItems.length} dari {wishlist.length} produk tersedia
            </p>
          </div>
        )}
      </aside>
    </>
  );
}



// ---------- Cart drawer (dengan gambar produk) ----------

function CartDrawer({ open, onClose, cart, onQty, onCheckout }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const drawerRef = useModalAccessibility({ open, onClose });
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, background: "rgba(22,43,69,0.46)",
            backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
            zIndex: 49, transition: "opacity 0.25s",
          }}
        />
      )}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        aria-hidden={!open}
        tabIndex={-1}
        style={{
          position: "fixed", top: 0, right: 0, height: "100%", width: "min(380px, 100%)",
          background: "#F6F1E7", borderLeft: "1px solid #E3DCC9", zIndex: 50,
          borderRadius: "18px 0 0 18px", overflow: "hidden",
          boxShadow: open ? "-18px 0 48px rgba(22,43,69,.13)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease, box-shadow 0.25s ease", display: "flex", flexDirection: "column",
        }}
      >
      <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid #E3DCC9", background: "rgba(255,255,255,.28)" }}>
        <h2 id="cart-drawer-title" style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", color: "#162B45" }}>Keranjang</h2>
        <button onClick={onClose} aria-label="Tutup keranjang" style={{ width: "34px", height: "34px", display: "grid", placeItems: "center", border: "1px solid #DED6C5", background: "#fff", borderRadius: "9px", cursor: "pointer" }}><X size={18} color="#162B45" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {cart.length === 0 && (
          <p style={{ fontFamily: "'Work Sans', sans-serif", color: "#6B6558", fontSize: "14px" }}>
            Keranjang masih kosong. Pilih produk dulu, ya.
          </p>
        )}
        {cart.map((item) => (
          <div key={item.id} className="flex gap-3 items-start">
            {/* FIX: tampilkan gambar produk, bukan ikon daun */}
            <div style={{ width: 56, height: 56, background: "#DCE6D6", flexShrink: 0, overflow: "hidden", borderRadius: "10px", border: "1px solid #E3DCC9" }}>
              {item.image ? (
                <img src={resolveProductImage(item)} alt={item.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Leaf size={18} color="#4C6354" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "13px", fontWeight: 600, color: "#162B45" }}>{item.name}</p>
              <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558" }}>{formatIDR(item.price)}</p>
              <div className="flex items-center gap-2 mt-1">
                <button aria-label="Kurangi jumlah" onClick={() => onQty(item.id, -1)} style={{ border: "1px solid #E3DCC9", background: "#fff", borderRadius: "8px" }} className="p-1"><Minus size={12} /></button>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>{item.qty}</span>
                <button aria-label="Tambah jumlah" onClick={() => onQty(item.id, 1)} style={{ border: "1px solid #E3DCC9", background: "#fff", borderRadius: "8px" }} className="p-1"><Plus size={12} /></button>
              </div>
            </div>
            <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", fontWeight: 600, color: "#1F2E22", whiteSpace: "nowrap" }}>
              {formatIDR(item.price * item.qty)}
            </p>
          </div>
        ))}
      </div>
      <div className="p-4" style={{ borderTop: "1px solid #E3DCC9" }}>
        <div className="flex justify-between mb-3" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          <span style={{ color: "#6B6558", fontSize: "14px" }}>Total</span>
          <span style={{ fontWeight: 600, color: "#162B45", fontSize: "16px" }}>{formatIDR(total)}</span>
        </div>
        <button
          disabled={cart.length === 0}
          onClick={onCheckout}
          style={{ background: cart.length === 0 ? "#C9C2AD" : "#C97B5E", color: "#F6F1E7", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, borderRadius: "9px", boxShadow: cart.length === 0 ? "none" : "0 10px 22px rgba(201,123,94,.18)" }}
          className="w-full py-3 flex items-center justify-center gap-1"
        >
          Checkout <ChevronRight size={16} />
        </button>
      </div>
    </div>
    </>
  );
}

export { WishlistDrawer, CartDrawer };
