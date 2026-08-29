import { beforeEach, describe, expect, it, vi } from "vitest";

const authInstance = { currentUser: null };
const initializeAuth = vi.fn(() => authInstance);

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: { type: "LOCAL" },
  initializeAuth,
  onAuthStateChanged: vi.fn(),
  getMultiFactorResolver: vi.fn(),
  multiFactor: vi.fn(() => ({ enrolledFactors: [] })),
  sendEmailVerification: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  TotpMultiFactorGenerator: {
    FACTOR_ID: "totp",
    assertionForEnrollment: vi.fn(),
    assertionForSignIn: vi.fn(),
    generateSecret: vi.fn(),
  },
}));

vi.mock("./firebaseCore.js", () => ({
  firebaseApp: { name: "[DEFAULT]" },
}));

describe("Firebase admin auth initialization", () => {
  beforeEach(() => {
    initializeAuth.mockClear();
    authInstance.currentUser = null;
  });

  it("tidak memasang OAuth popup/redirect resolver untuk login email", async () => {
    vi.resetModules();
    const module = await import("./firebaseAuth.js");

    expect(module.auth).toBe(authInstance);
    expect(initializeAuth).toHaveBeenCalledWith(
      { name: "[DEFAULT]" },
      expect.objectContaining({
        persistence: { type: "LOCAL" },
        popupRedirectResolver: undefined,
      })
    );
  });

  it("membaca admin, verifikasi email, dan second factor dari sesi Firebase", async () => {
    vi.resetModules();
    const { adminSessionFromToken } = await import("./firebaseAuth.js");
    expect(adminSessionFromToken(
      { emailVerified: true },
      { claims: { admin: true, firebase: { sign_in_second_factor: "totp-id" } } }
    )).toEqual({
      isAdmin: true,
      emailVerified: true,
      hasSecondFactor: true,
    });
  });

  it("memberikan pesan MFA spesifik tanpa menyamarkannya sebagai password salah", async () => {
    vi.resetModules();
    const { adminAuthMessage } = await import("./firebaseAuth.js");
    expect(adminAuthMessage({ code: "auth/admin-email-not-verified" }, "enrollment"))
      .toContain("belum terverifikasi");
    expect(adminAuthMessage({ code: "auth/operation-not-allowed" }, "enrollment"))
      .toContain("Identity Platform");
    expect(adminAuthMessage({ code: "auth/invalid-verification-code" }, "totp"))
      .toContain("Kode Authenticator salah");
  });

  it("mengirim verifikasi untuk admin dan memuat ulang status email", async () => {
    const { sendEmailVerification } = await import("firebase/auth");
    authInstance.currentUser = {
      email: "morgengeschaft@gmail.com",
      emailVerified: false,
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { admin: true } }),
      reload: vi.fn().mockImplementation(async () => {
        authInstance.currentUser.emailVerified = true;
      }),
    };
    vi.resetModules();
    const module = await import("./firebaseAuth.js");

    await expect(module.sendAdminEmailVerification()).resolves.toMatchObject({
      alreadyVerified: false,
      email: "morgengeschaft@gmail.com",
    });
    expect(sendEmailVerification).toHaveBeenCalledWith(authInstance.currentUser);
    await expect(module.refreshAdminEmailVerification()).resolves.toMatchObject({
      isAdmin: true,
      emailVerified: true,
    });
  });
});
