import {randomUUID} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {adminDb} from "../../config/firebaseAdmin";

export const PAGE_SIZE = 25;
export const PAGE_TTL_MS = 10 * 60 * 1000;
export const pageKey = (index: number) => String(index).padStart(10, "0");

export const newCursor = async (
  uid: string,
  kind: string,
  data: Record<string, unknown>,
  expiresAt: number,
) => {
  const id = randomUUID();
  await adminDb
    .ref(`communityCursors/${id}`)
    .set({uid, kind, data, expiresAt});
  return id;
};

export const readCursor = async (
  uid: string,
  kind: string,
  cursor: unknown,
) => {
  if (typeof cursor !== "string" || !/^[a-f0-9-]{36}$/.test(cursor)) {
    throw new HttpsError("invalid-argument", "Invalid page cursor.");
  }
  const value = (
    await adminDb.ref(`communityCursors/${cursor}`).get()
  ).val();
  if (!value || value.expiresAt <= Date.now()) {
    throw new HttpsError("failed-precondition", "Page expired; refresh.");
  }
  if (value.uid !== uid || value.kind !== kind) {
    throw new HttpsError(
      "permission-denied",
      "Page belongs to another query.",
    );
  }
  return value;
};
