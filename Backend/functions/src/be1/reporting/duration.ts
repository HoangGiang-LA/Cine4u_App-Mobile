import {record} from "../practice/contentValidation";
import {getDateKey} from "../practice/attemptHelper";
import type {BattleMatch} from "../battle/battleTypes";

const timestamp = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

// Only trusted, persisted question windows count. Legacy records without
// enough timing information stay unknown instead of becoming invented minutes.
export const studyIntervals = (
  source: Record<string, unknown>,
  answersValue: unknown,
  timingsValue: unknown,
  endAt: number,
): Array<{from: number; to: number}> | null => {
  if (!timestamp(endAt)) return null;
  const answers = Object.fromEntries(Object.entries(
    Array.isArray(answersValue) ? {...answersValue} : record(answersValue),
  ).filter(([, value]) => value !== null));
  const timings: Record<string, unknown> = Array.isArray(timingsValue) ?
    Object.fromEntries(Object.entries(timingsValue)) : record(timingsValue);
  if (source.status === "completed" &&
      typeof source.questionCount === "number" &&
      Object.keys(answers).length !== source.questionCount) return null;
  const intervals: Array<{from: number; to: number}> = [];
  for (const [index, raw] of Object.entries(answers)) {
    const answer = record(raw);
    const timing = record(timings[index]);
    if (!timestamp(timing.openedAt) || !timestamp(timing.deadlineAt) ||
        !timestamp(answer.receivedAt) || timing.deadlineAt < timing.openedAt ||
        answer.receivedAt < timing.openedAt) return null;
    intervals.push({from: timing.openedAt,
      to: Math.min(timing.openedAt + 30000, timing.deadlineAt,
        answer.receivedAt)});
  }
  const index = String(source.currentIndex ?? 0);
  if (!answers[index]) {
    const timing = record(timings[index]);
    if (timestamp(timing.openedAt) && timestamp(timing.deadlineAt)) {
      if (timing.deadlineAt < timing.openedAt) return null;
      intervals.push({from: timing.openedAt,
        to: Math.max(timing.openedAt, Math.min(timing.openedAt + 30000,
          timing.deadlineAt, endAt))});
    } else if (source.status !== "ready") return null;
  }
  if (!Object.keys(answers).length && !Object.keys(timings).length &&
      source.status !== "ready") return null;
  return intervals;
};

export const studyDuration = (
  source: Record<string, unknown>, answers: unknown, timings: unknown,
  endAt: number,
) => studyIntervals(source, answers, timings, endAt)?.reduce(
  (sum, interval) => sum + interval.to - interval.from, 0,
) ?? null;

export const durationDays = (
  source: Record<string, unknown>, answers: unknown, timings: unknown,
  endAt: number,
) => {
  const intervals = studyIntervals(source, answers, timings, endAt);
  if (!intervals) return null;
  const days: Record<string, number> = {};
  for (const interval of intervals) {
    for (let from = interval.from; from < interval.to;) {
      const date = getDateKey(from);
      const to = Math.min(interval.to,
        Date.parse(`${date}T00:00:00+07:00`) + 86400000);
      days[date] = (days[date] || 0) + to - from;
      from = to;
    }
  }
  return days;
};

export const battleStudyTiming = (match: BattleMatch, uid: string) => {
  const player = match.players[uid];
  if (!player || !match.finish) {
    return {durationMs: null, durationByDay: null};
  }
  const source = {...match,
    status: match.openedAt ? match.status : "ready"};
  const endAt = Math.min(match.finish.at,
    player.leftAt || match.finish.at, player.lastSeenAt + 30000);
  return {
    durationMs: studyDuration(source, player.answers,
      match.questionTimings, endAt),
    durationByDay: durationDays(source, player.answers,
      match.questionTimings, endAt),
  };
};
