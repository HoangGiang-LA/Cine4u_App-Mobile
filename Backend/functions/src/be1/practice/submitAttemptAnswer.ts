import {onCall, HttpsError} from "firebase-functions/v2/https";
import {adminAuth, adminDb} from "../../config/firebaseAdmin";
import {
  isDailyExpired,
  ensureQuestionDeadline,
  reconcileAttemptCounters,
} from "./attemptHelper";
import {readAttemptResponse as buildAttemptResponse} from "./finalizeAttempt";

const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

export const submitAttemptAnswer = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
  async (request) => {
    // 1. Authentication
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must sign in first.");
    }

    // 2. Validate input
    const data = request.data as {
      attemptId?: string;
      questionId?: string;
      optionId?: string | null;
      requestId?: string;
    };

    const attemptId = data?.attemptId;
    const questionId = data?.questionId;
    const optionId = data?.optionId !== undefined ? data.optionId : null;
    const requestId = data?.requestId;

    if (!attemptId || typeof attemptId !== "string" || attemptId.trim().length === 0) {
      throw new HttpsError("invalid-argument", "attemptId is required.");
    }
    if (!questionId || typeof questionId !== "string" || questionId.trim().length === 0) {
      throw new HttpsError("invalid-argument", "questionId is required.");
    }
    if (optionId !== null && (typeof optionId !== "string" || optionId.trim().length === 0)) {
      throw new HttpsError("invalid-argument", "optionId must be a valid string or null.");
    }
    if (!requestId || typeof requestId !== "string" || !REQUEST_ID_REGEX.test(requestId)) {
      throw new HttpsError(
        "invalid-argument",
        "requestId is required and must match ^[A-Za-z0-9_-]{1,128}$"
      );
    }

    try {
      // 3. Verify user status
      const authUser = await adminAuth.getUser(uid);
      if (authUser.disabled) {
        throw new HttpsError("permission-denied", "This account has been disabled.");
      }
      const accessSnap = await adminDb.ref(`accountAccess/${uid}`).get();
      const access = accessSnap.val();
      if (access?.status !== "active") {
        throw new HttpsError("permission-denied", "This account is not active.");
      }

      // 4. Verify attempt existence and ownership
      const attemptRef = adminDb.ref(`practiceAttempts/${uid}/${attemptId}`);
      const attemptSnap = await attemptRef.get();
      if (!attemptSnap.exists()) {
        throw new HttpsError("not-found", "Attempt not found or access denied.");
      }
      const attemptData = attemptSnap.val() as Record<string, unknown>;
      if (isDailyExpired(attemptData)) {
        return buildAttemptResponse(uid, attemptId, attemptData);
      }

      // 5. Verify attempt status
      if (attemptData.status !== "active") {
        throw new HttpsError("failed-precondition", "Attempt is not active.");
      }

      const currentIndex = (attemptData.currentIndex as number) ?? 0;

      // 6. Verify question belongs to current question index
      const qSnap = await adminDb
        .ref(`attemptQuestions/${uid}/${attemptId}/${currentIndex}`)
        .get();
      if (!qSnap.exists()) {
        throw new HttpsError("internal", "Question data missing.");
      }
      const qData = qSnap.val() as Record<string, unknown>;
      const actualQuestionId = (qData.questionId as string) || (qData.id as string);
      if (actualQuestionId !== questionId) {
        throw new HttpsError(
          "failed-precondition",
          "Submitted question does not match current active question."
        );
      }

      // 7. Validate optionId against assigned question options
      const options = (qData.options as Array<{id: string; text: string}>) ?? [];
      if (optionId !== null) {
        const optionExists = options.some((opt) => opt.id === optionId);
        if (!optionExists) {
          throw new HttpsError("invalid-argument", "Invalid optionId for this question.");
        }
      }

      // 8. Deadline enforcement (Issue 6 & Issue 4: strict validation + self-healing recovery)
      const now = Date.now();
      const deadlineAt = await ensureQuestionDeadline(
        uid,
        attemptId,
        currentIndex,
        qData,
        attemptData
      );

      if (!deadlineAt || typeof deadlineAt !== "number" || deadlineAt <= 0) {
        throw new HttpsError("failed-precondition", "Question deadline is missing or invalid.");
      }

      if (optionId !== null && now > deadlineAt) {
        throw new HttpsError("failed-precondition", "Question deadline has expired.");
      }
      if (optionId === null && now < deadlineAt) {
        throw new HttpsError("failed-precondition", "Question has not timed out.");
      }

      // 9. Fetch correct answer from trusted backend questionAnswers (Issue 5: must error if missing/invalid)
      let isCorrect = false;
      let timedOut = false;

      if (optionId === null) {
        timedOut = true;
        isCorrect = false;
      } else {
        const version = (qData.version as string) || "v1";
        const qaSnap = await adminDb
          .ref(`questionAnswers/${questionId}/${version}`)
          .get();
        if (!qaSnap.exists()) {
          throw new HttpsError(
            "internal",
            `Question answer configuration is missing on server for ${questionId}/${version}`
          );
        }
        const qa = qaSnap.val() as {correctOptionId?: string} | null;
        if (!qa || typeof qa.correctOptionId !== "string" || qa.correctOptionId.trim().length === 0) {
          throw new HttpsError(
            "internal",
            `Invalid correctOptionId configuration on server for ${questionId}/${version}`
          );
        }
        if (!options.some((option) => option.id === qa.correctOptionId)) {
          throw new HttpsError("internal", "Correct answer does not match assigned options.");
        }
        isCorrect = optionId === qa.correctOptionId;
      }

      // 10. Atomic answer write with idempotency & concurrency protection
      const answerRef = adminDb.ref(`attemptAnswers/${uid}/${attemptId}/${currentIndex}`);

      const txResult = await answerRef.transaction((current) => {
        if (isDailyExpired(attemptData)) return;
        if (current !== null) {
          return; // Abort: answer already exists
        }
        return {
          questionId,
          selectedOptionId: optionId,
          isCorrect,
          timedOut,
          ordinal: currentIndex,
          requestId,
          receivedAt: now,
        };
      });

      if (!txResult.committed) {
        const existingRecord = txResult.snapshot.val() as Record<string, unknown> | null;
        if (existingRecord && existingRecord.requestId === requestId) {
          // Idempotent retry: reconcile counters in case a prior crash prevented update (Issue 1)
          const reconciledData = await reconcileAttemptCounters(uid, attemptId, now);
          return await buildAttemptResponse(uid, attemptId, reconciledData);
        }

        // Different requestId or timed-out answer already exists
        throw new HttpsError("failed-precondition", "Question has already been answered.");
      }

      // 11. Transaction succeeded! Authoritatively reconcile attempt counters (Issue 1)
      const reconciledData = await reconcileAttemptCounters(uid, attemptId, now);
      return await buildAttemptResponse(uid, attemptId, reconciledData);
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("submitAttemptAnswer error", {uid, attemptId, error});
      throw new HttpsError("internal", "Unable to submit answer.");
    }
  }
);
