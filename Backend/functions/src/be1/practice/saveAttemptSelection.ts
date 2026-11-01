import {onCall, HttpsError} from "firebase-functions/v2/https";
import {adminAuth, adminDb} from "../../config/firebaseAdmin";
import {contentId} from "./contentValidation";
import {saveLearningSelection} from "./attemptState";

export const saveAttemptSelection = onCall(
  {region: "asia-southeast1", maxInstances: 10},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const {attemptId, questionId, optionId, requestId} = request.data || {};
    if (!contentId(attemptId) || !contentId(questionId) ||
        !contentId(optionId) || typeof requestId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) {
      throw new HttpsError("invalid-argument", "Invalid selection request.");
    }
    const user = await adminAuth.getUser(uid);
    const access = (await adminDb.ref(`accountAccess/${uid}`).get()).val();
    if (user.disabled || access?.status !== "active") {
      throw new HttpsError("permission-denied", "This account is not active.");
    }
    const accepted = await saveLearningSelection(
      uid, attemptId, questionId, optionId, requestId,
    );
    return {serverNow: Date.now(), accepted};
  },
);
