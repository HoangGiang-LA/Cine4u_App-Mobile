import {HttpsError} from "firebase-functions/v2/https";
import {adminDb} from "../../config/firebaseAdmin";
import {WireResult} from "../practice/attemptHelper";
import {GrantRecord, UserSettlementModel} from "../practice/finalizeAttempt";
import {BattleMatch, BattleOutcome} from "./battleTypes";
import {enqueueBattleWork} from "./battleWork";
import {releaseBattle} from "./matchmaking";

const nonnegative = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ?
    value :
    0;

const statsBaseline = (stats: Record<string, unknown>) => ({
  wins: nonnegative(stats.wins),
  losses: nonnegative(stats.losses),
  draws: nonnegative(stats.draws),
  matchesPlayed: nonnegative(stats.matchesPlayed),
  winStreak: nonnegative(stats.winStreak ?? stats.currentWinStreak),
  bestWinStreak: nonnegative(stats.bestWinStreak),
});

const settlePlayer = async (match: BattleMatch, uid: string) => {
  const finish = match.finish!;
  const grantId = `grant_${match.id}`;
  const [wallet, progress, grants, stats] = await Promise.all([
    adminDb.ref(`wallets/${uid}`).get(),
    adminDb.ref(`learningProgress/${uid}`).get(),
    adminDb.ref(`rewardGrants/${uid}`).get(),
    adminDb.ref(`userStats/${uid}`).get(),
  ]);
  const baselineGrants: Record<string, GrantRecord> = {};
  for (const [id, value] of Object.entries(grants.val() || {})) {
    const g = value as Record<string, unknown>;
    if (g.status === "completed") {
      baselineGrants[id] = {
        attemptId: String(g.sourceId || id),
        outcome: "completed",
        coinDelta: nonnegative(g.coinDelta),
        correctCount: 0,
        answeredCount: 0,
        settledAt: Number(g.grantedAt) || finish.at,
      };
    }
  }
  const baselineProgress = Object.fromEntries(
    Object.entries(progress.val() || {}).map(([id, p]) => [
      id,
      nonnegative((p as Record<string, unknown>).completedAttempts),
    ]),
  );
  const baselineStats = statsBaseline(stats.val() || {});
  const tx = await adminDb.ref(`userSettlements/${uid}`).transaction(
    (current: UserSettlementModel | null) => {
      const s = current || {
        coinBalance: nonnegative(wallet.val()?.coinBalance),
        grants: {...baselineGrants},
        progress: baselineProgress,
        initializedAt: Date.now(),
      };
      s.grants ||= {};
      if (s.grants[grantId]?.sourceType === "battle") return s;
      s.rating ??= nonnegative(stats.val()?.rating);
      s.battleStats ||= {...baselineStats};
      const outcome = finish.outcomes[uid];
      const before = s.rating;
      const after =
        outcome === "win" ?
          before + 5 :
          ["loss", "left"].includes(outcome) ?
            Math.max(0, before - 2) :
            before;
      const coins = outcome === "win" ? 5 : 0;
      s.grants[grantId] = {
        attemptId: match.id,
        sourceType: "battle",
        outcome,
        coinDelta: coins,
        correctCount: finish.correct[uid],
        answeredCount: finish.answered[uid],
        settledAt: finish.at,
        ratingBefore: before,
        ratingAfter: after,
        ratingDelta: after - before,
      };
      s.coinBalance = nonnegative(s.coinBalance) + coins;
      s.rating = after;
      s.battleStats.matchesPlayed++;
      if (outcome === "win") {
        s.battleStats.wins++;
        s.battleStats.winStreak++;
        s.battleStats.bestWinStreak = Math.max(
          s.battleStats.bestWinStreak,
          s.battleStats.winStreak,
        );
      } else {
        if (outcome === "draw") s.battleStats.draws++;
        else s.battleStats.losses++;
        s.battleStats.winStreak = 0;
      }
      return s;
    },
    undefined,
    false,
  );
  const settlement = tx.snapshot.val() as UserSettlementModel;
  const grant = settlement.grants[grantId];
  if (!grant || grant.sourceType !== "battle") {
    throw new HttpsError("internal", "Battle grant missing.");
  }
  await adminDb.ref(`wallets/${uid}`).transaction(
    (w) => {
      if (!w) {
        return {
          coinBalance: settlement.coinBalance,
          appliedGrants: Object.fromEntries(
            Object.keys(settlement.grants).map((id) => [id, true]),
          ),
          updatedAt: Date.now(),
        };
      }
      w.appliedGrants ||= {};
      if (w.appliedGrants[grantId]) return w;
      w.coinBalance = nonnegative(w.coinBalance) + grant.coinDelta;
      w.appliedGrants[grantId] = true;
      w.updatedAt = Date.now();
      return w;
    },
    undefined,
    false,
  );
  await adminDb.ref(`userStats/${uid}`).transaction(
    (s) => {
      if (!s) {
        return {
          ...settlement.battleStats,
          rating: settlement.rating,
          currentWinStreak: settlement.battleStats!.winStreak,
          appliedGrants: Object.fromEntries(
            Object.entries(settlement.grants)
              .filter(([, g]) => g.sourceType === "battle")
              .map(([id]) => [id, true]),
          ),
          updatedAt: Date.now(),
        };
      }
      s.appliedGrants ||= {};
      if (s.appliedGrants[grantId]) return s;
      s.rating = Math.max(0, nonnegative(s.rating) + grant.ratingDelta!);
      s.matchesPlayed = nonnegative(s.matchesPlayed) + 1;
      const win = grant.outcome === "win";
      const draw = grant.outcome === "draw";
      const counter = win ? "wins" : draw ? "draws" : "losses";
      s[counter] = nonnegative(s[counter]) + 1;
      s.winStreak = win ?
        nonnegative(s.winStreak ?? s.currentWinStreak) + 1 :
        0;
      s.currentWinStreak = s.winStreak;
      s.bestWinStreak = Math.max(nonnegative(s.bestWinStreak), s.winStreak);
      s.appliedGrants[grantId] = true;
      s.updatedAt = Date.now();
      return s;
    },
    undefined,
    false,
  );
  const updates: Record<string, unknown> = {
    [`ratingLedger/${uid}/${match.id}`]: {
      outcome: grant.outcome,
      ratingBefore: grant.ratingBefore,
      ratingAfter: grant.ratingAfter,
      ratingDelta: grant.ratingDelta,
      settledAt: grant.settledAt,
    },
  };
  if (grant.coinDelta) {
    updates[`coinLedger/${uid}/${grantId}`] = {
      id: grantId,
      label: "Battle win",
      delta: grant.coinDelta,
      createdAt: grant.settledAt,
    };
    updates[`rewardGrants/${uid}/${grantId}`] = {
      sourceType: "battle",
      sourceId: match.id,
      coinDelta: grant.coinDelta,
      status: "completed",
      grantedAt: grant.settledAt,
    };
  }
  await adminDb.ref().update(updates);
  const skills: Record<string, {correct: number; answered: number}> = {};
  for (const [index, answer] of Object.entries(
    match.players[uid].answers || {},
  )) {
    const skill = match.questions[Number(index)].categoryId;
    const counts = (skills[skill] ||= {correct: 0, answered: 0});
    counts.answered++;
    if (answer.isCorrect) counts.correct++;
  }
  for (const [id, counts] of Object.entries(skills)) {
    await adminDb.ref(`userSkillStats/${uid}/${id}`).transaction(
      (s) => {
        s ||= {answeredCount: 0, correctCount: 0, completedAttempts: 0};
        s.appliedGrants ||= {};
        if (s.appliedGrants[grantId]) return s;
        s.answeredCount += counts.answered;
        s.correctCount += counts.correct;
        s.completedAttempts++;
        s.appliedGrants[grantId] = true;
        s.updatedAt = Date.now();
        return s;
      },
      undefined,
      false,
    );
  }
  const opponent = Object.keys(match.players).find((id) => id !== uid)!;
  const result: WireResult = {
    attemptId: match.id,
    mode: "BATTLE",
    correct: grant.correctCount,
    total: 10,
    coins: grant.coinDelta,
    ratingDelta: grant.ratingDelta!,
    outcome: grant.outcome,
    opponentName: match.players[opponent].name,
    opponentCorrect: finish.correct[opponent],
    completedAt: finish.at,
    reviews: match.questions.map((question, index) => ({
      question,
      pickedId: match.players[uid].answers?.[index]?.selectedOptionId || null,
      correctId: match.keys[question.id].correctOptionId,
      explanation: match.keys[question.id].explanation,
    })),
  };
  return result;
};

