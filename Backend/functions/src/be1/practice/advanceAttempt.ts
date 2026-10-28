import {onCall, HttpsError} from "firebase-functions/v2/https";
import {adminAuth, adminDb} from "../../config/firebaseAdmin";
import {
  buildAttemptResponse,
  ensureQuestionDeadline,
  reconcileAttemptCounters,
} from "./attemptHelper";

const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

export const advanceAttempt = onCall(
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
      requestId?: string;
    };

    const attemptId = data?.attemptId;
    const requestId = data?.requestId;

    if (!attemptId || typeof attemptId !== "string" || attemptId.trim().length === 0) {
      throw new HttpsError("invalid-argument", "attemptId is required.");
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

      // If attempt is already waiting or completed (all questions finished)
      if (attemptData.status === "waiting" || attemptData.status === "completed") {
        return await buildAttemptResponse(uid, attemptId, attemptData);
      }

      if (attemptData.status !== "active") {
        throw new HttpsError("failed-precondition", "Attempt is not active.");
      }

      // Check advance operation idempotency (atomic operation tracking)
      const existingOps = (attemptData.advanceOperations as Record<string, unknown>) || {};
      if (existingOps[requestId]) {
        // This requestId already performed an advance on this attempt
        return await buildAttemptResponse(uid, attemptId, attemptData);
      }

      const currentIndex = (attemptData.currentIndex as number) ?? 0;
      const questionCount = (attemptData.questionCount as number) ?? 10;
      const now = Date.now();

      // 5. Check if current question is answered or expired
      const answerRef = adminDb.ref(`attemptAnswers/${uid}/${attemptId}/${currentIndex}`);
      const answerSnap = await answerRef.get();

      if (!answerSnap.exists()) {
        // Unanswered: validate deadline
        const qSnap = await adminDb
          .ref(`attemptQuestions/${uid}/${attemptId}/${currentIndex}`)
          .get();
        const qData = (qSnap.val() || {}) as Record<string, unknown>;
        const deadlineAt = await ensureQuestionDeadline(
          uid,
          attemptId,
          currentIndex,
          qData,
          attemptData
        );

        if (!deadlineAt || typeof deadlineAt !== "number" || deadlineAt <= 0) {
          throw new HttpsError(
            "failed-precondition",
            "Question deadline is missing or invalid."
          );
        }

        if (now <= deadlineAt) {
          throw new HttpsError(
            "failed-precondition",
            "Current question has not been answered and deadline has not expired."
          );
        }

        // Question expired: auto-record timeout exactly once
        const currentQId = (qData.questionId as string) || (qData.id as string) || "";
        await answerRef.transaction((current) => {
          if (current !== null) return; // already answered or timed out concurrently
          return {
            questionId: currentQId,
            selectedOptionId: null,
            isCorrect: false,
            timedOut: true,
            ordinal: currentIndex,
            requestId: `timeout_${attemptId}_${currentIndex}`,
            receivedAt: now,
          };
        });

        // Reconcile counters from authoritative answers
        await reconcileAttemptCounters(uid, attemptId, now);
      }

      // 6. Determine next state: last-question boundary vs next question
      const isLastQuestion = currentIndex >= questionCount - 1;

      if (isLastQuestion) {
        // Boundary transition: set status to 'waiting'
        const attTx = await attemptRef.transaction((att) => {
          if (!att) return att;
          // Strict validation: cannot transition if already not active OR currentIndex changed
          if (att.status !== "active" || att.currentIndex !== currentIndex) {
            return att;
          }
          if (att.advanceOperations && att.advanceOperations[requestId]) {
            return att;
          }
          att.status = "waiting";
          att.finishedAt = now;
          att.updatedAt = now;
          if (!att.advanceOperations) att.advanceOperations = {};
          att.advanceOperations[requestId] = {
            fromIndex: currentIndex,
            status: "waiting",
            completedAt: now,
          };
          return att;
        });

        // Mirror to advanceOperations path for backward-compatibility
        adminDb.ref(`advanceOperations/${uid}/${attemptId}/${requestId}`).set({
          fromIndex: currentIndex,
          status: "waiting",
          completedAt: now,
        }).catch(() => {});

        const updatedData = (attTx.snapshot.val() as Record<string, unknown>) || attemptData;
        return await buildAttemptResponse(uid, attemptId, updatedData);
      }

      // Next question index
      const nextIndex = currentIndex + 1;
      const nextOpenedAt = now;
      const nextDeadlineAt = nextOpenedAt + 30000;

      // 7. Update next question's openedAt & deadlineAt first for consistency
      await adminDb
        .ref(`attemptQuestions/${uid}/${attemptId}/${nextIndex}`)
        .update({
          openedAt: nextOpenedAt,
          deadlineAt: nextDeadlineAt,
        });

      // 8. Atomic advance of currentIndex & operation record
      const attTx = await attemptRef.transaction((att) => {
        if (!att) return att;
        if (att.status !== "active") return att;
        if (att.currentIndex !== currentIndex) {
          // Delayed or concurrent worker: currentIndex has already moved! Abort to prevent skipping questions.
          return;
        }
        if (att.advanceOperations && att.advanceOperations[requestId]) {
          return att; // Already executed with this requestId
        }
        att.currentIndex = nextIndex;
        att.deadlineAt = nextDeadlineAt;
        att.updatedAt = nextOpenedAt;
        if (!att.advanceOperations) att.advanceOperations = {};
        att.advanceOperations[requestId] = {
          fromIndex: currentIndex,
          toIndex: nextIndex,
          completedAt: nextOpenedAt,
        };
        return att;
      });

      if (!attTx.committed) {
        // Another concurrent request advanced currentIndex or aborted
        const latestSnap = await attemptRef.get();
        return await buildAttemptResponse(uid, attemptId, latestSnap.val());
      }

      // Mirror to advanceOperations path
      adminDb.ref(`advanceOperations/${uid}/${attemptId}/${requestId}`).set({
        fromIndex: currentIndex,
        toIndex: nextIndex,
        completedAt: nextOpenedAt,
      }).catch(() => {});

      const updatedData = (attTx.snapshot.val() as Record<string, unknown>) || attemptData;
      return await buildAttemptResponse(uid, attemptId, updatedData);
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("advanceAttempt error", {uid, attemptId, error});
      throw new HttpsError("internal", "Unable to advance attempt.");
    }
  }
);
