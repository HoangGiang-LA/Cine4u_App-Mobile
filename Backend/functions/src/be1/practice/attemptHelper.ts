import {HttpsError} from "firebase-functions/v2/https";
import {adminDb} from "../../config/firebaseAdmin";

export interface WireOption {
  id: string;
  text: string;
}

export interface WireQuestion {
  id: string;
  version: string;
  categoryId: string;
  topicId: string;
  prompt: string;
  options: WireOption[];
  passage: string;
  audioText: string;
}

export interface WireReceipt {
  questionId: string;
  optionId: string | null;
  correct: boolean | null;
}

export interface WireReview {
  question: WireQuestion;
  pickedId: string | null;
  correctId: string;
  explanation: string;
}

export interface WireResult {
  attemptId: string;
  mode: string;
  correct: number;
  total: number;
  coins: number;
  ratingDelta: number;
  outcome: string;
  opponentName: string;
  opponentCorrect: number;
  completedAt: number;
  reviews: WireReview[];
}

export interface WireAttempt {
  id: string;
  mode: string;
  topicId: string;
  questions: WireQuestion[];
  index: number;
  deadlineAt: number;
  receipts: WireReceipt[];
  status: string;
  opponentName: string;
  result: WireResult | null;
  reconnectDeadlineAt: number | null;
}

/**
 * Build reviews for finalized attempts using trusted backend questionAnswers and attemptReviews.
 */
export async function buildAttemptReviews(
  uid: string,
  attemptId: string,
  status: string,
  questions: WireQuestion[],
  answersRecord?: Record<string, Record<string, unknown>> | null
): Promise<WireReview[]> {
  // 1. Terminal state enforcement: reviews containing correct answers must NEVER be generated or cached for active/waiting attempts
  if (status !== "completed" && status !== "abandoned") {
    throw new HttpsError(
      "failed-precondition",
      "Reviews can only be generated or cached for completed or abandoned attempts."
    );
  }

  const reviews: WireReview[] = [];
  if (!questions || questions.length === 0) {
    return reviews;
  }

  // Pre-read any existing attemptReviews (if already persisted)
  const existingReviewsSnap = await adminDb
    .ref(`attemptReviews/${uid}/${attemptId}`)
    .get();
  const existingReviews = (existingReviewsSnap.val() || {}) as Record<
    string,
    Record<string, unknown>
  >;

  const answers = (answersRecord || {}) as Record<
    string,
    Record<string, unknown>
  >;
  const newReviewsToPersist: Record<string, unknown> = {};
  const now = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const key = i.toString();

    // 1. User's picked option
    const ans =
      answers[key] ||
      Object.values(answers).find(
        (a) => a && (a as Record<string, unknown>).questionId === q.id
      );

    let pickedId: string | null = null;
    if (ans && !ans.timedOut && typeof ans.selectedOptionId === "string") {
      pickedId = ans.selectedOptionId;
    }

    // 2. Correct answer & explanation
    const existing = existingReviews[key];
    let correctId = (existing?.correctOptionId as string) || "";
    let explanation = (existing?.explanation as string) || "";

    // If not cached or if cached record had an empty/invalid correctOptionId, load from trusted questionAnswers
    if (!correctId || typeof correctId !== "string" || correctId.trim().length === 0) {
      const qaSnap = await adminDb
        .ref(`questionAnswers/${q.id}/${q.version}`)
        .get();

      if (!qaSnap.exists()) {
        throw new HttpsError(
          "internal",
          `Trusted question answer configuration is missing on server for ${q.id}/${q.version}`
        );
      }

      const qa = qaSnap.val() as Record<string, unknown>;
      correctId = (qa.correctOptionId as string) || "";
      explanation = typeof qa.explanation === "string" ? qa.explanation : "";
    }

    // STRICT VALIDATION: Never return or cache reviews with an empty or invalid correctId
    if (!correctId || typeof correctId !== "string" || correctId.trim().length === 0) {
      throw new HttpsError(
        "internal",
        `Trusted question answer configuration is invalid or missing correctOptionId for ${q.id}/${q.version}`
      );
    }

    const optionExists = q.options && q.options.some((opt) => opt.id === correctId);
    if (!optionExists) {
      throw new HttpsError(
        "internal",
        `Correct answer ${correctId} does not match any valid option for question ${q.id}/${q.version}`
      );
    }

    // Only stage for caching if verified valid and not already in existingReviews
    if (!existingReviews[key]) {
      newReviewsToPersist[key] = {
        questionId: q.id,
        version: q.version,
        correctOptionId: correctId,
        explanation,
        releasedAt: now,
      };
    }

    reviews.push({
      question: {
        id: q.id,
        version: q.version,
        categoryId: q.categoryId,
        topicId: q.topicId,
        prompt: q.prompt,
        options: q.options,
        passage: q.passage || "",
        audioText: q.audioText || "",
      },
      pickedId,
      correctId,
      explanation,
    });
  }

  // Persist attemptReviews only for verified terminal attempts
  if (Object.keys(newReviewsToPersist).length > 0) {
    await adminDb
      .ref(`attemptReviews/${uid}/${attemptId}`)
      .update(newReviewsToPersist)
      .catch((err) => {
        console.warn("Failed to persist attemptReviews", {uid, attemptId, err});
      });
  }

  return reviews;
}

