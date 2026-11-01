import {adminDb} from "../../config/firebaseAdmin";
import {transactionWithRetry} from "../databaseTransaction";
import {randomUUID} from "node:crypto";

/**
 * Wake a durable battle job without making leased jobs block the due query.
 * @param {string} matchId Match.
 * @param {number} dueAt Earliest pending deadline.
 * @param {boolean} onlyIfMissing Preserve work during discovery.
 * @param {boolean} refreshEffects Reconcile previously settled achievements.
 * @return {Promise<object>} Generation and revision of this wakeup.
 */
export async function enqueueBattleWork(
  matchId: string,
  dueAt: number,
  onlyIfMissing = false,
  refreshEffects = false,
): Promise<{generation: string; revision: number}> {
  const generation = randomUUID();
  const tx = await transactionWithRetry(adminDb.ref(`battleWork/${matchId}`),
    (job) => {
      if (job && onlyIfMissing) return;
      const leased = Number(job?.leaseUntil) > Date.now();
      const previousDue = Number.isFinite(job?.dueAt) ? job.dueAt : dueAt;
      const previousWake = Number.isFinite(job?.wakeAt) ? job.wakeAt : dueAt;
      return {
        ...job,
        matchId,
        generation: job?.generation || generation,
        dueAt: leased ? job.leaseUntil : Math.min(previousDue, dueAt),
        wakeAt: leased ? Math.min(previousWake, dueAt) : null,
        revision: (Number(job?.revision) || 0) + 1,
        refreshEffects: refreshEffects || job?.refreshEffects || null,
      };
    },
  );
  const committed = tx.snapshot.val();
  return {generation: committed.generation, revision: committed.revision};
}
