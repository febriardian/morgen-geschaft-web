import { ChevronRight, Sparkles } from "lucide-react";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import "./SkinQuizPage.css";

export function SkinQuizBanner({ onStart }) {
  const { t } = useLocale();

  return (
    <section className="skin-quiz-home-banner" aria-labelledby="skin-quiz-home-title">
      <div className="skin-quiz-home-banner-inner">
        <div className="skin-quiz-home-banner-copy">
          <div className="skin-quiz-home-banner-icon" aria-hidden="true">
            <Sparkles size={23} />
          </div>
          <div>
            <span>{t("PILIH DENGAN LEBIH MUDAH", "CHOOSE WITH MORE CONFIDENCE")}</span>
            <h2 id="skin-quiz-home-title">
              {t("Kenali kecenderungan tipe kulitmu", "Explore your likely skin type")}
            </h2>
            <p>
              {t(
                "Jawab 5 pertanyaan singkat untuk mendapatkan hingga 3 rekomendasi dari produk yang sedang tersedia.",
                "Answer 5 short questions to get up to 3 recommendations from products currently available."
              )}
            </p>
          </div>
        </div>
        <button type="button" onClick={onStart}>
          {t("Mulai kuis", "Start quiz")}
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
