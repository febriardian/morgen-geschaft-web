import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Stub firebaseAuth.js agar impor adminShared tidak menginisialisasi Firebase Auth.
vi.mock("../../services/firebaseAuth.js", () => ({ auth: {} }));

import { AdminPagination } from "./adminShared.jsx";

describe("AdminPagination", () => {
  it("hanya menampilkan ringkasan saat cuma 1 halaman", () => {
    render(
      <AdminPagination page={1} totalPages={1} totalItems={5} label="pesanan" onChange={() => {}} />
    );
    expect(screen.getByText("5 pesanan")).toBeTruthy();
    // Tidak ada tombol navigasi saat 1 halaman.
    expect(screen.queryByRole("button", { name: "→" })).toBeNull();
  });

  it("memanggil onChange dengan nomor halaman saat tombol angka diklik", () => {
    const onChange = vi.fn();
    render(
      <AdminPagination page={1} totalPages={5} totalItems={50} label="pesanan" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("menonaktifkan tombol prev di halaman pertama dan next di halaman terakhir", () => {
    const { rerender } = render(
      <AdminPagination page={1} totalPages={5} totalItems={50} onChange={() => {}} />
    );
    expect(screen.getByRole("button", { name: "←" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "→" }).disabled).toBe(false);

    rerender(<AdminPagination page={5} totalPages={5} totalItems={50} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "→" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "←" }).disabled).toBe(false);
  });
});
