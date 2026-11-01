import {onSchedule} from "firebase-functions/v2/scheduler";
import {runLearningMaintenance} from "./learningMaintenance";

/** Midnight starts the same bounded recovery used throughout the day. */
export async function expireDailyAttemptsLogic(): Promise<void> {
  await runLearningMaintenance();
}

export const expireDailyAttempts = onSchedule(
  {schedule: "0 0 * * *", timeZone: "Asia/Ho_Chi_Minh",
    region: "asia-southeast1", timeoutSeconds: 540, maxInstances: 1},
  expireDailyAttemptsLogic,
);
