import {randomUUID} from "node:crypto";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {adminAuth, adminDb} from "../../config/firebaseAdmin";
import {getDateKey, isDailyExpired, normalizeMode} from "./attemptHelper";
import {
  advanceLearningAttempt,
  projectAttemptState,
  StoredAttempt,
} from "./attemptState";
import {finalizeAttemptLogic} from "./finalizeAttempt";
import {enqueueLearningWork, learningWorkKey} from "./learningWork";

const LEASE_MS = 90000;
const PAGE_SIZE = 50;

/**
 * Process a single attempt using the same transactions as callable requests.
 * @param {string} uid Owner.
 * @param {string} attemptId Attempt.
 * @return {Promise<number|null>} Next deadline, or no remaining work.
 */
async function processAttempt(uid: string, attemptId: string) {
  const ref = adminDb.ref(`practiceAttempts/${uid}/${attemptId}`);
  let accountChecked = false;
  for (let step = 0; step < 22; step++) {
    const attempt = (await ref.get()).val() as StoredAttempt | null;
    if (
      !attempt ||
      !["PRACTICE", "TEST", "DAILY"].includes(normalizeMode(attempt.mode))
    ) {
      return null;
    }
    if (attempt.status === "completed" || attempt.status === "abandoned") {
      await finalizeAttemptLogic(uid, attemptId, attempt.status);
      return null;
    }
    // Midnight wins over catching up yesterday's unresolved daily questions.
    if (isDailyExpired(attempt)) {
      // Recheck expiry atomically: a stale read may miss a final answer that
      // already finished the daily before midnight. Explicit leave is separate.
      await finalizeAttemptLogic(uid, attemptId, "completed");
      return null;
    }
    if (!accountChecked) {
      const access = (await adminDb.ref(`accountAccess/${uid}`).get()).val();
      let disabled = access?.status !== "active";
      try {
        disabled ||= (await adminAuth.getUser(uid)).disabled;
      } catch (error) {
        if ((error as {code?: string}).code !== "auth/user-not-found") {
          throw error;
        }
        disabled = true;
      }
      if (disabled) {
        await finalizeAttemptLogic(uid, attemptId, "abandoned");
        return null;
      }
      accountChecked = true;
    }
    if (attempt.status === "waiting") {
      await finalizeAttemptLogic(uid, attemptId);
      return null;
    }
    const deadline = Number(attempt.deadlineAt);
    if (!Number.isFinite(deadline) || deadline <= 0) {
      throw new Error("invalid-attempt-deadline");
    }
    if (deadline > Date.now()) {
      await projectAttemptState(uid, attemptId, attempt);
      return deadline;
    }
    await advanceLearningAttempt(
      uid,
      attemptId,
      `background_${attempt.currentIndex}`,
      attempt.currentIndex,
      true,
    );
  }
  throw new Error("attempt-transition-limit");
}

/**
 * Retry due jobs; each job is leased and failures do not block other users.
 * @return {Promise<number>} Number of jobs claimed.
 */
export async function drainLearningWork(): Promise<number> {
  const due = await adminDb
    .ref("learningWork")
    .orderByChild("dueAt")
    .endAt(Date.now())
    .limitToFirst(25)
    .get();
  let processed = 0;
  const keys: string[] = [];
  // val() objects do not preserve orderByChild query order.
  due.forEach((child) => {
    keys.push(child.key!);
  });
  for (const key of keys) {
    const ref = adminDb.ref(`learningWork/${key}`);
    const owner = randomUUID();
    try {
      const claimed = await ref.transaction(
        (job) => {
          if (!job) return job;
          if (job.dueAt > Date.now() || job.leaseUntil > Date.now()) {
            return;
          }
          return {
            ...job,
            leaseOwner: owner,
            leaseUntil: Date.now() + LEASE_MS,
            dueAt: Date.now() + LEASE_MS,
            wakeAt: null,
          };
        },
        undefined,
        false,
      );
      if (!claimed.committed || !claimed.snapshot.exists()) continue;
      processed++;
      const job = claimed.snapshot.val();
      const next = await processAttempt(job.uid, job.attemptId);
      await ref.transaction(
        (current) => {
          if (!current) return current;
          if (current.leaseOwner !== owner) return;
          if (next === null) return null;
          const wakeAt = Number.isFinite(current.wakeAt) ?
            current.wakeAt :
            current.dueAt;
          return {
            uid: current.uid,
            attemptId: current.attemptId,
            dueAt:
              current.revision === job.revision ?
                next :
                Math.min(wakeAt, next),
            revision: current.revision,
          };
        },
        undefined,
        false,
      );
    } catch (error) {
      const code = String((error as {code?: string}).code || "worker-error");
      try {
        await ref.transaction(
          (current) => {
            if (!current) return current;
            if (current.leaseOwner !== owner) return;
            const retryCount = (Number(current.retryCount) || 0) + 1;
            return {
              ...current,
              leaseOwner: null,
              leaseUntil: null,
              wakeAt: null,
              retryCount,
              lastErrorCode: code,
              dueAt:
                Date.now() +
                Math.min(60000, 1000 * 2 ** Math.min(retryCount - 1, 6)),
            };
          },
          undefined,
          false,
        );
      } catch (retryError) {
        // Keep the durable job/lease. If retry-state storage is unavailable,
        // another pass can reclaim it after the lease expires.
        const retryCode = String(
          (retryError as {code?: string}).code || "retry-state-write-failed",
        );
        console.error("Learning retry state failed", {job: key, retryCode});
      }
      console.error("Learning maintenance retry", {job: key, code});
    }
  }
  return processed;
}

/**
 * Repair a daily slot left behind by interrupted attempt creation.
 * @param {string} uid Owner.
 * @param {string} date Date key in Asia/Ho_Chi_Minh.
 * @return {Promise<void>} Completion.
 */
