import {WireQuestion} from "../practice/attemptHelper";

export const BATTLE_QUESTION_MS = 30000;
export const RECONNECT_MS = 30000;
export const DOUBLE_LEAVE_MS = 3000;
export const SEARCH_MS = 120000;

export type BattleOutcome = "win" | "loss" | "draw" | "left";
export interface BattleAnswer {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  timedOut: boolean;
  requestId: string;
  receivedAt: number;
}
export interface BattleSelection {
  optionId: string;
  selectedAt: number;
  requestId: string;
}
export interface BattlePlayer {
  name: string;
  clientSessionId: string;
  lastSeenAt: number;
  joinedAt?: number;
  leftAt?: number;
  answers?: Record<string, BattleAnswer>;
  selections?: Record<string, BattleSelection>;
}
export interface BattleKey {
  correctOptionId: string;
  explanation: string;
}
export interface BattleFinish {
  reason: string;
  outcomes: Record<string, BattleOutcome>;
  correct: Record<string, number>;
  answered: Record<string, number>;
  at: number;
}
export interface BattleMatch {
  id: string;
  kind: "quick";
  status: "ready" | "active" | "completed";
  players: Record<string, BattlePlayer>;
  questions: WireQuestion[];
  keys: Record<string, BattleKey>;
  currentIndex: number;
  createdAt: number;
  readyDeadlineAt: number;
  openedAt: number;
  deadlineAt: number;
  leaveDeadlineAt?: number;
  finish?: BattleFinish;
  events?: Record<string, {type: string; at: number; uid?: string}>;
  settlementVersion?: number;
}
export interface BattleTicket {
  id: string;
  uid: string;
  name: string;
  clientSessionId: string;
  status: "searching" | "matched" | "cancelled" | "expired";
  createdAt: number;
  expiresAt: number;
  publishedAt?: number;
  matchId?: string;
  opponentName?: string;
}
export interface BattleCoordinator {
  tickets?: Record<string, BattleTicket>;
  users?: Record<string, {ticketId: string; matchId?: string}>;
  allocations?: Record<string, BattleMatch>;
}
export interface WireTicket {
  id: string;
  status: string;
  opponentName: string;
  attemptId: string | null;
  roomCode: null;
}