export async function buildAttemptResponse(
  uid: string,
  attemptId: string,
  attemptData: Record<string, unknown>
): Promise<{serverNow: number; attempt: WireAttempt}> {
  // Load stored questions
  const qSnap = await adminDb
    .ref(`attemptQuestions/${uid}/${attemptId}`)
    .get();

  const questions: WireQuestion[] = [];
  if (qSnap.exists()) {
    const qData = qSnap.val() as Record<
      string, Record<string, unknown>
    >;

    const sorted = Object.values(qData).sort(
      (a, b) => ((a.ordinal as number) ?? 0) - ((b.ordinal as number) ?? 0)
    );

    for (const q of sorted) {
      const optionsRaw = (q.options as Array<{id: string; text: string}>) ?? [];
      questions.push({
        id: (q.questionId as string) || (q.id as string) || "",
        version: (q.version as string) ?? "v1",
        categoryId: (q.categoryId as string) ?? "",
        topicId: (q.topicId as string) ?? "",
        prompt: (q.prompt as string) ?? "",
        options: optionsRaw.map((o) => ({
          id: o.id,
          text: o.text,
        })),
        passage: (q.passage as string) ?? "",
        audioText: (q.audioText as string) ?? "",
      });
    }
  }

  // Load answers/receipts
  const aSnap = await adminDb
    .ref(`attemptAnswers/${uid}/${attemptId}`)
    .get();

  const receipts: WireReceipt[] = [];

  if (aSnap.exists()) {
    const aData = aSnap.val() as Record<
      string, Record<string, unknown>
    >;

    const sortedAnswers = Object.values(aData).sort(
      (a, b) => ((a.ordinal as number) ?? 0) - ((b.ordinal as number) ?? 0)
    );

    for (const ans of sortedAnswers) {
      receipts.push({
        questionId: (ans.questionId as string) ?? "",
        optionId: (ans.selectedOptionId as string) ?? null,
        correct: typeof ans.isCorrect === "boolean" ? ans.isCorrect : null,
      });
    }
  }

  const modeRaw = (attemptData.mode as string) ?? "practice";
  const mode = normalizeMode(modeRaw);
  const currentIndex = (attemptData.currentIndex as number) ?? 0;
  const status = (attemptData.status as string) ?? "active";
  const topicId = (attemptData.topicId as string) ?? "";
  const deadlineAt = (attemptData.deadlineAt as number) ?? 0;

  // Build result if completed or abandoned
  let result: WireResult | null = null;
  if (status === "completed" || status === "abandoned") {
    const reviews = await buildAttemptReviews(
      uid,
      attemptId,
      status,
      questions,
      aSnap.val() as Record<string, Record<string, unknown>>
    );
    result = {
      attemptId,
      mode,
      correct: (attemptData.correctCount as number) ?? 0,
      total: (attemptData.questionCount as number) ?? questions.length,
      coins: (attemptData.coinsAwarded as number) ?? 0,
      ratingDelta: 0,
      outcome: status,
      opponentName: "",
      opponentCorrect: 0,
      completedAt: (attemptData.finishedAt as number) ?? 0,
      reviews,
    };
  }

  return {
    serverNow: Date.now(),
    attempt: {
      id: attemptId,
      mode,
      topicId,
      questions,
      index: currentIndex,
      deadlineAt,
      receipts,
      status,
      opponentName: "",
      result,
      reconnectDeadlineAt: null,
    },
  };
}

