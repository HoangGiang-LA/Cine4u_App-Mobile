import {onCall, HttpsError} from "firebase-functions/v2/https";
import {adminAuth, adminDb} from "../../config/firebaseAdmin";
import {
  WireQuestion,
  buildAttemptResponse,
  getDateKey,
} from "./attemptHelper";

const QUESTION_TIME_LIMIT_SECONDS = 30;
const OPERATION_LEASE_MS = 10_000; // 10s lease timeout to recover stale pending operations
const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

const QUESTION_COUNTS: Record<string, number> = {
  PRACTICE: 10,
  TEST: 20,
  DAILY: 5,
};

interface QuestionMeta {
  categoryId: string;
  topicId: string;
  currentVersion: string;
  status: string;
}

interface VersionContent {
  prompt: string;
  options: Record<string, {text: string; order: number}>;
  passage?: string;
  audioText?: string;
}

/**
 * Shuffle array using Fisher-Yates.
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a wire-format question (no correct answer exposed).
 */
function buildWireQuestion(
  questionId: string,
  meta: QuestionMeta,
  content: VersionContent
): WireQuestion {
  const optionEntries = Object.entries(content.options)
    .sort(([, a], [, b]) => a.order - b.order);

  return {
    id: questionId,
    version: meta.currentVersion,
    categoryId: meta.categoryId,
    topicId: meta.topicId,
    prompt: content.prompt,
    options: optionEntries.map(([optId, opt]) => ({
      id: optId,
      text: opt.text,
    })),
    passage: content.passage ?? "",
    audioText: content.audioText ?? "",
  };
}

/**
 * Select random published questions filtered by topicId
 * (for PRACTICE) or unfiltered (for TEST/DAILY).
 */
async function selectQuestions(
  mode: string,
  topicId: string | null
): Promise<WireQuestion[]> {
  const count = QUESTION_COUNTS[mode];
  if (!count) {
    throw new HttpsError(
      "invalid-argument",
      `Unsupported mode: ${mode}`
    );
  }

  // Load all questions and filter published questions in memory (avoids missing .indexOn)
  const questionsSnap = await adminDb
    .ref("questions")
    .get();

  if (!questionsSnap.exists()) {
    throw new HttpsError(
      "failed-precondition",
      "Not enough questions available."
    );
  }

  const allQuestions: Array<{
    id: string; meta: QuestionMeta;
  }> = [];

  questionsSnap.forEach((child) => {
    const meta = child.val() as QuestionMeta;
    if (meta.status !== "published") return;
    if (!meta.currentVersion) return;

    // PRACTICE must filter by topicId
    if (mode === "PRACTICE" && topicId) {
      if (meta.topicId !== topicId) return;
    }

    allQuestions.push({id: child.key!, meta});
  });

  if (allQuestions.length < count) {
    throw new HttpsError(
      "failed-precondition",
      "Not enough questions available for this topic."
    );
  }

  // Select random subset
  const selected = shuffle(allQuestions).slice(0, count);

  // Load version content for selected questions
  const wireQuestions: WireQuestion[] = [];

  for (const {id, meta} of selected) {
    const versionSnap = await adminDb
      .ref(`questionVersions/${id}/${meta.currentVersion}`)
      .get();

    if (!versionSnap.exists()) {
      throw new HttpsError(
        "internal",
        "Question content missing."
      );
    }

    const content = versionSnap.val() as VersionContent;
    wireQuestions.push(buildWireQuestion(id, meta, content));
  }

  return wireQuestions;
}

