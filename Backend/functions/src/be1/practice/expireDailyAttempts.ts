import {onSchedule} from "firebase-functions/v2/scheduler";
import {adminDb} from "../../config/firebaseAdmin";
import {getDateKey, isDailyExpired} from "./attemptHelper";
import {finalizeAttemptLogic} from "./finalizeAttempt";

/** Midnight cleanup also runs when the user's app is closed. */
export async function expireDailyAttemptsLogic(): Promise<void> {
  const today = getDateKey();
  const users = (await adminDb.ref("userDailyChallenges").get()).val() || {};
  let failures = 0;
  for (const [uid, dates] of Object.entries(users)) {
    for (const [dateKey, value] of Object.entries(dates as Record<string, unknown>)) {
      const slot = value as {attemptId?: string; status?: string};
      if (dateKey >= today || !slot?.attemptId ||
          slot.status === "completed" || slot.status === "abandoned") continue;
      try {
        const attempt = (await adminDb.ref(
          `practiceAttempts/${uid}/${slot.attemptId}`
        ).get()).val();
        if (attempt && (isDailyExpired(attempt) ||
            attempt.status === "completed" || attempt.status === "abandoned")) {
          await finalizeAttemptLogic(uid, slot.attemptId,
            attempt.status === "completed" ? "completed" : "abandoned");
        }
      } catch (error) {
        failures++;
        console.error("Daily expiry failed", {uid, dateKey, error});
      }
    }
  }
  if (failures) throw new Error(`Daily expiry failed for ${failures} attempts.`);
}

export const expireDailyAttempts = onSchedule({
  schedule: "0 0 * * *", timeZone: "Asia/Ho_Chi_Minh", region: "asia-southeast1",
}, expireDailyAttemptsLogic);
