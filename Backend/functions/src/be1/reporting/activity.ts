import {adminDb} from "../../config/firebaseAdmin";
import {transactionWithRetry} from "../databaseTransaction";
import {getDateKey} from "../practice/attemptHelper";
import {record} from "../practice/contentValidation";
import {HistoryEntry, historyEntry} from "./history";
import {battleStudyTiming, durationDays, studyDuration} from "./duration";
import {integer} from "../community/notifications";
import {REPORTING_VERSION} from "./version";

export const skillIds = ["vocabulary", "grammar", "listening", "reading"];
export interface Metric {
  sessions: number; answered: number; correct: number; durationMs: number;
  unknownDurationSessions: number;
  skills: Record<string, {answered: number; correct: number}>;
}
export const emptyMetric = (): Metric => ({sessions: 0, answered: 0,
  correct: 0, durationMs: 0, unknownDurationSessions: 0, skills: {}});

interface Activity {
  entry: HistoryEntry; answered: number; skills?: Metric["skills"];
  durationByDay?: Record<string, number>; version?: number;
  previous?: Activity;
}
const activityDays = (activity: Activity) => {
  const days = {...activity.durationByDay};
  if (!Object.keys(days).length && activity.entry.durationMs != null) {
    days[getDateKey(activity.entry.completedAt)] = activity.entry.durationMs;
  }
  return days;
};
const previousProjection = (activity: Activity, marker: unknown) => {
  const version = marker === true ? 1 : integer(marker);
  let previous = activity;
  while (previous.previous && (previous.version || 1) > version) {
    previous = previous.previous;
  }
  return previous;
};
const projectionDates = (activity: Activity) => {
  const dates = new Set<string>();
  let previous: Activity | undefined = activity;
  while (previous) {
    dates.add(getDateKey(previous.entry.completedAt));
    for (const date of Object.keys(activityDays(previous))) dates.add(date);
    previous = previous.previous;
  }
  return dates;
};
export const isStudyDayActive = (value: unknown) =>
  value === true || record(value).active === true;
const applyMetric = (day: Metric, activity: Activity,
  date: string, sign: number) => {
  const entry = activity.entry;
  const completedDate = getDateKey(entry.completedAt);
  if (entry.outcome !== "abandoned" && date === completedDate) {
    day.sessions += sign;
    day.answered += sign * integer(activity.answered);
    day.correct += sign * Math.min(entry.correct, integer(activity.answered));
    for (const [skill, counts] of Object.entries(activity.skills || {})) {
      day.skills[skill] ||= {answered: 0, correct: 0};
      day.skills[skill].answered += sign * counts.answered;
      day.skills[skill].correct += sign * counts.correct;
    }
  }
  if (entry.durationMs == null && date === completedDate) {
    day.unknownDurationSessions += sign;
  } else day.durationMs += sign * (activityDays(activity)[date] || 0);
};

export const projectActivity = async (
  uid: string, entry: HistoryEntry, answered: number,
  skills: Metric["skills"], durationByDay?: Record<string, number> | null,
) => {
  const kind = entry.mode === "BATTLE" ? "battle" : "learning";
  const id = `${kind}_${entry.attemptId}`;
  const tx = await transactionWithRetry(
    adminDb.ref(`studyActivities/${uid}/${id}`),
    (s) => s?.version === REPORTING_VERSION ? s :
      {entry, answered, skills, version: REPORTING_VERSION,
        durationByDay: durationByDay ??
          (entry.durationMs !== null &&
            s?.entry?.durationMs === entry.durationMs ?
            s.durationByDay || {} : {}),
        ...(s ? {previous: s} : {})},
  );
  const frozen = tx.snapshot.val() as Activity;
  const summary = frozen.entry as HistoryEntry;
  summary.durationMs ??= null;
  for (const date of projectionDates(frozen)) {
    const dayTx = await transactionWithRetry(
      adminDb.ref(`userActivityDaily/${uid}/${date}`),
      (day) => {
        day ||= {...emptyMetric(), appliedEvents: {}};
        day.appliedEvents ||= {};
        if (day.appliedEvents[id] === REPORTING_VERSION) {
          return day;
        }
        day.skills ||= {};
        if (day.appliedEvents[id]) {
          applyMetric(day, previousProjection(frozen,
            day.appliedEvents[id]), date, -1);
        }
        applyMetric(day, frozen, date, 1);
        day.appliedEvents[id] = REPORTING_VERSION;
        day.projectionRevision = integer(day.projectionRevision) + 1;
        return day;
      });
    const day = dayTx.snapshot.val();
    const revision = integer(day?.projectionRevision);
    const active = integer(day?.durationMs) > 0 || integer(day?.answered) > 0;
    await transactionWithRetry(
      adminDb.ref(`studyActiveDays/${uid}/${date}`), (current) =>
        integer(record(current).revision) > revision ? current :
          {active, revision});
  }
  return summary;
};

