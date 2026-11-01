import {createHash} from "node:crypto";
import {adminDb} from "../../config/firebaseAdmin";
import {transactionWithRetry} from "../databaseTransaction";
import {integer, publishNotification} from "./notifications";

const idFor = (id: string) =>
  "practice_achievement_" +
  createHash("sha256").update(id).digest("hex").slice(0, 32);
const eventFor = (
  id: string,
  definition: {title?: unknown},
  at: number,
) =>
  typeof definition?.title === "string" &&
  definition.title.trim() &&
  definition.title.length <= 512 ?
    {
      id: idFor(id),
      title: "Mở khóa thành tích",
      body: `Bạn đã mở khóa thành tích: ${definition.title}.`,
      targetType: "Achievements",
      sourceType: "practice_achievement",
      sourceId: id,
      createdAt: at,
    } :
    null;

export const unlockPracticeAchievement = async (
  uid: string,
  topicId: string,
  at: number,
) => {
  const id = `practice_20_${topicId}`;
  const definition = (
    await adminDb.ref(`achievements/${id}`).get()
  ).val();
  const allowed =
    definition?.status === "published" &&
    definition.conditionType === "practice_completion_count" &&
    definition.targetId === topicId &&
    definition.threshold === 20;
  const tx = await transactionWithRetry(
    adminDb.ref(`userAchievements/${uid}/${id}`),
    (s) => {
      const earned = integer(s?.unlockedAt) ?
        s :
        {progress: 20, unlockedAt: at, ruleVersion: "v1"};
      if (!earned.notification && allowed) {
        const event = eventFor(id, definition, earned.unlockedAt);
        if (event) earned.notification = event;
      }
      return earned;
    },
  );
  const event = tx.snapshot.val().notification;
  if (event) await publishNotification(uid, event.id, event);
};

export const refreshPracticeNotifications = async (uid: string) => {
  const earned =
    (await adminDb.ref(`userAchievements/${uid}`).get()).val() || {};
  for (const [id, raw] of Object.entries(earned)) {
    const value = raw as {
      unlockedAt?: number;
      notification?: {id: string};
    };
    if (!id.startsWith("practice_20_") || !integer(value.unlockedAt)) {
      continue;
    }
    if (value.notification) {
      await publishNotification(
        uid,
        value.notification.id,
        value.notification as unknown as Record<string, unknown>,
      );
    } else {
      await unlockPracticeAchievement(
        uid,
        id.slice("practice_20_".length),
        value.unlockedAt!,
      );
    }
  }
};
