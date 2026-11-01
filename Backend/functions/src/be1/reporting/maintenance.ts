import {randomUUID} from "node:crypto";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {adminDb} from "../../config/firebaseAdmin";
import {transactionWithRetry} from "../databaseTransaction";
import {projectHistoricalBattle, projectLearningActivity} from "./activity";
import {REPORTING_VERSION} from "./version";

export const backfillReporting = async (uid: string, pages = 1) => {
  const ref = adminDb.ref(`reportingBackfill/${uid}`);
  const owner = randomUUID();
  const tx = await transactionWithRetry(ref, (s) => {
    if ((s?.version === REPORTING_VERSION && s.ready) ||
        s?.leaseUntil > Date.now()) return;
    const previous = s?.version === REPORTING_VERSION ? s : {};
    return {...previous, version: REPORTING_VERSION,
      phase: previous.phase || "learning", owner,
      leaseUntil: Date.now() + 180000};
  });
  if (!tx.committed) {
    return tx.snapshot.val()?.ready === true &&
    tx.snapshot.val()?.version === REPORTING_VERSION;
  }
  let state = tx.snapshot.val();
  try {
    for (let page = 0; page < pages && !state.ready; page++) {
      const root = state.phase === "learning" ?
        "practiceAttempts" : "battleHistory";
      let query = adminDb.ref(`${root}/${uid}`).orderByKey();
      if (state.after) query = query.startAfter(state.after);
      const rows: Array<[string, Record<string, unknown>]> = [];
      (await query.limitToFirst(25).get()).forEach((child) => {
        rows.push([child.key!, child.val()]);
      });
      for (let i = 0; i < rows.length; i += 5) {
        await Promise.all(rows.slice(i, i + 5).map(([id, value]) =>
          state.phase === "learning" ?
            projectLearningActivity(uid, id, value) :
            projectHistoricalBattle(uid, id, value)));
      }
      const next = rows.length === 25 ?
        {...state, after: rows[rows.length - 1][0]} :
        state.phase === "learning" ?
          {...state, phase: "battle", after: null} :
          {ready: true, version: REPORTING_VERSION, completedAt: Date.now()};
      const checkpoint = await transactionWithRetry(ref, (current) => {
        if (!current) return current;
        if (current?.owner !== owner) return;
        return {...next, owner, leaseUntil: Date.now() + 180000};
      });
      if (!checkpoint.committed) return false;
      state = checkpoint.snapshot.val();
    }
    return state.ready === true;
  } finally {
    await transactionWithRetry(ref, (s) => {
      if (!s) return s;
      return s.owner === owner ?
        {...s, owner: null, leaseUntil: null} : undefined;
    });
  }
};

export const runReportingMaintenance = async () => {
  const ref = adminDb.ref("reportingMaintenance/discovery");
  const owner = randomUUID();
  const tx = await transactionWithRetry(ref, (s) => {
    if (s?.leaseUntil > Date.now() || s?.nextRunAt > Date.now()) return;
    return {...s, owner, leaseUntil: Date.now() + 180000};
  });
  if (!tx.committed) return;
  const state = tx.snapshot.val();
  try {
    let query = adminDb.ref("users").orderByKey();
    if (state.after) query = query.startAfter(state.after);
    const ids: string[] = [];
    (await query.limitToFirst(10).get()).forEach((child) => {
      ids.push(child.key!);
    });
    let pending = Boolean(state.pending);
    for (const uid of ids) {
      try {
        if (!await backfillReporting(uid)) pending = true;
      } catch {
        pending = true;
        console.error("Reporting backfill retry", {uid});
      }
    }
    const done = ids.length < 10;
    await transactionWithRetry(ref, (s) => {
      if (!s) return s;
      return s.owner === owner ?
        {after: done ? null : ids[ids.length - 1],
          pending: done ? false : pending,
          nextRunAt: Date.now() + (done && !pending ? 60000 : 0)} :
        undefined;
    });
  } catch (error) {
    await transactionWithRetry(ref, (s) => {
      if (!s) return s;
      return s.owner === owner ?
        {...s, owner: null, leaseUntil: null, nextRunAt: Date.now() + 1000} :
        undefined;
    });
    throw error;
  }
};

export const maintainReporting = onSchedule({schedule: "every 1 minutes",
  region: "asia-southeast1", timeZone: "Asia/Ho_Chi_Minh",
  timeoutSeconds: 540, maxInstances: 1}, runReportingMaintenance);