export function getDateKey(dateInput?: Date | number): string {
  const date = dateInput !== undefined ? new Date(dateInput) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function normalizeMode(mode: unknown): string {
  const value = typeof mode === "string" ? mode.toUpperCase() : "";
  return value === "DAILYCHALLENGE" ? "DAILY" : value;
}

export function dailyEndsAt(attempt: Record<string, unknown>): number {
  const startedAt = Number(attempt.startedAt || attempt.createdAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    throw new HttpsError("failed-precondition", "Daily start time is missing.");
  }
  return Date.parse(`${getDateKey(startedAt)}T00:00:00+07:00`) + 86400000;
}

export function isDailyExpired(
  attempt: Record<string, unknown>, now = Date.now()
): boolean {
  return normalizeMode(attempt.mode) === "DAILY" &&
    attempt.status !== "completed" && attempt.status !== "abandoned" &&
    now >= dailyEndsAt(attempt);
}

/**
 * Reconcile practiceAttempts answeredCount and correctCount from authoritative attemptAnswers.
 */
export async function reconcileAttemptCounters(
  uid: string,
  attemptId: string,
  now: number = Date.now()
): Promise<Record<string, unknown>> {
  const aSnap = await adminDb.ref(`attemptAnswers/${uid}/${attemptId}`).get();
  const allAnswers = (aSnap.val() || {}) as Record<string, {isCorrect?: boolean}>;
  const authoritativeAnswered = Object.keys(allAnswers).length;
  const authoritativeCorrect = Object.values(allAnswers).filter(
    (a) => a.isCorrect === true
  ).length;

  const attTx = await adminDb.ref(`practiceAttempts/${uid}/${attemptId}`).transaction((att) => {
    if (!att) return att;
    att.answeredCount = authoritativeAnswered;
    att.correctCount = authoritativeCorrect;
    att.updatedAt = now;
    return att;
  });

  return (attTx.snapshot.val() as Record<string, unknown>) || {};
}

/**
 * Ensure current question in attemptQuestions has valid openedAt and deadlineAt,
 * recovering from attemptData if needed.
 */
export async function ensureQuestionDeadline(
  uid: string,
  attemptId: string,
  index: number,
  qData: Record<string, unknown>,
  attemptData: Record<string, unknown>
): Promise<number> {
  let deadlineAt = (qData.deadlineAt as number) || (attemptData.deadlineAt as number) || 0;
  if (!deadlineAt || deadlineAt <= 0) {
    if (typeof qData.openedAt === "number" && qData.openedAt > 0) {
      deadlineAt = qData.openedAt + 30000;
    }
  }

  if (normalizeMode(attemptData.mode) === "DAILY" && deadlineAt > 0) {
    deadlineAt = Math.min(deadlineAt, dailyEndsAt(attemptData));
  }

  // Self-healing recovery: persist missing values to attemptQuestions
  if (deadlineAt > 0 && (qData.deadlineAt !== deadlineAt || qData.openedAt == null)) {
    const openedAt = (qData.openedAt as number) || (deadlineAt - 30000);
    await adminDb.ref(`attemptQuestions/${uid}/${attemptId}/${index}`).update({
      openedAt,
      deadlineAt,
    }).catch(() => {});
  }

  return deadlineAt;
}