/**
 * Project both frozen outcomes; interruption leaves a durable retry job.
 * @param {string} matchId Completed match identifier.
 * @return {Promise<void>} Durable settlement and reservation release.
 */
export async function settleBattle(matchId: string): Promise<void> {
  const match = (
    await adminDb.ref(`battleRooms/${matchId}`).get()
  ).val() as BattleMatch | null;
  if (!match || match.status !== "completed" || !match.finish) {
    throw new HttpsError("failed-precondition", "Battle is not complete.");
  }
  if (match.settlementVersion === 1) {
    await releaseBattle(match);
    return;
  }
  await enqueueBattleWork(matchId, Date.now());
  const updates: Record<string, unknown> = {};
  const playerResults: Record<string, unknown> = {};
  for (const uid of Object.keys(match.players)) {
    const result = await settlePlayer(match, uid);
    updates[`battleReviews/${matchId}/${uid}`] = result;
    updates[`battleHistory/${uid}/${matchId}`] = {
      ...result,
      reviews: [],
      finishedAt: result.completedAt,
    };
    playerResults[uid] = {
      outcome: result.outcome,
      correct: result.correct,
      coinsAwarded: result.coins,
      ratingDelta: result.ratingDelta,
    };
  }
  updates[`battleResults/${matchId}`] = {
    status: "settled",
    endReason: match.finish.reason,
    players: playerResults,
    correctCounts: match.finish.correct,
    finishedAt: match.finish.at,
    settlementVersion: 1,
  };
  updates[`battleLogs/${matchId}`] = match.events || {};
  updates[`battleRooms/${matchId}/settlementVersion`] = 1;
  updates[`battleRooms/${matchId}/settlementCompletedAt`] = Date.now();
  updates[`battleWork/${matchId}`] = null;
  await adminDb.ref().update(updates);
  await releaseBattle(match);
}

export const battleOutcome = (
  match: BattleMatch,
  uid: string,
): BattleOutcome => match.finish!.outcomes[uid];
