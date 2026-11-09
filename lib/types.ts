export interface User {
  id: number;
  email: string;
  username: string;
  created_at: string;
}

/**
 * How a question gets marked once it's answered, like a teacher scribbling in
 * the margin. Any field can be "" (older or partial data); the UI skips those.
 */
export interface Commentary {
  /** One sentence stating the right answer in context. */
  explanation: string;
  /** A related fact worth knowing. */
  fact: string;
  quip_right: string;
  quip_wrong: string;
  /** One note per option, in option order; "" for the right one. */
  option_notes: string[];
}

export interface Question extends Partial<Commentary> {
  id: number;
  question: string;
  options: string[];
  answer: number;
  category: string;
}

/**
 * A question as multiplayer clients see it while it's being played. The
 * server holds back `answer` and the commentary until the question closes so
 * nobody can read them out of devtools.
 */
export type RoomQuestion = Omit<Question, "answer"> & { answer?: number };

// ── Time difficulty (timer per question) ────────────────────────────────────
export type Difficulty = "none" | "easy" | "medium" | "hard";

// ── Question difficulty (how hard the AI makes the questions) ────────────────
export type QuestionDifficulty = "easy" | "medium" | "hard" | "spartan";

export const QUESTION_DIFFICULTY_CONFIG: Record<
  QuestionDifficulty,
  { label: string; description: string }
> = {
  easy:    { label: "Easy",    description: "Beginner friendly" },
  medium:  { label: "Medium",  description: "Some knowledge needed" },
  hard:    { label: "Hard",    description: "Expert level" },
  spartan: { label: "Spartan", description: "Brutal — world-class" },
};

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; seconds: number }
> = {
  none:   { label: "No Timer", seconds: 0 },
  easy:   { label: "Easy",     seconds: 30 },
  medium: { label: "Medium",   seconds: 15 },
  hard:   { label: "Hard",     seconds: 8 },
};

export const MULTI_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type GamePhase = "connecting" | "lobby" | "playing" | "results" | "error";

export interface AnswerRecord {
  selected: number; // -1 = timed out / skipped
  correct: boolean;
  /** Points this answer earned (solo only). */
  points?: number;
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

export interface LeaderboardEntry {
  username: string;
  score: number;
  correct_count: number;
  rank: number;
}

/** Who got each question right: question index → username → correct. */
export type AnswerBreakdown = Record<number, Record<string, boolean>>;

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
  /** Present while playing (answers withheld) and after the game (answers included). */
  questions?: RoomQuestion[];
  /** Milliseconds left on the current question, while playing. */
  time_left_ms?: number;
  /** This player's answer to the current question, if they already gave one. */
  my_current_answer?: { selected: number; is_correct: boolean; correct_index: number; reveal?: Commentary } | null;
  /** Set while the current question is closed and its marking is on screen. */
  closed_question?: { correct_index: number; reveal?: Commentary } | null;
  /** After the game: the final standings and per-question breakdown. */
  leaderboard?: LeaderboardEntry[];
  answers?: AnswerBreakdown;
  /** Secret that lets this browser reclaim its seat after a disconnect. */
  rejoin_token: string;
}

export interface WSPlayerAnswered {
  type: "player_answered";
  username: string;
  is_correct: boolean;
  new_score: number;
  correct_count: number;
  question_index: number;
}

/** Sent only to the player who answered, revealing the right option. */
export interface WSAnswerResult {
  type: "answer_result";
  question_index: number;
  selected: number;
  is_correct: boolean;
  correct_index: number;
  reveal?: Commentary;
}

/** The question stopped taking answers (everyone answered, or time ran out). */
export interface WSQuestionClosed {
  type: "question_closed";
  question_index: number;
  correct_index: number;
  reveal?: Commentary;
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
  questions: RoomQuestion[];
  timer_seconds: number;
  scores: PlayerScores;
  correct_counts: PlayerCounts;
}

/** The server closed question `question_index`; clients move to the next one. */
export interface WSNextQuestion {
  type: "next_question";
  question_index: number;
  correct_index: number;
}

export interface WSVoteDifficulty { type: "vote_difficulty"; username: string; seconds: number }

export interface WSHostChanged { type: "host_changed"; host_username: string }

export interface WSGameFinished {
  type: "game_finished";
  leaderboard: LeaderboardEntry[];
  total_questions: number;
  question_difficulty: QuestionDifficulty;
  tags: string[];
  questions: Question[];
  answers: AnswerBreakdown;
}

export interface WSNewGameReady {
  type: "new_game_ready";
  questions: RoomQuestion[];
  tags: string[];
  question_difficulty: QuestionDifficulty;
  timer_seconds: number;
}

export interface WSError {
  type: "error";
  message: string;
  /** Which request failed, e.g. "new_game". */
  context?: string;
}

export type WSMessage =
  | WSPlayerJoined
  | WSPlayerLeft
  | WSRoomState
  | WSPlayerAnswered
  | WSAnswerResult
  | WSQuestionClosed
  | WSPlayerSkipped
  | WSStartGame
  | WSNextQuestion
  | WSVoteDifficulty
  | WSHostChanged
  | WSGameFinished
  | WSNewGameReady
  | WSError;
