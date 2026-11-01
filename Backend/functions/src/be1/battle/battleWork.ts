import {adminDb} from "../../config/firebaseAdmin";
import {transactionWithRetry} from "../databaseTransaction";

/**
 * Wake a durable battle job without making leased jobs block the due query.
 * @param {string} matchId Match.
 * @param {number} dueAt Earliest pending deadline.
 * @param {boolean} onlyIfMissing Preserve work during discovery.
 */
export async function enqueueBattleWork(
  matchId: string,
  dueAt: number,
  onlyIfMissing = false,
): Promise<void> {
  await transactionWithRetry(adminDb.ref(`battleWork/${matchId}`),
    (job) => {
      if (job && onlyIfMissing) return;
      const leased = Number(job?.leaseUntil) > Date.now();
      const previousDue = Number.isFinite(job?.dueAt) ? job.dueAt : dueAt;
      const previousWake = Number.isFinite(job?.wakeAt) ? job.wakeAt : dueAt;
      return {
        ...job,
        matchId,
        dueAt: leased ? job.leaseUntil : Math.min(previousDue, dueAt),
        wakeAt: leased ? Math.min(previousWake, dueAt) : null,
        revision: (Number(job?.revision) || 0) + 1,
      };
    },
  );
}
