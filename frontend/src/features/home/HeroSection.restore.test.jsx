import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../../i18n/LocaleContext.jsx";
import { HeroSection } from "./HomeSections.jsx";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HeroSection restored crossfade", () => {
  it("keeps all responsive slides mounted and crossfades on the original timing", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/id"]}>
        <LocaleProvider>
          <HeroSection onCatalogClick={vi.fn()} />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const images = [...container.querySelectorAll(".hero-img")];
    const copyLayers = [...container.querySelectorAll(".hero-copy-stage > div")];
    const dots = [...container.querySelectorAll(".premium-hero-dot")];

    expect(images).toHaveLength(3);
    expect(copyLayers).toHaveLength(3);
    expect(dots).toHaveLength(3);
    expect(images[0].style.opacity).toBe("1");
    expect(images[1].style.opacity).toBe("0");
    expect(images[0].style.transition).toContain("1.1s");
    expect(copyLayers[0].style.transition).toContain("0.9s");
    expect(images[0].currentSrc || images[0].getAttribute("src")).toContain(
      "/hero/product-6-960.webp",
    );

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(images[0].style.opacity).toBe("0");
    expect(images[1].style.opacity).toBe("1");
    expect(copyLayers[0].style.opacity).toBe("0");
    expect(copyLayers[1].style.opacity).toBe("1");

    fireEvent.click(dots[2]);
    expect(images[1].style.opacity).toBe("0");
    expect(images[2].style.opacity).toBe("1");
  });
});
