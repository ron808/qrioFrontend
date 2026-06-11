export interface User {
  id: number;
  email: string;
  username: string;
  created_at: string;
}

export interface Question {
  id: number;
  question: string;
  options: string[];
  answer: number;
  category: string;
}

// ── Time difficulty (timer per question) ────────────────────────────────────
export type Difficulty = "none" | "easy" | "medium" | "hard";

// ── Question difficulty (how hard the AI makes the questions) ────────────────
export type QuestionDifficulty = "easy" | "medium" | "hard" | "spartan";

export const QUESTION_DIFFICULTY_CONFIG: Record<
  QuestionDifficulty,
  { label: string; description: string; activeClass: string }
> = {
  easy:    { label: "Easy",    description: "Beginner friendly",     activeClass: "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  medium:  { label: "Medium",  description: "Some knowledge needed", activeClass: "border-blue-600    bg-blue-50    text-blue-800    dark:bg-blue-950/40    dark:text-blue-300" },
  hard:    { label: "Hard",    description: "Expert level",          activeClass: "border-red-600     bg-red-50     text-red-800     dark:bg-red-950/40     dark:text-red-300" },
  spartan: { label: "Spartan", description: "Brutal — world-class",  activeClass: "border-purple-700  bg-purple-50  text-purple-800  dark:bg-purple-950/40  dark:text-purple-300" },
};

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; seconds: number; activeClass: string }
> = {
  none:   { label: "No Timer", seconds: 0,  activeClass: "border-[#1a1a1a] bg-[#1a1a1a] text-white" },
  easy:   { label: "Easy",     seconds: 30, activeClass: "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  medium: { label: "Medium",   seconds: 15, activeClass: "border-amber-600   bg-amber-50   text-amber-800   dark:bg-amber-950/40   dark:text-amber-300" },
  hard:   { label: "Hard",     seconds: 8,  activeClass: "border-red-600     bg-red-50     text-red-800     dark:bg-red-950/40     dark:text-red-300" },
};

export const MULTI_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type GamePhase = "connecting" | "lobby" | "playing" | "results" | "error";

export interface AnswerRecord {
  selected: number; // -1 = timed out / skipped
  correct: boolean;
}

export interface PlayerScores {
  [username: string]: number;
}

export interface PlayerCounts {
  [username: string]: number;
}

// ── WebSocket message shapes ────────────────────────────────────────────────

export interface WSPlayerJoined {
  type: "player_joined";
  username: string;
  player_count: number;
  is_rejoin?: boolean;
  score?: number;
  correct_count?: number;
}

export interface WSPlayerLeft { type: "player_left"; username: string; player_count: number }

/** Sent to a new joiner with the full list of already-connected players + votes (legacy) */
export interface WSPlayerList {
  type: "player_list";
  players: string[];
  votes: Record<string, number>;
}

/**
 * Authoritative room snapshot. Server sends this to every client when they
 * (re)connect. Contains everything the client needs to render the current
 * state — phase, players, scores, the rejoiner's own answered/skipped, host,
 * timer, etc.
 */
export interface WSRoomState {
  type: "room_state";
  phase: "lobby" | "playing" | "post_game";
  players: string[];
  votes: Record<string, number>;
  scores: PlayerScores;
  correct_counts: PlayerCounts;
  host_username: string;
  you_are_host: boolean;
  my_score: number;
  my_correct_count: number;
  my_answered: number[];
  my_skipped: number[];
  timer_seconds: number;
  current_question: number;
  question_difficulty: QuestionDifficulty;
  tags: string[];
  questions?: Question[]; // only when phase is "playing" or "post_game"
}

export interface WSPlayerAnswered {
  type: "player_answered";
  username: string;
  is_correct: boolean;
  new_score: number;
  correct_count: number;
  question_index: number;
}

export interface WSPlayerSkipped {
  type: "player_skipped";
  username: string;
  question_index: number;
  new_score: number;
  correct_count: number;
}

export interface WSStartGame {
  type: "start_game";
  questions: Question[];
  timer_seconds: number;
}

export interface WSNextQuestion {
  type: "next_question";
  question_index: number;
}

export interface WSVoteDifficulty { type: "vote_difficulty"; username: string; seconds: number }

export interface LeaderboardEntry {
  username: string;
  score: number;
  correct_count: number;
  rank: number;
}

export interface WSGameFinished {
  type: "game_finished";
  leaderboard: LeaderboardEntry[];
  total_questions: number;
  question_difficulty: QuestionDifficulty;
}

export interface WSNewGameReady {
  type: "new_game_ready";
  questions: Question[];
  tags: string[];
  question_difficulty: QuestionDifficulty;
  timer_seconds: number;
}

export type WSMessage =
  | WSPlayerJoined
  | WSPlayerLeft
  | WSPlayerList
  | WSRoomState
  | WSPlayerAnswered
  | WSPlayerSkipped
  | WSStartGame
  | WSNextQuestion
  | WSVoteDifficulty
  | WSGameFinished
  | WSNewGameReady
  | { type: string; [key: string]: unknown };
