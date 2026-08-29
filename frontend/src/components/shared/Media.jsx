import { useState, useEffect, useRef } from "react";
// ========== OPTIMIZED IMAGE COMPONENT ==========
// Wraps <img> with WebP <source> in <picture>, srcset for responsive sizes, and native lazy loading.
// For product images loaded from Firestore/dynamic paths, generates WebP path from original.
// For static assets processed by vite-imagetools at build time, just pass the imported URL.
function OptimizedImage({ src, alt, width, height, sizes, className, style, loading = "lazy", priority = false }) {
  if (!src) return null;

  // Only generate WebP for local static files with proper extensions (no spaces, no external URLs)
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  const hasImageExt = /\.(png|jpe?g)$/i.test(src);
  const hasWebP = isLocal && hasImageExt;
  const productMatch = src.match(/^\/photos\/Product\s+(\d+)\.webp(?:[?#].*)?$/i);
  const productThumbnailBase = productMatch
    ? `/photos/thumbs/product-${productMatch[1]}`
    : "";
  // Encode spaces for srcSet (spaces are srcset delimiters)
  const webpSrc = hasWebP ? src.replace(/\.(png|jpe?g)$/i, ".webp").replace(/ /g, "%20") : null;

  const imgProps = {
    src: productThumbnailBase ? `${productThumbnailBase}-640.webp` : src,
    alt: alt || "",
    loading: priority ? "eager" : loading,
    decoding: priority ? "sync" : "async",
    width,
    height,
    className,
    style: { ...style },
  };
  // fetchpriority must be lowercase for DOM
  if (priority) imgProps.fetchpriority = "high";
  if (sizes) imgProps.sizes = sizes;
  if (productThumbnailBase) {
    imgProps.srcSet = [
      `${productThumbnailBase}-320.webp 320w`,
      `${productThumbnailBase}-640.webp 640w`,
      `${productThumbnailBase}-960.webp 960w`,
    ].join(", ");
  }

  if (webpSrc) {
    return (
      <picture>
        <source srcSet={webpSrc} type="image/webp" />
        <img {...imgProps} />
      </picture>
    );
  }
  return <img {...imgProps} />;
}



// ---------- Small building blocks ----------

function LabTag({ text }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "9px",
        lineHeight: 1.5,
        letterSpacing: "0.02em",
        color: "#F6F1E7",
        background: "#1F2E22",
        border: "1px dashed #4C6354",
        padding: "4px 8px",
        display: "inline-block",
        textWrap: "balance",
        transform: "rotate(-1.5deg)",
      }}
    >
      {text}
    </div>
  );
}




// ---------- About stat card with subtle reveal ----------
function AboutStatCard({ item, index }) {
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.22 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Count-up: animasikan bagian angka dari item.num (mis. "9+", "Rp26rb") saat
  // kartu terlihat. Nilai non-angka ("Original") ditampilkan apa adanya.
  const [display, setDisplay] = useState(item.num);
  useEffect(() => {
    if (!visible) return undefined;
    const match = /^(\D*)(\d+)(.*)$/.exec(String(item.num));
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!match || reduce) { setDisplay(item.num); return undefined; }
    const [, prefix, digits, suffix] = match;
    const target = parseInt(digits, 10);
    const startAt = performance.now();
    const duration = 900;
    let raf = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(`${prefix}${Math.round(target * eased)}${suffix}`);
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, item.num]);

  return (
    <div
      ref={cardRef}
      className="about-stat-card"
      style={{
        border: "1px solid #E3DCC9",
        borderTop: "2px solid #F59A1A",
        background: "linear-gradient(180deg, #FFFFFF 0%, #FFFCF6 100%)",
        padding: "20px 18px",
        borderRadius: "12px",
        boxShadow: "0 10px 24px rgba(22,43,69,.035)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity .55s ease ${index * 0.08}s, transform .55s cubic-bezier(.2,.7,.2,1) ${index * 0.08}s, box-shadow .22s ease, border-color .22s ease`,
      }}
    >
      <p style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", color: "#162B45", fontWeight: 500 }}>{display}</p>
      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#6B6558", marginTop: "4px" }}>{item.label}</p>
    </div>
  );
}



// ---------- Marketplace icons (SVG inline) ----------

function ShopeeIcon({ size = 20 }) {
  return (
    <img
      src="/marketplace-icons/shopee.webp"
      alt="Shopee"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: "8px"}}
    />
  );
}



function TelegramIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#229ED9"/>
      <path d="M8.5 19.5L30 11L24 30L18.5 24.5L14 28V22L27 14.5L13 21.5L8.5 19.5Z" fill="white"/>
    </svg>
  );
}



function TikTokIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#010101"/>
      <path d="M27 10h-4v13.5a3.5 3.5 0 1 1-3.5-3.5c.19 0 .38.02.56.05V16a8 8 0 1 0 6.94 7.91V15.3A10.3 10.3 0 0 0 33 16.5V13a6.3 6.3 0 0 1-6-3z" fill="white"/>
    </svg>
  );
}

export { OptimizedImage, LabTag, AboutStatCard, ShopeeIcon, TelegramIcon, TikTokIcon };
