import {onCall, HttpsError} from "firebase-functions/v2/https";
import {adminAuth, adminDb} from "../../config/firebaseAdmin";


/**
 * Initialize a database record without overwriting existing data.
 * @param {string} path Database path to initialize.
 * @param {object} initialData Defaults used only when the record is absent.
 * @return {Promise<void>} Resolves when the record exists.
 */
async function createIfMissing(
  path: string,
  initialData: object
): Promise<void> {
  const ref = adminDb.ref(path);

  const result = await ref.transaction(
    (currentData) => {
      // Du lieu da ton tai: khong ghi de
      if (currentData !== null) {
        return;
      }

      // Du lieu chua ton tai: khoi tao
      return initialData;
    },
    undefined,
    false
  );

  // Transaction tao moi thanh cong
  if (result.committed) {
    return;
  }

  // Transaction bi huy vi ban ghi da ton tai
  if (result.snapshot.exists()) {
    return;
  }

  // Khong tao duoc va cung khong co du lieu
  throw new Error(
    `Failed to initialize database path: ${path}`
  );
}


export const ensureUserProfile = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
  async (request) => {
    // 1. Kiem tra nguoi dung da dang nhap
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "You must sign in first."
      );
    }

    try {
      // 2. Lay du lieu tai khoan tu Firebase Auth
      const authUser = await adminAuth.getUser(uid);

      if (authUser.disabled) {
        throw new HttpsError(
          "permission-denied",
          "This account has been disabled."
        );
      }

      // 3. Kiem tra trang thai truy cap hien tai
      const accessRef = adminDb.ref(`accountAccess/${uid}`);
      const accessSnapshot = await accessRef.get();
      const access = accessSnapshot.val();

      if (access && access.status !== "active") {
        throw new HttpsError(
          "permission-denied",
          "This account is not active."
        );
      }

      const now = Date.now();

      // 4. Khoi tao trang thai truy cap
      await createIfMissing(`accountAccess/${uid}`, {
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // Kiem tra lai, khong mo khoa tai khoan bi ban
      const currentAccess = (await accessRef.get()).val();

      if (currentAccess?.status !== "active") {
        throw new HttpsError(
          "permission-denied",
          "This account is not active."
        );
      }

      // 5. Khoi tao ho so hien thi
      await createIfMissing(`users/${uid}`, {
        displayCode: `EB-${uid}`,
        displayName: authUser.displayName || "New Player",
        avatarPath: "",
        createdAt: now,
        updatedAt: now,
      });

      // 6. Luu thong tin rieng tu
      await createIfMissing(`userPrivate/${uid}`, {
        email: authUser.email || "",
        createdAt: now,
        updatedAt: now,
      });

      // 7. Thong ke thi dau ban dau
      await createIfMissing(`userStats/${uid}`, {
        rating: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        updatedAt: now,
      });

      // 8. Vi xu ban dau
      await createIfMissing(`wallets/${uid}`, {
        coinBalance: 0,
        updatedAt: now,
      });

      // 9. Cai dat mac dinh
      await createIfMissing(`userSettings/${uid}`, {
        notificationsEnabled: true,
        soundVolume: 1,
        language: "vi",
        theme: "system",
        updatedAt: now,
      });

      // 10. Kiem tra lan cuoi trang thai tai khoan
      const finalAccess = (await accessRef.get()).val();

      if (finalAccess?.status !== "active") {
        throw new HttpsError(
          "permission-denied",
          "This account is not active."
        );
      }

      // Auth remains authoritative after name changes and email verification.
      // Re-read after provisioning, since registration may still update Auth.
      const currentAuthUser = await adminAuth.getUser(uid);
      if (currentAuthUser.disabled) {
        throw new HttpsError("permission-denied", "Account is disabled.");
      }
      const [profileSnap, privateSnap] = await Promise.all([
        adminDb.ref(`users/${uid}`).get(),
        adminDb.ref(`userPrivate/${uid}`).get(),
      ]);
      const displayName = currentAuthUser.displayName || "New Player";
      const email = currentAuthUser.email || "";
      const updates: Record<string, unknown> = {};
      const syncedAt = Date.now();
      if (profileSnap.val()?.displayName !== displayName) {
        updates[`users/${uid}/displayName`] = displayName;
        updates[`users/${uid}/updatedAt`] = syncedAt;
      }
      if (privateSnap.val()?.email !== email) {
        updates[`userPrivate/${uid}/email`] = email;
        updates[`userPrivate/${uid}/updatedAt`] = syncedAt;
      }
      // Only these fields are patched, together. Existing balances, access,
      // progress, roles and other profile fields are never replaced by a sync.
      if (Object.keys(updates).length) await adminDb.ref().update(updates);

      return {
        serverNow: Date.now(),
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("ensureUserProfile failed", {
        uid,
        error,
      });

      throw new HttpsError(
        "internal",
        "Unable to initialize user profile."
      );
    }
  }
);
