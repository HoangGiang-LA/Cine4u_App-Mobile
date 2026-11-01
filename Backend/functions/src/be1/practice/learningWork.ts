import {createHash} from "node:crypto";
import {adminDb} from "../../config/firebaseAdmin";
import {transactionWithRetry} from "../databaseTransaction";

/**
 * Durable work key safe for Firebase paths.
 * @param {string} uid Owner.
 * @param {string} attemptId Attempt.
 * @return {string} Stable key.
 */
export function learningWorkKey(uid: string, attemptId: string): string {
  return createHash("sha256")
    .update(JSON.stringify([uid, attemptId]))
    .digest("hex");
}

/**
 * Keep an existing lease and wake the worker for the earliest change.
 * @param {string} uid Owner.
 * @param {string} attemptId Attempt.
 * @param {number} dueAt Wakeup time.
 * @param {boolean} onlyIfMissing Preserve existing jobs during discovery.
 */
export async function enqueueLearningWork(
  uid: string,
  attemptId: string,
  dueAt: number,
  onlyIfMissing = false,
): Promise<void> {
  await transactionWithRetry(
    adminDb.ref(`learningWork/${learningWorkKey(uid, attemptId)}`),
    (job) => {
      if (job && onlyIfMissing) return;
      const leased = Number(job?.leaseUntil) > Date.now();
      const previousDue = Number.isFinite(job?.dueAt) ? job.dueAt : dueAt;
      const previousWake = Number.isFinite(job?.wakeAt) ?
        job.wakeAt :
        dueAt;
      return {
        ...job,
        uid,
        attemptId,
        // Leased jobs stay out of the due query. Remember concurrent client
        // changes separately so releasing the lease still wakes them early.
        dueAt: leased ? job.leaseUntil : Math.min(previousDue, dueAt),
        wakeAt: leased ? Math.min(previousWake, dueAt) : null,
        revision: (Number(job?.revision) || 0) + 1,
      };
    },
  );
}

/**
 * Payload used by atomic attempt creation.
 * @param {string} uid Owner.
 * @param {string} attemptId Attempt.
 * @param {number} dueAt First deadline.
 * @return {object} Queue entry.
 */
export function initialLearningWork(
  uid: string,
  attemptId: string,
  dueAt: number,
) {
  return {uid, attemptId, dueAt, revision: 1};
}
