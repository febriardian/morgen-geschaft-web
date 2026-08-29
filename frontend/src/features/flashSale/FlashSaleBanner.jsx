import { ArrowRight, Clock3, Zap } from "lucide-react";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { countdownParts } from "./flashSaleUtils.js";
import "./FlashSale.css";

function TimeBox({ value, label }) {
  return (
    <span className="flash-sale-time-box">
      <b>{String(value).padStart(2, "0")}</b>
      <small>{label}</small>
    </span>
  );
}

export function FlashSaleBanner({ sale, remainingMs = 0, products = [], onBrowse }) {
  const { locale, t } = useLocale();
  if (!sale || remainingMs <= 0) return null;

  const time = countdownParts(remainingMs);
  const productNames = products
    .filter((product) => sale.productIds?.includes(product.id))
    .slice(0, 4)
    .map((product) => product.name);
  const title = locale === "en" ? sale.titleEn || sale.titleId : sale.titleId;

  return (
    <section className="flash-sale-home" aria-labelledby="flash-sale-home-title">
      <div className="flash-sale-home-inner">
        <div className="flash-sale-home-copy">
          <span className="flash-sale-home-icon" aria-hidden="true">
            <Zap size={23} />
          </span>
          <div>
            <span className="flash-sale-eyebrow">
              <Clock3 size={12} aria-hidden="true" />
              {t("FLASH SALE SEDANG BERLANGSUNG", "FLASH SALE IS LIVE")}
            </span>
            <h2 id="flash-sale-home-title">
              {title || t("Harga spesial terbatas", "Limited special prices")}
            </h2>
            <p>
              {t(
                `Diskon ${sale.discountPercent}% untuk ${sale.productIds?.length || 0} produk pilihan.`,
                `${sale.discountPercent}% off ${sale.productIds?.length || 0} selected products.`
              )}
              {productNames.length > 0 ? ` ${productNames.join(" · ")}` : ""}
            </p>
          </div>
        </div>

        <div className="flash-sale-home-actions">
          <div
            className="flash-sale-countdown"
            aria-label={t("Sisa waktu flash sale", "Flash sale time remaining")}
            aria-live="off"
          >
            {time.days > 0 && <TimeBox value={time.days} label={t("Hari", "Days")} />}
            <TimeBox value={time.hours} label={t("Jam", "Hours")} />
            <TimeBox value={time.minutes} label={t("Menit", "Min")} />
            <TimeBox value={time.seconds} label={t("Detik", "Sec")} />
          </div>
          <button type="button" onClick={onBrowse}>
            {t("Lihat produk", "View products")} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
