import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReturnRequestPanel } from "./ReturnRequestPanel.jsx";

const eligibleOrder = {
  id: "MG-20260730-001",
  locale: "id",
  status: "delivered",
  items: [
    {
      id: "p1",
      name: "Gentle Face Wash",
      qty: 2,
      price: 35000,
      image: "/photos/product.webp",
    },
  ],
  returnEligibility: {
    eligible: true,
    deadline: "2026-08-02T10:00:00.000Z",
    windowHours: 72,
  },
  returnRequest: null,
};

describe("ReturnRequestPanel", () => {
  it("opens the claim form for an eligible delivered order", () => {
    render(<ReturnRequestPanel order={eligibleOrder} phone="081234567890" onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Ajukan komplain" }));

    expect(screen.getByText("Formulir komplain")).toBeTruthy();
    expect(screen.getByText("Gentle Face Wash")).toBeTruthy();
    expect(screen.getByText("5. Foto bukti")).toBeTruthy();
  });

  it("shows the customer-response form when admin requests more evidence", () => {
    render(
      <ReturnRequestPanel
        order={{
          ...eligibleOrder,
          returnEligibility: {
            eligible: false,
            reason: "already_submitted",
          },
          returnRequest: {
            id: "RTN-20260730-001",
            status: "waiting_customer",
            issueType: "damaged_or_leaking",
            requestedResolution: "replacement",
            selectedItems: [
              {
                id: "p1",
                name: "Gentle Face Wash",
                qty: 1,
                claimedAmount: 35000,
              },
            ],
            latestAdminMessage: "Tambahkan foto bagian tutup botol.",
            evidence: [],
            statusHistory: [
              {
                status: "waiting_customer",
                at: "2026-07-30T12:00:00.000Z",
                actor: "admin",
                note: "Bukti tambahan diperlukan.",
              },
            ],
          },
        }}
        phone="081234567890"
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getAllByText("Menunggu jawabanmu")).toHaveLength(2);
    expect(screen.getByText("Tambahkan foto bagian tutup botol.")).toBeTruthy();
    expect(screen.getByText("Tambahkan jawaban atau bukti")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim jawaban" })).toBeTruthy();
  });
});