export const projectLearningActivity = async (
  uid: string, id: string, attempt: Record<string, unknown>,
) => {
  const entry = historyEntry(id, attempt, "learning");
  if (!entry) return;
  const [questions, legacyAnswers] = await Promise.all([
    adminDb.ref(`attemptQuestions/${uid}/${id}`).get(),
    adminDb.ref(`attemptAnswers/${uid}/${id}`).get(),
  ]);
  const qs = questions.val() || {};
  const answers = Object.fromEntries(Object.entries(
    attempt.answers || legacyAnswers.val() || {},
  ).filter(([, value]) => value !== null));
  const savedTimings = Object.fromEntries(Object.entries(
    attempt.questionTimings || {},
  ).filter(([, value]) => value !== null));
  const timings = {...qs, ...savedTimings};
  entry.durationMs = studyDuration(attempt, answers, timings,
    entry.completedAt);
  const skills: Metric["skills"] = {};
  for (const [index, raw] of Object.entries(record(answers))) {
    const skill = qs[index]?.categoryId;
    if (!skillIds.includes(skill)) continue;
    const counts = (skills[skill] ||= {answered: 0, correct: 0});
    counts.answered++;
    if (record(raw).isCorrect === true) counts.correct++;
  }
  const categories = new Set(Object.values(qs).map((q) =>
    record(q).categoryId).filter((id) => skillIds.includes(String(id))));
  if (entry.mode === "PRACTICE" && entry.outcome === "completed" &&
      Object.keys(qs).length === entry.total && categories.size === 1) {
    const skill = String([...categories][0]);
    skills[skill] = {answered: entry.total, correct: entry.correct};
  }
  const answered = entry.outcome === "completed" ? entry.total :
    Object.keys(answers).length;
  const frozen = await projectActivity(uid, entry, answered, skills,
    durationDays(attempt, answers, timings, entry.completedAt));
  await adminDb.ref(`practiceAttempts/${uid}/${id}`).update({
    durationMs: frozen.durationMs,
  });
  return frozen.durationMs;
};

export const projectHistoricalBattle = async (
  uid: string, id: string, history: unknown,
) => {
  const entry = historyEntry(id, history, "battle");
  if (!entry) return;
  const match = (await adminDb.ref(`battleRooms/${id}`).get()).val();
  const player = match?.players?.[uid];
  const answers = player?.answers || {};
  const skills: Metric["skills"] = {};
  for (const [index, answer] of Object.entries(answers)) {
    const skill = match.questions?.[index]?.categoryId;
    if (!skillIds.includes(skill)) continue;
    const counts = (skills[skill] ||= {answered: 0, correct: 0});
    counts.answered++;
    if (record(answer).isCorrect === true) counts.correct++;
  }
  const answered = player ? Object.keys(answers).length : entry.total;
  const timing = match && player ? battleStudyTiming(match, uid) : null;
  if (timing?.durationMs != null) entry.durationMs = timing.durationMs;
  const activity = await projectActivity(uid, entry, answered, skills,
    timing?.durationByDay);
  if (entry.durationMs !== activity.durationMs ||
      record(history).durationMs !== activity.durationMs) {
    await adminDb.ref(`battleHistory/${uid}/${id}`).update({
      durationMs: activity.durationMs,
    });
  }
};

export const studyStreak = async (uid: string, today: string) => {
  const previous = (date: string) => new Date(
    Date.parse(`${date}T00:00:00Z`) - 86400000,
  ).toISOString().slice(0, 10);
  let expected = today;
  let streak = 0;
  let before: string | null = null;
  for (;;) {
    let query = adminDb.ref(`studyActiveDays/${uid}`).orderByKey();
    query = before ? query.endBefore(before) : query.endAt(today);
    const values: Array<{date: string; active: boolean}> = [];
    (await query.limitToLast(32).get()).forEach((child) => {
      values.push({date: child.key!, active: isStudyDayActive(child.val())});
    });
    values.reverse();
    for (const {date, active} of values) {
      if (!streak && date === today && !active) {
        expected = previous(today);
        continue;
      }
      if (!streak && expected === today && date === previous(today)) {
        expected = date;
      }
      if (date !== expected) return streak;
      if (!active) return streak;
      streak++;
      expected = previous(expected);
    }
    if (values.length < 32) return streak;
    before = values[values.length - 1].date;
  }
};
