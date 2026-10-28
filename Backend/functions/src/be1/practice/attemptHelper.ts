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
  result: Record<string, unknown> | null;
  reconnectDeadlineAt: number | null;
}

/**
 * Reconstruct an attempt response from stored data in RTDB.
 */
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
  const mode = modeRaw.toUpperCase();
  const currentIndex = (attemptData.currentIndex as number) ?? 0;
  const status = (attemptData.status as string) ?? "active";
  const topicId = (attemptData.topicId as string) ?? "";
  const deadlineAt = (attemptData.deadlineAt as number) ?? 0;

  // Build result if completed or abandoned
  let result: Record<string, unknown> | null = null;
  if (status === "completed" || status === "abandoned") {
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
      reviews: [],
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

export function getDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}
