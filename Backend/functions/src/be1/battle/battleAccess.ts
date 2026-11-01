import {HttpsError} from "firebase-functions/v2/https";
import {adminAuth, adminDb} from "../../config/firebaseAdmin";

export const battleId = (id: string) => /^battle_[A-Za-z0-9_-]+$/.test(id);
export const operationId = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);

/**
 * Validate an installation session without trusting UID from request data.
 * @param {unknown} value Optional installation identifier.
 * @return {string} Validated session, with legacy compatibility.
 */
export function battleSession(value: unknown): string {
  if (value === undefined) return "legacy";
  if (!operationId(value)) {
    throw new HttpsError("invalid-argument", "Invalid clientSessionId.");
  }
  return value;
}

/**
 * Verify live Auth and database access on every callable.
 * @param {string|undefined} uid Authenticated UID.
 * @return {Promise<string>} Public name, never the email address.
 */
export async function activeBattleUser(
  uid: string | undefined,
): Promise<string> {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  let user;
  try {
    user = await adminAuth.getUser(uid);
  } catch (error) {
    if ((error as {code?: string}).code !== "auth/user-not-found") {
      throw error;
    }
    throw new HttpsError("permission-denied", "Account unavailable.");
  }
  const [access, profile] = await Promise.all([
    adminDb.ref(`accountAccess/${uid}`).get(),
    adminDb.ref(`users/${uid}`).get(),
  ]);
  if (user.disabled || access.val()?.status !== "active") {
    throw new HttpsError("permission-denied", "Account is not active.");
  }
  return String(
    profile.val()?.displayName || user.displayName || "Người học",
  ).slice(0, 100);
}