export async function repairExpiredDailySlot(uid: string, date: string) {
  if (date >= getDateKey()) return;
  const ref = adminDb.ref(`userDailyChallenges/${uid}/${date}`);
  const slot = (await ref.get()).val();
  if (!slot || ["completed", "abandoned"].includes(slot.status)) return;
  if (slot.attemptId) {
    const attempt = (
      await adminDb.ref(`practiceAttempts/${uid}/${slot.attemptId}`).get()
    ).val();
    if (attempt) {
      await enqueueLearningWork(uid, slot.attemptId, Date.now(), true);
      return;
    }
  }
  await ref.transaction(
    (current) => {
      if (!current) return current;
      if (
        ["completed", "abandoned"].includes(current.status) ||
        current.attemptId !== slot.attemptId
      ) {
        return;
      }
      return {
        ...current,
        status: "abandoned",
        completedAt: Date.now(),
        completedQuestionCount: 0,
      };
    },
    undefined,
    false,
  );
}

interface DiscoveryCursor {
  uid?: string;
  afterUid?: string;
  afterItem?: string;
  phase?: "attempts" | "daily";
  owner?: string;
  leaseUntil?: number;
  nextRunAt?: number;
}

/**
 * Bounded, resumable discovery for legacy attempts and lost queue entries.
 * @return {Promise<void>} Completion.
 */
export async function discoverLearningWork(): Promise<void> {
  const ref = adminDb.ref("learningMaintenance/discovery");
  const owner = randomUUID();
  const claim = await ref.transaction(
    (current: DiscoveryCursor | null) => {
      if (
        (current?.leaseUntil || 0) > Date.now() ||
        (current?.nextRunAt || 0) > Date.now()
      ) {
        return;
      }
      return {...current, owner, leaseUntil: Date.now() + LEASE_MS};
    },
    undefined,
    false,
  );
  if (!claim.committed) return;
  let cursor = claim.snapshot.val() as DiscoveryCursor;
  let done = false;
  try {
    for (let page = 0; page < 8; page++) {
      if (!cursor.uid) {
        let query = adminDb.ref("accountAccess").orderByKey();
        if (cursor.afterUid) query = query.startAfter(cursor.afterUid);
        const users = await query.limitToFirst(1).get();
        const uid = Object.keys(users.val() || {})[0];
        if (!uid) {
          done = true;
          break;
        }
        cursor = {...cursor, uid, phase: "attempts", afterItem: undefined};
      }
      const root =
        cursor.phase === "daily" ? "userDailyChallenges" : "practiceAttempts";
      const uid = cursor.uid as string;
      let query = adminDb.ref(`${root}/${uid}`).orderByKey();
      if (cursor.afterItem) query = query.startAfter(cursor.afterItem);
      const items = Object.entries(
        (await query.limitToFirst(PAGE_SIZE).get()).val() || {},
      ) as Array<[string, StoredAttempt]>;
      for (const [id, attempt] of items) {
        try {
          if (cursor.phase === "daily") {
            await repairExpiredDailySlot(uid, id);
          } else if (
            ["PRACTICE", "TEST", "DAILY"].includes(
              normalizeMode(attempt?.mode),
            ) &&
            (attempt.settlementVersion !== 1 ||
              ["active", "waiting"].includes(attempt.status))
          ) {
            const due =
              attempt.status === "active" && !isDailyExpired(attempt) ?
                Number(attempt.deadlineAt) || Date.now() :
                Date.now();
            await enqueueLearningWork(uid, id, due, true);
          }
        } catch (error) {
          // Invalid legacy data gets its own retry job. Continue the cursor
          // rather than preventing every later user's work from being found.
          if (
            cursor.phase !== "daily" &&
            ["PRACTICE", "TEST", "DAILY"].includes(
              normalizeMode(attempt?.mode),
            )
          ) {
            await enqueueLearningWork(uid, id, Date.now(), true);
          }
          const code = String(
            (error as {code?: string}).code || "discovery-item-error",
          );
          console.error("Learning discovery item failed", {
            job: learningWorkKey(uid, id),
            code,
          });
        }
      }
      if (items.length === PAGE_SIZE) {
        cursor.afterItem = items[items.length - 1][0];
      } else if (cursor.phase !== "daily") {
        cursor.phase = "daily";
        delete cursor.afterItem;
      } else {
        cursor = {afterUid: cursor.uid};
      }
    }
    await ref.transaction(
      (current) => {
        if (!current) return current;
        if (current?.owner !== owner) return;
        return done ?
          {nextRunAt: Date.now() + 60000} :
          {
            ...(cursor.uid ? {uid: cursor.uid} : {}),
            ...(cursor.afterUid ? {afterUid: cursor.afterUid} : {}),
            ...(cursor.afterItem ? {afterItem: cursor.afterItem} : {}),
            phase: cursor.phase || "attempts",
            nextRunAt: Date.now() + 1000,
          };
      },
      undefined,
      false,
    );
  } catch (error) {
    await ref.transaction(
      (current) =>
        current?.owner === owner ?
          {
            ...current,
            owner: null,
            leaseUntil: null,
            nextRunAt: Date.now() + 10000,
          } :
          undefined,
      undefined,
      false,
    );
    throw error;
  }
}

/** Run shared maintenance from Cloud Scheduler or the private local runner. */
export async function runLearningMaintenance(): Promise<void> {
  try {
    await discoverLearningWork();
  } finally {
    // Ready work must still run when discovery/checkpoint storage fails.
    await drainLearningWork();
  }
}

export const maintainLearningAttempts = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Ho_Chi_Minh",
    region: "asia-southeast1",
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  runLearningMaintenance,
);
