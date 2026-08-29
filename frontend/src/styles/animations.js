// styles/animations.js
// Lapisan micro-interaksi & animasi modern. Disuntik PALING AKHIR (setelah
// APP_GLOBAL_STYLES & APP_REVEAL_STYLES) agar konsisten menang di cascade.
// Gerak besar dibungkus `prefers-reduced-motion: no-preference` — pengguna yang
// meminta pengurangan animasi tetap dapat transisi warna/bayangan yang halus,
// tanpa transform/kilau yang mengganggu.

export const APP_ANIMATION_STYLES = `
/* Transisi dasar yang halus (aman untuk semua) */
.premium-product-card,
.marketplace-card-premium,
.install-premium-card,
.faq-contact-card-premium,
.premium-primary-btn,
.premium-icon-btn {
  transition: transform .34s cubic-bezier(.2,.72,.2,1),
              box-shadow .34s cubic-bezier(.2,.72,.2,1),
              border-color .25s ease,
              background-color .25s ease,
              opacity .2s ease;
}
.premium-product-image { transition: transform .55s cubic-bezier(.2,.72,.2,1); will-change: transform; }

/* Fokus keyboard yang jelas — aksesibilitas + tampilan rapi */
a:focus-visible,
button:focus-visible,
[role="button"]:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid #F59A1A;
  outline-offset: 2px;
  border-radius: 6px;
}

@keyframes mgFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: no-preference) {
  /* Kartu produk: terangkat + bayangan lembut + gambar sedikit membesar */
  .premium-product-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 44px -20px rgba(22, 43, 69, .30);
  }
  .premium-product-card:hover .premium-product-image { transform: scale(1.06); }

  /* Kartu lain (marketplace, install, kontak FAQ) */
  .marketplace-card-premium:hover,
  .install-premium-card:hover,
  .faq-contact-card-premium:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 36px -18px rgba(22, 43, 69, .24);
  }

  /* Tombol utama: terangkat, ada tekanan saat diklik, kilau lembut saat hover */
  .premium-primary-btn { position: relative; overflow: hidden; }
  .premium-primary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px -12px rgba(22, 43, 69, .45);
  }
  .premium-primary-btn:active { transform: translateY(0) scale(.98); }
  .premium-primary-btn::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent 25%, rgba(255, 255, 255, .28) 50%, transparent 75%);
    transform: translateX(-130%);
    transition: transform .7s cubic-bezier(.2, .72, .2, 1);
    pointer-events: none;
  }
  .premium-primary-btn:hover::after { transform: translateX(130%); }

  /* Tombol ikon */
  .premium-icon-btn:hover { transform: translateY(-1px) scale(1.08); }
  .premium-icon-btn:active { transform: scale(.92); }

  /* Konten hero muncul lembut saat halaman dibuka */
  .hero-content { animation: mgFadeUp .7s cubic-bezier(.2, .72, .2, 1) both; }
}

/* ============================================================
   Animasi SCROLL modern (bukan hover) — kartu muncul saat masuk
   viewport, terhubung ke posisi scroll. Pakai animation-timeline
   view() yang ringan (tanpa JS). Browser lama abaikan via @supports,
   konten tetap tampil normal.
   ============================================================ */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    @keyframes mgScrollFade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes mgScrollRise {
      from { opacity: 0; transform: translateY(34px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Kartu yang PUNYA efek hover (transform) → hanya fade opacity saat scroll,
       supaya tidak bentrok dengan transform hover. */
    .premium-product-card,
    .marketplace-card-premium,
    .install-premium-card,
    .faq-contact-card-premium {
      animation: mgScrollFade linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 40%;
    }

    /* Kartu tanpa hover → boleh naik + fade untuk efek lebih hidup. */
    .premium-blog-card,
    .about-stat-card {
      animation: mgScrollRise linear both;
      animation-timeline: view();
      animation-range: entry 5% entry 45%;
    }
  }
}

/* ============================================================
   Interaksi & idle animations tambahan
   ============================================================ */

/* Scroll progress bar (garis tipis di atas) — terisi mengikuti scroll halaman.
   Browser tanpa scroll-timeline: bar tetap kosong (tak tampil) — aman. */
.mg-scroll-progress {
  position: fixed;
  top: 0; left: 0;
  height: 3px; width: 100%;
  transform: scaleX(0);
  transform-origin: 0 50%;
  background: linear-gradient(90deg, #F59A1A, #C97B5E);
  z-index: 10000;
  pointer-events: none;
}
@supports (animation-timeline: scroll()) {
  .mg-scroll-progress {
    animation: mgScrollProgress linear;
    animation-timeline: scroll(root);
  }
  @keyframes mgScrollProgress { to { transform: scaleX(1); } }
}

@media (prefers-reduced-motion: no-preference) {
  /* Badge keranjang memantul saat jumlah berubah (di-remount via key) */
  .mg-cart-badge { animation: mgBadgePop .42s cubic-bezier(.2, 1.5, .4, 1); }
  @keyframes mgBadgePop {
    0%   { transform: scale(0); }
    60%  { transform: scale(1.35); }
    100% { transform: scale(1); }
  }

  /* Tombol "Ditambahkan" berdenyut singkat */
  .product-card-cart.mg-added { animation: mgAddedPulse .4s ease; }
  @keyframes mgAddedPulse {
    0%   { transform: scale(1); }
    45%  { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  /* Maskot GESA mengambang lembut. Pakai properti \`translate\` (bukan transform)
     agar tidak bentrok dengan hover scale pada launcher. */
  .gesa-launcher { animation: mgFloat 3.6s ease-in-out infinite; }
  @keyframes mgFloat {
    0%, 100% { translate: 0 0; }
    50%      { translate: 0 -7px; }
  }


  /* Item menu mobile muncul berurutan saat drawer dibuka */
  .mg-drawer-list > * { animation: mgFadeUp .42s cubic-bezier(.2, .72, .2, 1) both; }
  .mg-drawer-list > *:nth-child(1) { animation-delay: .03s; }
  .mg-drawer-list > *:nth-child(2) { animation-delay: .07s; }
  .mg-drawer-list > *:nth-child(3) { animation-delay: .11s; }
  .mg-drawer-list > *:nth-child(4) { animation-delay: .15s; }
  .mg-drawer-list > *:nth-child(5) { animation-delay: .19s; }
  .mg-drawer-list > *:nth-child(6) { animation-delay: .23s; }
  .mg-drawer-list > *:nth-child(7) { animation-delay: .27s; }
  .mg-drawer-list > *:nth-child(n+8) { animation-delay: .3s; }
}
`;
