import {HttpsError, onCall} from "firebase-functions/v2/https";
import {adminDb} from "../../config/firebaseAdmin";
import {activeBattleUser} from "../battle/battleAccess";
import {transactionWithRetry} from "../databaseTransaction";
import {contentId} from "../practice/contentValidation";

export const markNotificationsRead = onCall(
  {region: "asia-southeast1", maxInstances: 10},
  async (request) => {
    const uid = request.auth?.uid;
    await activeBattleUser(uid);
    const data = request.data || {};
    const ids = data.ids;
    if (Object.keys(data).some((key) => key !== "ids") ||
        !Array.isArray(ids) || ids.length > 50 || ids.some((id) =>
      !contentId(id) || id.length > 512)) {
      throw new HttpsError("invalid-argument", "Invalid notification IDs.");
    }
    const readAt = Date.now();
    await Promise.all([...new Set<string>(ids)].map((id) =>
      transactionWithRetry(adminDb.ref(`notifications/${uid}/${id}`),
        (notification) => {
          if (!notification) return notification;
          return notification.readAt > 0 ? notification :
            {...notification, readAt};
        })));
    return {serverNow: Date.now()};
  },
);
