import {HttpsError} from "firebase-functions/v2/https";
import {adminDb} from "../../config/firebaseAdmin";
import {buildAttemptResponse, getDateKey, WireAttempt, WireResult} from "./attemptHelper";

export interface FinalizeOutput {
  serverNow: number;
  attempt: WireAttempt;
  result: WireResult | Record<string, unknown>;
}

export interface GrantRecord {
  attemptId: string;
  outcome: "completed" | "abandoned";
  coinDelta: number;
  correctCount: number;
  answeredCount: number;
  settledAt: number;
}

export interface UserSettlementModel {
  coinBalance: number;
  grants: Record<string, GrantRecord>;
  progress: Record<string, number>;
  initializedAt?: number;
}

/**
 * Authoritative user settlement at userSettlements/{uid}.
 * Guarantees exactly-once reward accounting, idempotent replays and safe crash recovery.
 */
export async function finalizeAttemptLogic(
  uid: string,
  attemptId: string,
  outcome: "completed" | "abandoned" = "completed"
): Promise<FinalizeOutput> {
  const attemptRef = adminDb.ref(`practiceAttempts/${uid}/${attemptId}`);
  const attemptSnap = await attemptRef.get();

  if (!attemptSnap.exists()) {
    throw new HttpsError("not-found", "Attempt not found or access denied.");
  }

  const attemptData = attemptSnap.val() as Record<string, unknown>;
  const now = Date.now();
  const grantId = `grant_${attemptId}`;
  const modeRaw = ((attemptData.mode as string) || "practice").toUpperCase();

  // Step 1: Read authoritative answers and validate before settlement
  const aSnap = await adminDb.ref(`attemptAnswers/${uid}/${attemptId}`).get();
  const allAnswers = (aSnap.val() || {}) as Record<
    string,
    {
      questionId?: string;
      selectedOptionId?: string | null;
      isCorrect?: boolean;
      timedOut?: boolean;
    }
  >;
  const totalQuestions = (attemptData.questionCount as number) || 10;
  const answeredCount = Object.keys(allAnswers).length;
  const correctCount = Object.values(allAnswers).filter(
    (a) => a.isCorrect === true
  ).length;

  if (outcome === "completed" && answeredCount < totalQuestions) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot finalize attempt: not all questions are resolved."
    );
  }

  // Atomic final-outcome decision on practiceAttempts
  // Prevents concurrent conflict between completed and abandoned calls
  const txOutcome = await attemptRef.transaction((att) => {
    if (!att) return att;
    // Already in a terminal state: keep immutable
    if (att.status === "completed" || att.status === "abandoned") {
      return att;
    }
    if (outcome === "completed") {
      if (att.status !== "waiting") {
        return; // Aborts transaction if not ready
      }
      att.status = "completed";
    } else {
      att.status = "abandoned";
    }
    att.finishedAt = att.finishedAt || now;
    att.updatedAt = now;
    return att;
  });

  if (!txOutcome.committed) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot finalize attempt: attempt is not in a valid state."
    );
  }

  const committedAttempt = txOutcome.snapshot.val() as Record<string, unknown>;
  const finalOutcome = committedAttempt.status as "completed" | "abandoned";

  // Step 2: Pre-read existing wallet, progress, and legacy rewardGrants for safe initialization/migration
  const [walletSnap, progSnap, rewardGrantsSnap] = await Promise.all([
    adminDb.ref(`wallets/${uid}`).get(),
    adminDb.ref(`learningProgress/${uid}`).get(),
    adminDb.ref(`rewardGrants/${uid}`).get(),
  ]);

  const baselineCoinBalance = (walletSnap.val()?.coinBalance as number) ?? 0;
  const baselineProgress: Record<string, number> = {};
  if (progSnap.exists()) {
    const pData = progSnap.val() as Record<string, unknown>;
    for (const [tId, v] of Object.entries(pData || {})) {
      if (v && typeof v === "object" && typeof (v as Record<string, unknown>).completedAttempts === "number") {
        baselineProgress[tId] = (v as Record<string, unknown>).completedAttempts as number;
      }
    }
  }

  // Import ONLY settled grants (status === "completed") from legacy rewardGrants
  const baselineGrants: Record<string, GrantRecord> = {};
  if (rewardGrantsSnap.exists()) {
    const rgData = rewardGrantsSnap.val() as Record<string, unknown>;
    for (const [rgId, rgVal] of Object.entries(rgData || {})) {
      if (rgVal && typeof rgVal === "object") {
        const valObj = rgVal as Record<string, unknown>;
        if (valObj.status === "completed") {
          baselineGrants[rgId] = {
            attemptId: (valObj.sourceId as string) || rgId.replace(/^grant_/, ""),
            outcome: "completed",
            coinDelta: (valObj.coinDelta as number) || 0,
            correctCount: 0,
            answeredCount: 0,
            settledAt: (valObj.grantedAt as number) || now,
          };
        }
      }
    }
  }

  // Calculate intended coin delta based on atomically decided finalOutcome
  let coinDelta = 0;
  if (finalOutcome === "completed") {
    if (modeRaw === "PRACTICE") coinDelta = 1;
    else if (modeRaw === "TEST") coinDelta = 2;
    else if (modeRaw === "DAILY") coinDelta = 2;
  }

  const topicId = (attemptData.topicId as string) || "";
  const categoryId = (attemptData.categoryId as string) || "";

  // Step 3: Authoritative transaction on userSettlements/{uid}
  // Pure transaction without external variable mutation
  const settlementTx = await adminDb
    .ref(`userSettlements/${uid}`)
    .transaction((current: UserSettlementModel | null) => {
      // Safe initialization from baseline if node does not exist yet
      if (!current) {
        current = {
          coinBalance: baselineCoinBalance,
          grants: { ...baselineGrants },
          progress: baselineProgress,
          initializedAt: now,
        };
      } else {
        current.grants = current.grants || {};
        for (const [bgId, bgVal] of Object.entries(baselineGrants)) {
          if (!current.grants[bgId]) {
            current.grants[bgId] = bgVal;
          }
        }
      }

      current.grants = current.grants || {};
      current.progress = current.progress || {};

      // 1. Check if grant already exists (idempotency & terminal outcome immutability)
      if (current.grants[grantId]) {
        return current; // Unchanged return: do not increment again
      }

      // 2. Grant new settlement
      const newGrant: GrantRecord = {
        attemptId,
        outcome: finalOutcome,
        coinDelta,
        correctCount,
        answeredCount,
        settledAt: now,
      };

      current.grants[grantId] = newGrant;
      if (coinDelta > 0) {
        current.coinBalance = (current.coinBalance || 0) + coinDelta;
      }

      if (finalOutcome === "completed" && modeRaw === "PRACTICE" && topicId) {
        current.progress[topicId] = (current.progress[topicId] || 0) + 1;
      }

      return current;
    });

  if (!settlementTx.committed) {
    throw new HttpsError("internal", "Failed to commit authoritative user settlement.");
  }

  // Derive authoritative output strictly from committed transaction snapshot
  const finalSettlement = settlementTx.snapshot.val() as UserSettlementModel;
  const grant = finalSettlement?.grants?.[grantId];
  if (!grant) {
    throw new HttpsError("internal", "Settlement grant missing from committed snapshot.");
  }
  const authoritativeProgress = (topicId && finalSettlement?.progress?.[topicId]) || 0;

  // Step 4: Synchronize / Project authoritative settlement into application nodes
  // 4.1 Sync wallets/{uid} safely using appliedGrants tracking
  const wasPreCreditedInBaseline = Boolean(baselineGrants[grantId]);

  await adminDb.ref(`wallets/${uid}`).transaction((w) => {
    if (!w) {
      return {
        coinBalance: finalSettlement.coinBalance,
        appliedGrants: { ...Object.fromEntries(Object.keys(baselineGrants).map((k) => [k, true])), [grantId]: true },
        updatedAt: now,
      };
    }
    w.appliedGrants = w.appliedGrants || {};
    for (const bgId of Object.keys(baselineGrants)) {
      w.appliedGrants[bgId] = true;
    }
    if (w.appliedGrants[grantId]) {
      return w; // Already applied to this wallet: replay is no-op
    }
    if (!wasPreCreditedInBaseline && grant.coinDelta > 0) {
      w.coinBalance = (w.coinBalance || 0) + grant.coinDelta;
    }
    w.appliedGrants[grantId] = true;
    w.updatedAt = now;
    return w;
  });

  // 4.2 Sync coinLedger & rewardGrants (keyed by grantId, completely idempotent)
  if (grant.coinDelta > 0) {
    await adminDb.ref(`coinLedger/${uid}/${grantId}`).set({
      id: grantId,
      label: `${modeRaw} Completion`,
      delta: grant.coinDelta,
      createdAt: grant.settledAt,
    });

    await adminDb.ref(`rewardGrants/${uid}/${grantId}`).set({
      sourceType: modeRaw.toLowerCase(),
      sourceId: attemptId,
      coinDelta: grant.coinDelta,
      status: "completed",
      grantedAt: grant.settledAt,
    });
  }

  // 4.3 Sync learningProgress (ONLY for completed PRACTICE mode)
  if (grant.outcome === "completed" && modeRaw === "PRACTICE" && topicId) {
    await adminDb.ref(`learningProgress/${uid}/${topicId}`).transaction((p) => {
      if (!p) {
        return {
          completedAttempts: authoritativeProgress || 1,
          completionTarget: 20,
          correctCount: grant.correctCount,
          answeredCount: grant.answeredCount,
          lastCompletedAt: grant.settledAt,
          appliedGrants: { [grantId]: true },
        };
      }
      p.appliedGrants = p.appliedGrants || {};
      if (p.appliedGrants[grantId]) {
        return p; // Already applied: prevent double-counting on replay
      }
      p.completedAttempts = authoritativeProgress || ((p.completedAttempts || 0) + 1);
      p.correctCount = (p.correctCount || 0) + grant.correctCount;
      p.answeredCount = (p.answeredCount || 0) + grant.answeredCount;
      p.lastCompletedAt = grant.settledAt;
      p.appliedGrants[grantId] = true;
      return p;
    });

    // Check achievement unlock for practice 20 (idempotent)
    if (authoritativeProgress >= 20) {
      await adminDb.ref(`userAchievements/${uid}/practice_20_${topicId}`).transaction((ua) => {
        if (ua && ua.unlockedAt > 0) return ua;
        return {
          progress: 20,
          unlockedAt: now,
          ruleVersion: "v1",
        };
      });
    }
  }

  // 4.4 Sync userSkillStats (ONLY for completed attempts)
  if (grant.outcome === "completed" && categoryId) {
    await adminDb.ref(`userSkillStats/${uid}/${categoryId}`).transaction((s) => {
      if (!s) {
        return {
          answeredCount: grant.answeredCount,
          correctCount: grant.correctCount,
          completedAttempts: 1,
          appliedGrants: { [grantId]: true },
          updatedAt: now,
        };
      }
      s.appliedGrants = s.appliedGrants || {};
      if (s.appliedGrants[grantId]) {
        return s; // Already applied: no-op
      }
      s.answeredCount = (s.answeredCount || 0) + grant.answeredCount;
      s.correctCount = (s.correctCount || 0) + grant.correctCount;
      s.completedAttempts = (s.completedAttempts || 0) + 1;
      s.appliedGrants[grantId] = true;
      s.updatedAt = now;
      return s;
    });
  }

  // 4.5 Sync userDailyChallenges (using attempt's original challenge date)
  if (modeRaw === "DAILY" && grant.outcome === "completed") {
    const originalDate = (attemptData.startedAt as number) || (attemptData.createdAt as number) || now;
    const dateKey = getDateKey(originalDate);
    await adminDb.ref(`userDailyChallenges/${uid}/${dateKey}`).update({
      status: "completed",
      completedAt: grant.settledAt,
    });
  }

  // 4.6 Update practiceAttempts record
  const finishedAt = (committedAttempt.finishedAt as number) || grant.settledAt;
  const updates: Record<string, unknown> = {
    status: grant.outcome,
    finishedAt,
    correctCount: grant.correctCount,
    answeredCount: grant.answeredCount,
    coinsAwarded: grant.coinDelta,
    rewardGrantId: grant.coinDelta > 0 ? grantId : null,
    updatedAt: now,
  };

  await attemptRef.update(updates);

  const finalAttemptData = {
    ...committedAttempt,
    ...updates,
  };

  const response = await buildAttemptResponse(uid, attemptId, finalAttemptData);
  return {
    serverNow: response.serverNow,
    attempt: response.attempt,
    result: response.attempt.result || {},
  };
}
