import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { OptimizedImage } from "../../components/shared/Media.jsx";
import { StandalonePageHero } from "../../components/shared/Transitions.jsx";
import { usePageMeta } from "../../hooks/usePageMeta.js";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import { formatIDR, resolveProductImage } from "../../utils/general.js";
import {
  buildQuizResult,
  clearSavedQuizResult,
  isQuizComplete,
  readSavedQuizResult,
  sanitizeQuizAnswers,
  saveQuizResult,
} from "./skinQuizEngine.js";
import { SKIN_QUIZ_QUESTIONS, quizText } from "./skinQuizData.js";
import "./SkinQuizPage.css";

const CATEGORY_LABELS = {
  facewash: { id: "Pembersih", en: "Cleanser" },
  serum: { id: "Perawatan", en: "Treatment" },
  sunscreen: { id: "Perlindungan", en: "Protection" },
};

function initialQuizState(session) {
  const sessionAnswers = sanitizeQuizAnswers(session?.answers);
  if (isQuizComplete(sessionAnswers)) {
    return {
      answers: sessionAnswers,
      consent: Boolean(session?.consent),
      hasSavedResult: Boolean(session?.hasSavedResult),
    };
  }

  const saved = readSavedQuizResult();
  if (saved) {
    return {
      answers: saved.answers,
      consent: true,
      hasSavedResult: true,
    };
  }

  return {
    answers: {},
    consent: false,
    hasSavedResult: false,
  };
}

