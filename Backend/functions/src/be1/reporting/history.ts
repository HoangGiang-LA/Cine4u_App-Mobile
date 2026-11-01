import {adminDb} from "../../config/firebaseAdmin";
import {record} from "../practice/contentValidation";
import {integer} from "../community/notifications";
import {normalizeMode} from "../practice/attemptHelper";

export interface HistoryEntry {
  attemptId: string; mode: string; correct: number; total: number;
  coins: number; ratingDelta: number; outcome: string;
  completedAt: number; reviews: []; opponentName: string;
  opponentCorrect: number; durationMs: number | null;
}
export const historyEntry = (
  id: string, value: unknown, kind: string,
): HistoryEntry | null => {
  const v = record(value);
  const battle = kind === "battle";
  const mode = battle ? "BATTLE" : normalizeMode(v.mode);
  const outcome = battle ? v.outcome :
    v.status === "expired" ? "abandoned" : v.status;
  const total = integer(battle ? v.total : v.questionCount);
  const correct = integer(battle ? v.correct : v.correctCount);
  const completedAt = integer(v.finishedAt ?? v.completedAt);
  if (!total || correct > total || !completedAt ||
      !(battle ? ["win", "loss", "draw", "left"].includes(String(outcome)) :
        ["PRACTICE", "TEST", "DAILY"].includes(mode) &&
        ["completed", "abandoned"].includes(String(outcome)))) return null;
  return {attemptId: id, mode, correct, total, outcome: String(outcome),
    coins: integer(battle ? v.coins : v.coinsAwarded), completedAt,
    ratingDelta: typeof v.ratingDelta === "number" &&
      Number.isSafeInteger(v.ratingDelta) ? v.ratingDelta : 0,
    opponentName: typeof v.opponentName === "string" ? v.opponentName : "",
    opponentCorrect: integer(v.opponentCorrect), reviews: [],
    durationMs: typeof v.durationMs === "number" &&
      Number.isSafeInteger(v.durationMs) && v.durationMs >= 0 ?
      v.durationMs : null};
};

export interface Boundary {time: number; key?: string}
export const readFeed = async <T>(
  path: string, field: string, size: number,
  parse: (id: string, value: unknown) => T | null,
  boundary: Boundary = {time: Date.now()},
) => {
  let {time, key} = boundary;
  const entries: T[] = [];
  const positions: Boundary[] = [];
  const batchSize = size * 2 + 1;
  let more = false;
  for (let scan = 0; scan < 4 && entries.length <= size; scan++) {
    const page = await adminDb.ref(path).orderByChild(field).startAt(1)
      .endAt(time, key).limitToLast(batchSize).get();
    const rows: Array<{id: string; value: Record<string, unknown>}> = [];
    page.forEach((child) => {
      if (child.key !== key || child.val()[field] !== time) {
        rows.push({id: child.key!, value: child.val()});
      }
    });
    rows.reverse();
    more = rows.length >= batchSize - (key ? 1 : 0);
    for (const row of rows) {
      time = row.value[field] as number;
      key = row.id;
      const entry = parse(row.id, row.value);
      if (entry) {
        entries.push(entry);
        positions.push({time, key});
      }
      if (entries.length > size) break;
    }
    if (!more || entries.length > size) break;
  }
  if (entries.length > size) {
    more = true;
    ({time, key} = positions[size - 1]);
  }
  return {entries: entries.slice(0, size), more, boundary: {time, key}};
};
