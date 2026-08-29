import dotenv from "dotenv";
import { getAdminAuth, getAdminDb } from "../src/config/firebaseAdmin.js";

dotenv.config();

const [command, rawValue, confirmationFlag, confirmationValue] = process.argv.slice(2);
const value = String(rawValue || "").trim();

function usage() {
  console.log(`
Morgen Geschäft — alat administrasi TOTP MFA

  npm run admin:mfa -- project-status
  npm run admin:mfa -- enable-project [adjacentIntervals]
  npm run admin:mfa -- user-status email@domain.com
  npm run admin:mfa -- doctor email@domain.com
  npm run admin:mfa -- enforcement-status
  npm run admin:mfa -- enforcement-on --confirm ENABLE-MFA
  npm run admin:mfa -- enforcement-off --confirm DISABLE-MFA
  npm run admin:mfa -- reset-user email@domain.com --confirm RESET-MFA

Jalankan doctor sebelum menyalakan REQUIRE_ADMIN_MFA=true.
`);
}

function assertEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email admin tidak valid.");
  }
  return email.toLowerCase();
}

function assertConfirmation(expected) {
  if (confirmationFlag !== "--confirm" || confirmationValue !== expected) {
    throw new Error(`Operasi dibatalkan. Tambahkan --confirm ${expected} jika target sudah diperiksa.`);
  }
}

async function projectMfaStatus() {
  const config = await getAdminAuth().projectConfigManager().getProjectConfig();
  const providers = config.multiFactorConfig?.providerConfigs || [];
  const totp = providers.find((provider) => provider.totpProviderConfig);
  return {
    enabled: config.multiFactorConfig?.state === "ENABLED" && totp?.state === "ENABLED",
    adjacentIntervals: totp?.totpProviderConfig?.adjacentIntervals ?? null,
  };
}

async function userMfaStatus(email) {
  const user = await getAdminAuth().getUserByEmail(assertEmail(email));
  const factors = user.multiFactor?.enrolledFactors || [];
  return {
    uid: user.uid,
    email: user.email || email,
    emailVerified: user.emailVerified === true,
    adminClaim: user.customClaims?.admin === true,
    disabled: user.disabled === true,
    factors: factors.map((factor) => ({
      factorId: factor.factorId,
      displayName: factor.displayName || "Tanpa nama",
      enrollmentTime: factor.enrollmentTime || null,
    })),
    hasTotp: factors.some((factor) => factor.factorId === "totp"),
  };
}

async function enforcementStatus() {
  const snapshot = await getAdminDb().collection("adminConfig").doc("security").get();
  return snapshot.exists && snapshot.data()?.requireMfa === true;
}

async function main() {
  if (!command) {
    usage();
    return;
  }

  if (command === "project-status") {
    console.log(JSON.stringify(await projectMfaStatus(), null, 2));
    return;
  }

  if (command === "enable-project") {
    const adjacentIntervals = value === "" ? 1 : Number(value);
    if (!Number.isInteger(adjacentIntervals) || adjacentIntervals < 0 || adjacentIntervals > 10) {
      throw new Error("adjacentIntervals harus bilangan bulat 0 sampai 10.");
    }
    await getAdminAuth().projectConfigManager().updateProjectConfig({
      multiFactorConfig: {
        state: "ENABLED",
        providerConfigs: [{
          state: "ENABLED",
          totpProviderConfig: { adjacentIntervals },
        }],
      },
    });
    console.log(`Provider TOTP aktif dengan adjacentIntervals=${adjacentIntervals}.`);
    return;
  }

  if (command === "user-status") {
    console.log(JSON.stringify(await userMfaStatus(value), null, 2));
    return;
  }

  if (command === "doctor") {
    const [project, user, enforced] = await Promise.all([
      projectMfaStatus(),
      userMfaStatus(value),
      enforcementStatus(),
    ]);
    const checks = {
      projectTotpEnabled: project.enabled,
      adminEmailVerified: user.emailVerified,
      adminClaimPresent: user.adminClaim,
      adminNotDisabled: !user.disabled,
      userTotpEnrolled: user.hasTotp,
      firestoreMfaEnforced: enforced,
    };
    console.log(JSON.stringify({ ready: Object.values(checks).slice(0, 5).every(Boolean), checks }, null, 2));
    return;
  }

  if (command === "enforcement-status") {
    console.log(JSON.stringify({ requireMfa: await enforcementStatus() }, null, 2));
    return;
  }

  if (command === "enforcement-on" || command === "enforcement-off") {
    const enable = command === "enforcement-on";
    assertConfirmation(enable ? "ENABLE-MFA" : "DISABLE-MFA");
    await getAdminDb().collection("adminConfig").doc("security").set({
      requireMfa: enable,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin-mfa-cli",
    }, { merge: true });
    console.log(`Pemaksaan MFA pada Firestore ${enable ? "diaktifkan" : "dinonaktifkan"}.`);
    return;
  }

  if (command === "reset-user") {
    assertConfirmation("RESET-MFA");
    const email = assertEmail(value);
    const auth = getAdminAuth();
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { multiFactor: { enrolledFactors: null } });
    await auth.revokeRefreshTokens(user.uid);
    console.log(`Semua faktor MFA ${email} dihapus dan sesi lama dicabut. Daftarkan TOTP baru saat login berikutnya.`);
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Gagal: ${error.message}`);
  process.exitCode = 1;
});
