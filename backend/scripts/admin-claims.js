import dotenv from "dotenv";
import { getAdminAuth, getAdminDb } from "../src/config/firebaseAdmin.js";

dotenv.config();

const [action, rawEmail] = process.argv.slice(2);
const email = String(rawEmail || "").trim().toLowerCase();

if (!['grant', 'revoke'].includes(action) || !email) {
  console.error('Pemakaian: node scripts/admin-claims.js <grant|revoke> email@domain.com');
  process.exit(1);
}

try {
  const auth = getAdminAuth();
  const user = await auth.getUserByEmail(email);
  const existing = user.customClaims || {};
  const nextClaims = { ...existing };

  if (action === 'grant') nextClaims.admin = true;
  else delete nextClaims.admin;

  await auth.setCustomUserClaims(user.uid, nextClaims);
  if (action === 'revoke') await auth.revokeRefreshTokens(user.uid);

  const db = getAdminDb();
  await db.collection('admins').doc(user.uid).set({
    email,
    active: action === 'grant',
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  console.log(action === 'grant'
    ? `Akses admin diberikan kepada ${email}. Pengguna harus logout lalu login kembali.`
    : `Akses admin dicabut dari ${email}. Token aktif sudah dicabut; pengguna harus login kembali untuk akses baru.`
  );
} catch (error) {
  console.error(`Gagal ${action} admin: ${error.message}`);
  process.exit(1);
}
