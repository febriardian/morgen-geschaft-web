import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../../i18n/LocaleContext.jsx";
import { FlashSaleBanner } from "./FlashSaleBanner.jsx";

const sale = {
  id: "sale-1",
  titleId: "Flash Sale Pagi",
  titleEn: "Morning Flash Sale",
  discountPercent: 20,
  productIds: ["p1", "p2"],
  startAt: "2026-07-30T02:00:00.000Z",
  endAt: "2026-07-30T04:00:00.000Z",
  status: "scheduled",
};

function renderBanner(props = {}) {
  return render(
    <MemoryRouter initialEntries={["/id"]}>
      <LocaleProvider>
        <FlashSaleBanner
          sale={sale}
          remainingMs={3_661_000}
          products={[
            { id: "p1", name: "Face Wash" },
            { id: "p2", name: "Serum" },
          ]}
          {...props}
        />
      </LocaleProvider>
    </MemoryRouter>
  );
}

afterEach(() => cleanup());

describe("FlashSaleBanner", () => {
  it("menampilkan jadwal aktif, countdown, dan produk pilihan", () => {
    const onBrowse = vi.fn();
    renderBanner({ onBrowse });

    expect(screen.getByRole("heading", { name: "Flash Sale Pagi" })).toBeTruthy();
    expect(screen.getByText(/Diskon 20% untuk 2 produk pilihan/)).toBeTruthy();
    expect(screen.getByText(/Face Wash · Serum/)).toBeTruthy();
    expect(screen.getByLabelText("Sisa waktu flash sale")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /lihat produk/i }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("tidak tampil setelah countdown selesai", () => {
    const { container } = renderBanner({ remainingMs: 0 });
    expect(container.innerHTML).toBe("");
  });
});
