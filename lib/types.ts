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
export type QuestionDifficulty = "easy" | "medium" | "hard";

export const QUESTION_DIFFICULTY_CONFIG: Record<
  QuestionDifficulty,
  { label: string; description: string; activeClass: string }
> = {
  easy:   { label: "Easy",   description: "Beginner friendly",    activeClass: "border-emerald-600 bg-emerald-50 text-emerald-800" },
  medium: { label: "Medium", description: "Some knowledge needed", activeClass: "border-blue-600 bg-blue-50 text-blue-800" },
  hard:   { label: "Hard",   description: "Expert level",         activeClass: "border-red-600 bg-red-50 text-red-800" },
};

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; seconds: number; activeClass: string }
> = {
  none:   { label: "No Timer", seconds: 0,  activeClass: "border-[#1a1a1a] bg-[#1a1a1a] text-white" },
  easy:   { label: "Easy",     seconds: 30, activeClass: "border-emerald-600 bg-emerald-50 text-emerald-800" },
  medium: { label: "Medium",   seconds: 15, activeClass: "border-amber-600 bg-amber-50 text-amber-800" },
  hard:   { label: "Hard",     seconds: 8,  activeClass: "border-red-600 bg-red-50 text-red-800" },
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

// ── WebSocket message shapes ────────────────────────────────────────────────

export interface WSPlayerJoined  { type: "player_joined";  username: string; player_count: number }
export interface WSPlayerLeft    { type: "player_left";    username: string; player_count: number }

/** Sent to a new joiner with the full list of already-connected players + votes */
export interface WSPlayerList {
  type: "player_list";
  players: string[];
  votes: Record<string, number>; // username → voted seconds
}

export interface WSPlayerAnswered {
  type: "player_answered";
  username: string;
  is_correct: boolean;
  new_score: number;
  question_index: number;
}

/** Broadcast when a player skips a question */
export interface WSPlayerSkipped {
  type: "player_skipped";
  username: string;
  question_index: number;
}

export interface WSStartGame {
  type: "start_game";
  questions: Question[];
  timer_seconds: number;
}

/** Server broadcasts this when all players have responded (answered or skipped) */
export interface WSNextQuestion {
  type: "next_question";
  question_index: number;
}

export interface WSVoteDifficulty { type: "vote_difficulty"; username: string; seconds: number }

export type WSMessage =
  | WSPlayerJoined
  | WSPlayerLeft
  | WSPlayerList
  | WSPlayerAnswered
  | WSPlayerSkipped
  | WSStartGame
  | WSNextQuestion
  | WSVoteDifficulty
  | { type: string; [key: string]: unknown };
