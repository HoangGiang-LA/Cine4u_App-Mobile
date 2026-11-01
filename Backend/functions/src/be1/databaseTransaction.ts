import {Reference} from "firebase-admin/database";

/**
 * Retry only SDK-local cancellation caused by an overlapping set/update.
 * RTDB already retries server CAS conflicts; a local write instead rejects
 * pending transactions with Error("set"). Re-read through a new transaction
 * so concurrent settlement projections do not fail an otherwise valid call.
 * @param {Reference} ref Canonical record.
 * @param {Function} update Pure, retry-safe update callback.
 * @return {Promise<object>} Committed or explicitly aborted result.
 */
export async function transactionWithRetry(
  ref: Reference,
  update: Parameters<Reference["transaction"]>[0],
): ReturnType<Reference["transaction"]> {
  for (let retry = 0; ; retry++) {
    try {
      return await ref.transaction(update, undefined, false);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "set" || retry >= 7) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (retry + 1)));
    }
  }
}
