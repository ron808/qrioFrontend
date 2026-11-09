import { getUser } from "./auth";
import type { Difficulty, QuestionDifficulty } from "./types";

// Stats live in this browser only, one bucket per account plus one for guests,
// so two accounts on the same machine never see each other's history.
const LEGACY_STATS_KEY = "qrio_stats_v1";
const GUEST_STATS_KEY = "qrio_stats_v1:guest";

function userStatsKey(userId: number): string {
  return `qrio_stats_v1:u:${userId}`;
}

function statsKey(): string {
  const user = getUser();
  if (!user) return GUEST_STATS_KEY;
  const key = userStatsKey(user.id);
  // One-time migration from the old shared bucket: hand it to the first
  // account that loads stats on this browser.
  try {
    if (localStorage.getItem(key) === null) {
      const legacy = localStorage.getItem(LEGACY_STATS_KEY);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_STATS_KEY);
      }
    }
  } catch { /* storage unavailable */ }
  return key;
}

export interface GameRecord {
  type: "solo" | "multiplayer";
  date: string;
  topics: string[];
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  questionDifficulty?: QuestionDifficulty;
  timerDifficulty?: Difficulty;
  rank?: number;
  totalPlayers?: number;
}

export interface Stats {
  soloGames: number;
  multiplayerGames: number;
  multiplayerWins: number;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  totalScore: number;
  bestScore: number;
  longestStreak: number;
  topicsPlayed: Record<string, number>;
  recentGames: GameRecord[]; // capped at 30
}

function empty(): Stats {
  return {
    soloGames: 0,
    multiplayerGames: 0,
    multiplayerWins: 0,
    totalQuestionsAnswered: 0,
    totalCorrect: 0,
    totalScore: 0,
    bestScore: 0,
    longestStreak: 0,
    topicsPlayed: {},
    recentGames: [],
  };
}

export function getStats(): Stats {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(statsKey());
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Stats>;
    // Forward-compat: fill any missing keys with defaults so older saves still work.
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

function save(stats: Stats) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(statsKey(), JSON.stringify(stats));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

function addTopics(stats: Stats, topics: string[]) {
  for (const t of topics) {
    stats.topicsPlayed[t] = (stats.topicsPlayed[t] ?? 0) + 1;
  }
}

// ── Score formula ────────────────────────────────────────────────────────────
// Base 10 pts per correct answer. Multiplied by question-difficulty
// (Easy 1×, Medium 1.5×, Hard 2×). For solo only, an optional time bonus is
// added per correct answer scaled by how fast the player answered.
const QDIFF_MULTIPLIER: Record<QuestionDifficulty, number> = {
  easy:    1,
  medium:  1.5,
  hard:    2,
  spartan: 3,
};

export function qDiffMultiplier(d: QuestionDifficulty): number {
  return QDIFF_MULTIPLIER[d] ?? 1;
}

const TIMER_BONUS: Record<Difficulty, number> = {
  none:   0,
  easy:   2,
  medium: 4,
  hard:   8,
};

/** Points for one correct solo answer, before that answer's speed bonus. */
export function soloPointsPerCorrect(qDiff: QuestionDifficulty, tDiff: Difficulty): number {
  return 10 * qDiffMultiplier(qDiff) + TIMER_BONUS[tDiff];
}

export function calcSoloScore(
  correct: number,
  qDiff: QuestionDifficulty = "medium",
  tDiff: Difficulty = "medium",
  speedBonus = 0,
): number {
  return Math.round(correct * soloPointsPerCorrect(qDiff, tDiff) + speedBonus);
}

export function saveSoloGame(params: {
  topics: string[];
  correct: number;
  total: number;
  questionDifficulty?: QuestionDifficulty;
  timerDifficulty?: Difficulty;
  longestStreak?: number;
  speedBonus?: number;
}) {
  const stats = getStats();
  const score = calcSoloScore(
    params.correct,
    params.questionDifficulty ?? "medium",
    params.timerDifficulty ?? "medium",
    params.speedBonus ?? 0,
  );
  stats.soloGames += 1;
  stats.totalQuestionsAnswered += params.total;
  stats.totalCorrect += params.correct;
  stats.totalScore += score;
  if (score > stats.bestScore) stats.bestScore = score;
  if ((params.longestStreak ?? 0) > stats.longestStreak) stats.longestStreak = params.longestStreak ?? 0;
  addTopics(stats, params.topics);
  stats.recentGames.unshift({
    type: "solo",
    date: new Date().toISOString(),
    topics: params.topics,
    score,
    totalQuestions: params.total,
    correctAnswers: params.correct,
    questionDifficulty: params.questionDifficulty,
    timerDifficulty: params.timerDifficulty,
  });
  stats.recentGames = stats.recentGames.slice(0, 30);
  save(stats);
  return score;
}

export function saveMultiplayerGame(params: {
  topics: string[];
  correct: number;
  total: number;
  rank: number;
  totalPlayers: number;
  /** The server's score for this player, so stats match the leaderboard. */
  score: number;
  questionDifficulty?: QuestionDifficulty;
}) {
  const stats = getStats();
  const score = params.score;
  stats.multiplayerGames += 1;
  stats.totalQuestionsAnswered += params.total;
  stats.totalCorrect += params.correct;
  stats.totalScore += score;
  if (score > stats.bestScore) stats.bestScore = score;
  if (params.rank === 1) stats.multiplayerWins += 1;
  addTopics(stats, params.topics);
  stats.recentGames.unshift({
    type: "multiplayer",
    date: new Date().toISOString(),
    topics: params.topics,
    score,
    totalQuestions: params.total,
    correctAnswers: params.correct,
    questionDifficulty: params.questionDifficulty,
    rank: params.rank,
    totalPlayers: params.totalPlayers,
  });
  stats.recentGames = stats.recentGames.slice(0, 30);
  save(stats);
  return score;
}

/** Move this browser's guest stats onto a newly registered account. */
export function adoptGuestStats(userId: number) {
  if (typeof window === "undefined") return;
  try {
    const guest = localStorage.getItem(GUEST_STATS_KEY);
    if (guest === null) return;
    const key = userStatsKey(userId);
    if (localStorage.getItem(key) === null) localStorage.setItem(key, guest);
    localStorage.removeItem(GUEST_STATS_KEY);
  } catch { /* storage unavailable */ }
}

export function topTopics(stats: Stats, n = 5): Array<[string, number]> {
  return Object.entries(stats.topicsPlayed)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n);
}

export function accuracy(stats: Stats): number {
  if (stats.totalQuestionsAnswered === 0) return 0;
  return Math.round((stats.totalCorrect / stats.totalQuestionsAnswered) * 100);
}
