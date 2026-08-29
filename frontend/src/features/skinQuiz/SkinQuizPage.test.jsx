import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../../i18n/LocaleContext.jsx";
import SkinQuizPage from "./SkinQuizPage.jsx";
import { SKIN_QUIZ_STORAGE_KEY } from "./skinQuizData.js";

const answers = {
  afterCleansing: "oily",
  duringDay: "oily",
  productComfort: "rarelyReactive",
  mainConcern: "acne",
  routinePriority: "oilControl",
};

const products = [
  {
    id: "p1",
    name: "Oil and Acne Face Wash",
    tag: "SALICYLIC ACID · OILY/ACNE",
    category: "facewash",
    ingredients: ["Salicylic Acid", "Zinc"],
    stock: 8,
    price: 26000,
  },
  {
    id: "p9",
    name: "Acne B5 Serum",
    tag: "PANTHENOL · ACNE",
    category: "serum",
    ingredients: ["Panthenol", "Salicylic Acid"],
    stock: 6,
    price: 30000,
  },
  {
    id: "p8",
    name: "Perfect Shield Sunscreen SPF 40",
    tag: "SPF 40 · ALL TYPES",
    category: "sunscreen",
    ingredients: ["Hyaluronic Acid", "Aloe"],
    stock: 3,
    price: 26000,
  },
];

function renderQuiz(props = {}) {
  const container = document.createElement("div");
  container.id = "root";
  document.body.appendChild(container);

  return render(
    <MemoryRouter initialEntries={["/id/kuis-tipe-kulit"]}>
      <LocaleProvider>
        <SkinQuizPage products={products} {...props} />
      </LocaleProvider>
    </MemoryRouter>,
    { container }
  );
}

describe("SkinQuizPage", () => {
  beforeEach(() => {
    window.localStorage.removeItem(SKIN_QUIZ_STORAGE_KEY);
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("memulai dengan persetujuan penyimpanan yang tidak dicentang", () => {
    renderQuiz();

    expect(screen.getByRole("checkbox").checked).toBe(false);
    expect(screen.getByText("Jawaban tetap milikmu")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /mulai kuis/i }));

    expect(screen.getByText("Pertanyaan 1 dari 5")).toBeTruthy();
    expect(window.localStorage.getItem(SKIN_QUIZ_STORAGE_KEY)).toBeNull();
  });

  it("menampilkan maksimal tiga rekomendasi dan menjaga sesi saat membuka detail", () => {
    const onOpen = vi.fn();
    renderQuiz({
      onOpen,
      session: {
        answers,
        consent: false,
        hasSavedResult: false,
      },
    });

    expect(screen.getByText("Cenderung berminyak")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("Hasil ini bukan diagnosis.")).toBeTruthy();
    expect(screen.queryByText("Jawaban dan hasil tersimpan di perangkat ini.")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Lihat detail" })[0]);

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      expect.objectContaining({
        answers,
        consent: false,
        hasSavedResult: false,
      })
    );
  });
});
