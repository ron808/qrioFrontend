import type { Difficulty, QuestionDifficulty } from "./types";

const STATS_KEY = "qrio_stats_v1";

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
    const raw = localStorage.getItem(STATS_KEY);
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
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
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
  easy:   1,
  medium: 1.5,
  hard:   2,
};

const TIMER_BONUS: Record<Difficulty, number> = {
  none:   0,
  easy:   2,
  medium: 4,
  hard:   8,
};

export function calcSoloScore(
  correct: number,
  qDiff: QuestionDifficulty = "medium",
  tDiff: Difficulty = "medium",
  speedBonus = 0,
): number {
  const base = correct * 10 * QDIFF_MULTIPLIER[qDiff];
  const timerKick = correct * TIMER_BONUS[tDiff];
  return Math.round(base + timerKick + speedBonus);
}

export function calcMultiplayerScore(correct: number, qDiff: QuestionDifficulty = "medium"): number {
  return Math.round(correct * 10 * QDIFF_MULTIPLIER[qDiff]);
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
  questionDifficulty?: QuestionDifficulty;
}) {
  const stats = getStats();
  const score = calcMultiplayerScore(params.correct, params.questionDifficulty ?? "medium");
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

export function topTopics(stats: Stats, n = 5): Array<[string, number]> {
  return Object.entries(stats.topicsPlayed)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n);
}

export function accuracy(stats: Stats): number {
  if (stats.totalQuestionsAnswered === 0) return 0;
  return Math.round((stats.totalCorrect / stats.totalQuestionsAnswered) * 100);
}