export const startAttempt = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
  async (request) => {
    // 1. Auth check
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "You must sign in first."
      );
    }

    const data = request.data as {
      mode?: string;
      topicId?: string | null;
      requestId?: string;
    };

    const mode = data?.mode;
    const topicId = data?.topicId ?? null;
    const requestId = data?.requestId;

    // 2. Validate input format and safe key characters
    if (!mode || !requestId) {
      throw new HttpsError(
        "invalid-argument",
        "mode and requestId are required."
      );
    }

    if (typeof requestId !== "string" || !REQUEST_ID_REGEX.test(requestId)) {
      throw new HttpsError(
        "invalid-argument",
        "requestId must be a string matching ^[A-Za-z0-9_-]{1,128}$"
      );
    }

    if (!["PRACTICE", "TEST", "DAILY"].includes(mode)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid mode for this endpoint."
      );
    }

    if (mode === "PRACTICE" && (!topicId || topicId.length === 0)) {
      throw new HttpsError(
        "invalid-argument",
        "topicId is required for PRACTICE mode."
      );
    }

    let opKey: string | null = null;
    let acquiredLock = false;
    const workerToken = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      // 3. Verify account is active
      const authUser = await adminAuth.getUser(uid);
      if (authUser.disabled) {
        throw new HttpsError(
          "permission-denied",
          "This account has been disabled."
        );
      }

      const accessSnap = await adminDb
        .ref(`accountAccess/${uid}`)
        .get();
      const access = accessSnap.val();

      if (access?.status !== "active") {
        throw new HttpsError(
          "permission-denied",
          "This account is not active."
        );
      }

      // 4. Idempotency & Concurrency: acquire operation lock with lease
      const now = Date.now();
      opKey = `operations/${uid}_start_${requestId}`;
      const opRef = adminDb.ref(opKey);

      let existingAttemptId: string | null = null;
      let existingAttemptData: Record<string, unknown> | null = null;

      // 4a. Fast-path: check if operation already completed or has persisted attempt data
      const opSnap = await opRef.get();
      if (opSnap.exists()) {
        const opVal = opSnap.val() as Record<string, unknown>;
        if (opVal.attemptId) {
          // Validate parameter consistency
          const opMode = (opVal.mode as string) || "";
          const opTopic = (opVal.topicId as string) || "";
          if (opMode !== mode.toUpperCase() || opTopic !== (topicId ?? "")) {
            throw new HttpsError(
              "invalid-argument",
              "requestId has already been used with different parameters."
            );
          }

          // Check if attempt record already exists in database
          const aSnap = await adminDb
            .ref(`practiceAttempts/${uid}/${opVal.attemptId}`)
            .get();

          if (aSnap.exists()) {
            existingAttemptId = opVal.attemptId as string;
            existingAttemptData = aSnap.val() as Record<string, unknown>;
            if (opVal.status === "committing") {
              // Ensure operation status is updated to completed
              await opRef.update({status: "completed", completedAt: Date.now()}).catch(() => {});
            }
          }
        }
      }

      // 4b. Fallback: check recent attempts for backwards compatibility
      if (!existingAttemptId) {
        const existingSnap = await adminDb
          .ref(`practiceAttempts/${uid}`)
          .limitToLast(50)
          .get();

        if (existingSnap.exists()) {
          existingSnap.forEach((child) => {
            const val = child.val() as Record<string, unknown>;
            if (val.requestId === requestId) {
              existingAttemptId = child.key;
              existingAttemptData = val;
            }
          });
        }
      }

      if (existingAttemptId) {
        if (!existingAttemptData) {
          const aSnap = await adminDb
            .ref(`practiceAttempts/${uid}/${existingAttemptId}`)
            .get();
          if (aSnap.exists()) {
            existingAttemptData = aSnap.val() as Record<string, unknown>;
          }
        }
        if (existingAttemptData) {
          // Validate parameter consistency on attempt record
          const attMode = ((existingAttemptData.mode as string) || "").toUpperCase();
          const attTopic = (existingAttemptData.topicId as string) || "";
          if (attMode !== mode.toUpperCase() || attTopic !== (topicId ?? "")) {
            throw new HttpsError(
              "invalid-argument",
              "requestId has already been used with different parameters."
            );
          }
          return buildAttemptResponse(uid, existingAttemptId, existingAttemptData);
        }
      }

      // 4c. Atomic reservation with lease TTL and deterministic attempt ID
      let assignedAttemptId: string | null = null;
      const txResult = await opRef.transaction((current) => {
        if (current !== null) {
          // If already completed, do not overwrite
          if (current.status === "completed") {
            return;
          }
          // If pending or committing, check if active lease has expired
          const lockTime =
            (current.status === "committing" ? current.committedAt : current.createdAt) || 0;
          if (
            (current.status === "pending" || current.status === "committing") &&
            typeof lockTime === "number" &&
            now - lockTime < OPERATION_LEASE_MS
          ) {
            return;
          }
        }
        // Deterministic attemptId: preserve existing attemptId when reclaiming a stale lease
        assignedAttemptId = current?.attemptId || adminDb.ref(`practiceAttempts/${uid}`).push().key!;
        return {
          status: "pending",
          workerToken,
          attemptId: assignedAttemptId,
          mode: mode.toUpperCase(),
          topicId: topicId ?? "",
          createdAt: now,
        };
      });

      if (!txResult.committed) {
        acquiredLock = false;
        // Concurrent request won the race; wait briefly for attempt creation
        let waitAttemptId = txResult.snapshot.val()?.attemptId as string | undefined;
        if (!waitAttemptId) {
          await new Promise((r) => setTimeout(r, 600));
          const retryOp = await opRef.get();
          waitAttemptId = retryOp.val()?.attemptId as string | undefined;
        }

        if (waitAttemptId) {
          const aSnap = await adminDb
            .ref(`practiceAttempts/${uid}/${waitAttemptId}`)
            .get();
          if (aSnap.exists()) {
            const aData = aSnap.val() as Record<string, unknown>;
            const attMode = ((aData.mode as string) || "").toUpperCase();
            const attTopic = (aData.topicId as string) || "";
            if (attMode !== mode.toUpperCase() || attTopic !== (topicId ?? "")) {
              throw new HttpsError(
                "invalid-argument",
                "requestId has already been used with different parameters."
              );
            }
            return buildAttemptResponse(uid, waitAttemptId, aData);
          }
        }

        throw new HttpsError(
          "already-exists",
          "Attempt creation is already in progress."
        );
      }

      // Successfully acquired lease
      acquiredLock = true;
      const attemptId = txResult.snapshot.val()?.attemptId || assignedAttemptId!;

      // 5. DAILY mode: check one-per-day limit
      if (mode === "DAILY") {
        const dateKey = getDateKey();
        const dailySnap = await adminDb
          .ref(`userDailyChallenges/${uid}/${dateKey}`)
          .get();

        if (dailySnap.exists()) {
          const daily = dailySnap.val() as Record<string, unknown>;
          const status = daily.status as string;

          if (status === "active" || status === "waiting") {
            const existingDailyAttemptId = daily.attemptId as string;
            const aSnap = await adminDb
              .ref(`practiceAttempts/${uid}/${existingDailyAttemptId}`)
              .get();

            if (aSnap.exists()) {
              return buildAttemptResponse(
                uid,
                existingDailyAttemptId,
                aSnap.val() as Record<string, unknown>
              );
            }
          }

          throw new HttpsError(
            "already-exists",
            "Daily challenge already used today."
          );
        }
      }

      // 6. Select questions
      const questions = await selectQuestions(mode, topicId);

      // 7. Fencing verification: atomically ensure lease is still owned by this worker
      const committingTime = Date.now();
      const commitLockTx = await opRef.transaction((current) => {
        if (current === null) {
          // If local cache is null, return optimistic candidate matching our workerToken;
          // Firebase RTDB server will compare against true server state and re-run with actual data.
          return {
            status: "committing",
            workerToken,
            attemptId,
            committedAt: committingTime,
          };
        }
        if (current.workerToken !== workerToken || current.status !== "pending") {
          return; // FENCED OUT: actual server state shows lease was overtaken by another worker
        }
        return {
          ...current,
          status: "committing",
          committedAt: committingTime,
        };
      });

      if (!commitLockTx.committed) {
        // Lease expired during question selection and was overtaken.
        // MUST NOT write attempt data to avoid producing an orphan/second attempt.
        acquiredLock = false; // Do not cleanup in catch, lock belongs to new worker!
        throw new HttpsError(
          "aborted",
          "Operation lease expired and was overtaken by another request."
        );
      }

      // Do not recover by blindly overwriting an already persisted attempt
      const attemptCheck = await adminDb
        .ref(`practiceAttempts/${uid}/${attemptId}`)
        .get();
      if (attemptCheck.exists()) {
        const persistedData = attemptCheck.val() as Record<string, unknown>;
        await opRef.update({status: "completed", completedAt: Date.now()}).catch(() => {});
        return buildAttemptResponse(uid, attemptId, persistedData);
      }

      // 8. Capture fresh server-side open timestamp right before writing to database
      const openedAt = Date.now();
      const deadlineAt = openedAt + QUESTION_TIME_LIMIT_SECONDS * 1000;
      const questionCount = QUESTION_COUNTS[mode]!;

      const attemptRecord: Record<string, unknown> = {
        mode: mode.toLowerCase(),
        categoryId: questions[0]?.categoryId ?? "",
        topicId: topicId ?? "",
        status: "active",
        startedAt: openedAt,
        finishedAt: null,
        questionCount,
        correctCount: 0,
        answeredCount: 0,
        coinsAwarded: 0,
        currentIndex: 0,
        deadlineAt,
        requestId,
        createdAt: openedAt,
        updatedAt: openedAt,
      };

      const questionsRecord: Record<string, unknown> = {};
      questions.forEach((q, i) => {
        questionsRecord[i.toString()] = {
          questionId: q.id,
          version: q.version,
          categoryId: q.categoryId,
          topicId: q.topicId,
          prompt: q.prompt,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
          })),
          passage: q.passage,
          audioText: q.audioText,
          ordinal: i,
          openedAt: i === 0 ? openedAt : null,
          deadlineAt: i === 0 ? deadlineAt : null,
        };
      });

      // 9. Write atomically (all-or-nothing consistency)
      const updates: Record<string, unknown> = {};
      updates[`practiceAttempts/${uid}/${attemptId}`] = attemptRecord;
      updates[`attemptQuestions/${uid}/${attemptId}`] = questionsRecord;
      updates[opKey] = {
        status: "completed",
        workerToken,
        attemptId,
        mode: mode.toUpperCase(),
        topicId: topicId ?? "",
        completedAt: openedAt,
      };

      // For DAILY mode, reserve the daily slot
      if (mode === "DAILY") {
        const dateKey = getDateKey();
        updates[`userDailyChallenges/${uid}/${dateKey}`] = {
          attemptId,
          status: "active",
          startedAt: openedAt,
        };
      }

      await adminDb.ref().update(updates);

      // 10. Build response
      return {
        serverNow: Date.now(),
        attempt: {
          id: attemptId,
          mode,
          topicId: topicId ?? "",
          questions,
          index: 0,
          deadlineAt,
          receipts: [],
          status: "active",
          opponentName: "",
          result: null,
          reconnectDeadlineAt: null,
        },
      };
    } catch (error) {
      // Safe ownership-checked cleanup: ONLY remove if this worker acquired the lock
      // and the lock STILL belongs to this worker in pending state
      if (opKey && acquiredLock) {
        try {
          await adminDb.ref(opKey).transaction((current) => {
            if (current === null) {
              return null;
            }
            if (current.workerToken === workerToken && current.status === "pending") {
              return null; // Safely delete only owned pending lock
            }
            return; // Overtaken or completed; do not touch
          });
        } catch (_) {
          // ignore cleanup errors
        }
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("startAttempt failed", {uid, error});

      throw new HttpsError(
        "internal",
        "Unable to start attempt."
      );
    }
  }
);
