import {Reference} from "firebase-admin/database";

/**
 * Retry SDK-local write cancellation or exhausted CAS retries under contention.
 * Start a fresh, bounded transaction for "set" or "maxretry". Permission and
 * validation failures propagate unchanged; callbacks remain pure/retry-safe.
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
      if (!(error instanceof Error) ||
          !["set", "maxretry"].includes(error.message) || retry >= 7) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (retry + 1)));
    }
  }
}