export default function SkinQuizPage({
  products = [],
  productsLoading = false,
  onAdd,
  onOpen,
  onBrowseCatalog,
  session,
}) {
  const { locale, t } = useLocale();
  const [initial] = useState(() => initialQuizState(session));
  const [stage, setStage] = useState(() => (isQuizComplete(initial.answers) ? "result" : "intro"));
  const [answers, setAnswers] = useState(initial.answers);
  const [consent, setConsent] = useState(initial.consent);
  const [hasSavedResult, setHasSavedResult] = useState(initial.hasSavedResult);
  const [step, setStep] = useState(0);
  const [addedProductId, setAddedProductId] = useState("");

  const question = SKIN_QUIZ_QUESTIONS[step];
  const selectedAnswer = question ? answers[question.id] : "";
  const result = useMemo(
    () => buildQuizResult(answers, products, locale),
    [answers, locale, products]
  );

  usePageMeta(
    t("Kuis Tipe Kulit", "Skin Type Quiz"),
    t(
      "Jawab lima pertanyaan nonmedis dan temukan hingga tiga produk Morgen Geschäft yang sedang tersedia.",
      "Answer five non-medical questions and discover up to three currently available Morgen Geschäft products."
    )
  );

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (!addedProductId) return undefined;
    const timer = window.setTimeout(() => setAddedProductId(""), 1400);
    return () => window.clearTimeout(timer);
  }, [addedProductId]);

  const scrollContentTop = () => {
    window.requestAnimationFrame(() => {
      document.querySelector(".skin-quiz-shell")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const startQuiz = () => {
    setAnswers({});
    setStep(0);
    setStage("question");
    scrollContentTop();
  };

  const chooseAnswer = (optionId) => {
    setAnswers((current) => ({ ...current, [question.id]: optionId }));
  };

  const goNext = () => {
    if (!selectedAnswer) return;

    if (step < SKIN_QUIZ_QUESTIONS.length - 1) {
      setStep((current) => current + 1);
      scrollContentTop();
      return;
    }

    const saved = saveQuizResult(answers, consent);
    setHasSavedResult(saved);
    setStage("result");
    scrollContentTop();
  };

  const goBack = () => {
    if (step > 0) {
      setStep((current) => current - 1);
      scrollContentTop();
      return;
    }
    setStage("intro");
    scrollContentTop();
  };

  const restartQuiz = () => {
    clearSavedQuizResult();
    setAnswers({});
    setConsent(false);
    setHasSavedResult(false);
    setStep(0);
    setStage("intro");
    scrollContentTop();
  };

  const removeSavedResult = () => {
    clearSavedQuizResult();
    setConsent(false);
    setHasSavedResult(false);
  };

  const openRecommendation = (product) => {
    onOpen?.(product, {
      answers,
      consent,
      hasSavedResult,
    });
  };

  const addRecommendation = (product) => {
    onAdd?.(product);
    setAddedProductId(product.id);
  };

  return (
    <main className="skin-quiz-page">
      <StandalonePageHero
        eyebrow={t("PANDUAN PRODUK", "PRODUCT GUIDE")}
        title={t("Kuis tipe kulit", "Skin type quiz")}
        description={t(
          "Lima pertanyaan singkat untuk membantu menyaring produk yang sedang tersedia sesuai kebutuhan dasar kulitmu.",
          "Five short questions to help filter currently available products around your skin's basic needs."
        )}
      />

      <div className="skin-quiz-shell">
        {stage === "intro" && (
          <div className="skin-quiz-intro-grid">
            <section
              className="skin-quiz-panel skin-quiz-intro-copy"
              aria-labelledby="skin-quiz-intro-title"
            >
              <span>
                <Sparkles size={14} aria-hidden="true" />{" "}
                {t("5 PERTANYAAN · SEKITAR 2 MENIT", "5 QUESTIONS · ABOUT 2 MINUTES")}
              </span>
              <h2 id="skin-quiz-intro-title">
                {t(
                  "Mulai dari kebutuhan kulit, lalu pilih produk.",
                  "Start with your skin's needs, then choose a product."
                )}
              </h2>
              <p>
                {t(
                  "Kuis ini menilai kecenderungan umum dari jawabanmu, lalu mencocokkannya dengan informasi produk dan stok katalog saat ini.",
                  "This quiz reviews general tendencies in your answers, then matches them with current catalog information and stock."
                )}
              </p>

              <div className="skin-quiz-feature-list">
                <div className="skin-quiz-feature">
                  <Clock3 size={19} aria-hidden="true" />
                  <strong>{t("Singkat", "Short")}</strong>
                  <small>
                    {t(
                      "Hanya satu pilihan pada setiap pertanyaan.",
                      "Only one choice for each question."
                    )}
                  </small>
                </div>
                <div className="skin-quiz-feature">
                  <ShieldCheck size={19} aria-hidden="true" />
                  <strong>{t("Nonmedis", "Non-medical")}</strong>
                  <small>
                    {t(
                      "Tidak meminta foto atau mendiagnosis kondisi kulit.",
                      "No photos and no diagnosis of skin conditions."
                    )}
                  </small>
                </div>
                <div className="skin-quiz-feature">
                  <ShoppingBag size={19} aria-hidden="true" />
                  <strong>{t("Stok aktif", "Live stock")}</strong>
                  <small>
                    {t(
                      "Hanya menampilkan produk yang sedang tersedia.",
                      "Only currently available products are shown."
                    )}
                  </small>
                </div>
              </div>
            </section>

            <aside
              className="skin-quiz-panel skin-quiz-start-panel"
              aria-label={t("Pengaturan privasi kuis", "Quiz privacy settings")}
            >
              <LockKeyhole size={23} aria-hidden="true" />
              <h3>{t("Jawaban tetap milikmu", "Your answers stay yours")}</h3>
              <p>
                {t(
                  "Jawaban diproses langsung di browser dan tidak dikirim ke server. Penyimpanan di perangkat bersifat opsional.",
                  "Answers are processed in your browser and are not sent to the server. Saving them on this device is optional."
                )}
              </p>

              <label className="skin-quiz-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => {
                    const nextConsent = event.target.checked;
                    setConsent(nextConsent);
                    if (!nextConsent) {
                      clearSavedQuizResult();
                      setHasSavedResult(false);
                    }
                  }}
                />
                <span>
                  <strong>
                    {t(
                      "Simpan jawaban dan hasil di perangkat ini setelah kuis selesai.",
                      "Save my answers and result on this device after the quiz."
                    )}
                  </strong>
                  <small>
                    {t(
                      "Tidak dicentang secara otomatis. Kamu dapat menghapusnya kapan saja.",
                      "It is not selected automatically. You can delete it at any time."
                    )}
                  </small>
                </span>
              </label>

              <button
                type="button"
                className="skin-quiz-primary premium-primary-btn"
                onClick={startQuiz}
              >
                {t("Mulai kuis", "Start quiz")}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </aside>
          </div>
        )}

        {stage === "question" && question && (
          <section
            className="skin-quiz-panel skin-quiz-question-card"
            aria-labelledby={`skin-quiz-question-${question.id}`}
          >
            <div className="skin-quiz-progress-head">
              <strong>{t("PROGRES KUIS", "QUIZ PROGRESS")}</strong>
              <span>
                {t(
                  `Pertanyaan ${step + 1} dari ${SKIN_QUIZ_QUESTIONS.length}`,
                  `Question ${step + 1} of ${SKIN_QUIZ_QUESTIONS.length}`
                )}
              </span>
            </div>
            <div
              className="skin-quiz-progress-track"
              role="progressbar"
              aria-label={t("Progres kuis", "Quiz progress")}
              aria-valuemin="1"
              aria-valuemax={SKIN_QUIZ_QUESTIONS.length}
              aria-valuenow={step + 1}
            >
              <span style={{ width: `${((step + 1) / SKIN_QUIZ_QUESTIONS.length) * 100}%` }} />
            </div>

            <fieldset>
              <span className="skin-quiz-question-eyebrow">
                {t("PILIH SATU JAWABAN", "CHOOSE ONE ANSWER")}
              </span>
              <legend id={`skin-quiz-question-${question.id}`}>
                {quizText(question.title, locale)}
              </legend>
              <p className="skin-quiz-question-helper">{quizText(question.helper, locale)}</p>

              <div className="skin-quiz-options" role="radiogroup">
                {question.options.map((option) => {
                  const selected = selectedAnswer === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`skin-quiz-option${selected ? " is-selected" : ""}`}
                      onClick={() => chooseAnswer(option.id)}
                    >
                      <span className="skin-quiz-option-marker" aria-hidden="true">
                        <Check size={12} />
                      </span>
                      <span>{quizText(option.label, locale)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="skin-quiz-question-actions">
              <button type="button" className="skin-quiz-secondary" onClick={goBack}>
                <ChevronLeft size={15} aria-hidden="true" />
                {t("Kembali", "Back")}
              </button>
              <button
                type="button"
                className="skin-quiz-primary premium-primary-btn"
                disabled={!selectedAnswer}
                onClick={goNext}
              >
                {step === SKIN_QUIZ_QUESTIONS.length - 1
                  ? t("Lihat hasil", "See result")
                  : t("Lanjut", "Continue")}
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {stage === "result" && (
          <section
            className="skin-quiz-panel skin-quiz-result-card"
            aria-labelledby="skin-quiz-result-title"
          >
            <div className="skin-quiz-result-summary">
              <div>
                <span className="skin-quiz-result-eyebrow">
                  <Sparkles size={14} aria-hidden="true" />
                  {t("HASIL PANDUAN AWAL", "INITIAL GUIDANCE RESULT")}
                </span>
                <h2 id="skin-quiz-result-title">{quizText(result.profileContent.label, locale)}</h2>
                <p>{quizText(result.profileContent.summary, locale)}</p>
                <div className="skin-quiz-result-tags">
                  <span>{quizText(result.concernContent.label, locale)}</span>
                  {result.profile.sensitive && (
                    <span>{t("Lebih mudah terasa tidak nyaman", "More prone to discomfort")}</span>
                  )}
                  <span>{t("Berdasarkan 5 jawaban", "Based on 5 answers")}</span>
                </div>
              </div>

              <aside className="skin-quiz-result-note">
                <Info size={21} aria-hidden="true" />
                <strong>
                  {t("Hasil ini bukan diagnosis.", "This result is not a diagnosis.")}
                </strong>
                <small>
                  {t(
                    "Selalu baca label dan petunjuk produk. Jika keluhan terasa berat, menetap, atau mengkhawatirkan, konsultasikan dengan dokter kulit.",
                    "Always read product labels and directions. If a concern is severe, persistent, or worrying, consult a dermatologist."
                  )}
                </small>
              </aside>
            </div>

            <div className="skin-quiz-recommendations">
              <div className="skin-quiz-recommendations-head">
                <div>
                  <span className="skin-quiz-result-eyebrow">
                    {t("PRODUK TERSEDIA", "AVAILABLE PRODUCTS")}
                  </span>
                  <h3>{t("Pilihan yang paling relevan", "Most relevant options")}</h3>
                </div>
                <p>
                  {t(
                    "Maksimal satu produk per langkah agar rutinitas tetap sederhana. Harga dan stok mengikuti katalog saat ini.",
                    "At most one product per step to keep the routine simple. Prices and stock follow the current catalog."
                  )}
                </p>
              </div>

              {productsLoading ? (
                <div className="skin-quiz-empty" role="status">
                  <strong>
                    {t("Memeriksa produk yang tersedia...", "Checking available products...")}
                  </strong>
                </div>
              ) : result.recommendations.length > 0 ? (
                <div className="skin-quiz-product-grid">
                  {result.recommendations.map(({ product, reason }) => {
                    const added = addedProductId === product.id;
                    return (
                      <article className="skin-quiz-product-card" key={product.id}>
                        <div className="skin-quiz-product-image">
                          <OptimizedImage
                            src={resolveProductImage(product)}
                            alt={product.name}
                            sizes="(max-width: 680px) 112px, (max-width: 900px) 50vw, 33vw"
                          />
                          <span className="skin-quiz-product-step">
                            {quizText(CATEGORY_LABELS[product.category], locale)}
                          </span>
                        </div>
                        <div className="skin-quiz-product-copy">
                          <h4>{product.name}</h4>
                          <p className="skin-quiz-product-reason">{reason}</p>
                          <div className="skin-quiz-product-meta">
                            <strong>{formatIDR(product.price)}</strong>
                            <small>{t(`Stok ${product.stock}`, `${product.stock} in stock`)}</small>
                          </div>
                          <div className="skin-quiz-product-actions">
                            <button
                              type="button"
                              className="skin-quiz-product-detail"
                              onClick={() => openRecommendation(product)}
                            >
                              {t("Lihat detail", "View details")}
                            </button>
                            <button
                              type="button"
                              className={`skin-quiz-product-add${added ? " is-added" : ""}`}
                              onClick={() => addRecommendation(product)}
                            >
                              {added ? (
                                <Check size={13} aria-hidden="true" />
                              ) : (
                                <ShoppingBag size={13} aria-hidden="true" />
                              )}
                              {added ? t("Ditambahkan", "Added") : t("Tambah", "Add")}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="skin-quiz-empty">
                  <strong>
                    {t(
                      "Belum ada produk yang cukup sesuai dan tersedia.",
                      "No sufficiently relevant product is currently available."
                    )}
                  </strong>
                  <p>
                    {t(
                      "Katalog mungkin sedang kosong atau produk yang sesuai sedang habis. Kamu tetap dapat melihat pilihan lain tanpa memaksakan rekomendasi.",
                      "The catalog may be empty or matching products may be out of stock. You can still browse other options without forcing a recommendation."
                    )}
                  </p>
                  <button type="button" className="skin-quiz-primary" onClick={onBrowseCatalog}>
                    {t("Lihat katalog", "Browse catalog")}
                  </button>
                </div>
              )}
            </div>

            <div className="skin-quiz-bottom-actions">
              {hasSavedResult && (
                <p className="skin-quiz-saved-status">
                  {t(
                    "Jawaban dan hasil tersimpan di perangkat ini.",
                    "Your answers and result are saved on this device."
                  )}
                </p>
              )}
              {hasSavedResult && (
                <button type="button" className="skin-quiz-secondary" onClick={removeSavedResult}>
                  <Trash2 size={14} aria-hidden="true" />
                  {t("Hapus hasil tersimpan", "Delete saved result")}
                </button>
              )}
              <button type="button" className="skin-quiz-secondary" onClick={restartQuiz}>
                <RotateCcw size={14} aria-hidden="true" />
                {t("Ulangi kuis", "Retake quiz")}
              </button>
              <button type="button" className="skin-quiz-primary" onClick={onBrowseCatalog}>
                {t("Lihat semua produk", "View all products")}
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
