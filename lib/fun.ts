import type { Difficulty, QuestionDifficulty } from "./types";

/**
 * The game's personality in one place: headlines, stamps, titles, teacher's
 * comments, loading lines. Keep the tone warm and witty; tease the question,
 * never the player.
 */

/** Stable pick: the same seed always gives the same line (no flicker on re-render). */
export function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

export function randomPick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

// ── After an answer ─────────────────────────────────────────────────────────

export const RIGHT_HEADLINES = ["Correct!", "Nailed it!", "Spot on!", "Yes!", "Big brain!", "Bingo!"] as const;
export const WRONG_HEADLINES = ["Not quite", "Oof", "Nope", "Nice try", "Plot twist"] as const;

/** Rubber stamps that slam onto the question sheet for something special. */
export interface Callout {
  text: string;
  tone: "hl" | "good";
}

const STREAK_STAMPS: Record<number, string> = {
  3: "Hat trick",
  5: "On fire",
  8: "Unstoppable",
  12: "Legendary",
  16: "Untouchable",
};

/**
 * What to stamp on a right answer, if anything. Streak milestones win, then a
 * last-second answer, then a lightning-fast one, then bouncing back.
 */
export function calloutFor(opts: {
  streak: number;
  /** Seconds the player took. */
  elapsed: number;
  /** Seconds left on the clock (timed games only). */
  secondsLeft: number | null;
  /** Wrong answers in a row just before this one. */
  missesBefore: number;
  timerSeconds: number;
}): Callout | null {
  const { streak, elapsed, secondsLeft, missesBefore, timerSeconds } = opts;
  if (STREAK_STAMPS[streak]) return { text: STREAK_STAMPS[streak], tone: "hl" };
  if (secondsLeft !== null && secondsLeft <= 2) return { text: "Clutch!", tone: "good" };
  if (elapsed <= Math.max(2, timerSeconds * 0.2)) return { text: "Lightning", tone: "good" };
  if (missesBefore >= 2) return { text: "Comeback", tone: "good" };
  return null;
}

// ── Between questions ───────────────────────────────────────────────────────

export const GET_READY = ["get ready…", "deep breath…", "here comes a good one…", "no pressure…", "eyes on the paper…"] as const;

// ── Results ─────────────────────────────────────────────────────────────────

const titleCase = (s: string) => s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1));

/** "Space Professor", "Volcanoes Tourist": a title earned for this game. */
export function earnedTitle(pct: number, topic: string): string {
  const t = titleCase(topic.replace(/\s*\(demo\)$/i, "").trim() || "Trivia");
  if (pct === 100) return `${t} Professor`;
  if (pct >= 80) return `${t} Expert`;
  if (pct >= 60) return `${t} Enthusiast`;
  if (pct >= 40) return `${t} Apprentice`;
  if (pct > 0) return `${t} Tourist`;
  return `Lost in ${t}`;
}

const COMMENTS: Array<[min: number, lines: readonly string[]]> = [
  [100, ["Flawless. Are you secretly the quizmaster?", "Not a single mistake. Show-off.", "Full marks. Frame this one."]],
  [80, ["Excellent work. Gold star.", "Top of the class, very nearly.", "Sharp. Very sharp."]],
  [60, ["Solid work. A little revision and you're unstoppable.", "Good effort. The facts are sticking.", "Pass with merit."]],
  [40, ["Shows promise. Talks a lot in class.", "Halfway there, and the other half is fun facts.", "Some lucky guesses, some real knowledge. Hard to tell which."]],
  [1, ["We all start somewhere. Usually around here.", "Bold answers. Bold.", "See me after class. Bring snacks."]],
  [0, ["A clean sheet, in the wrong way.", "Impressively consistent.", "Every answer was a learning opportunity."]],
];

/** The teacher's red-pen comment at the bottom of the results paper. */
export function teacherComment(pct: number, seed: number): string {
  const lines = COMMENTS.find(([min]) => pct >= min)?.[1] ?? COMMENTS[COMMENTS.length - 1][1];
  return pick(lines, seed);
}

export type StampId = "perfect" | "streak" | "speed" | "clutch" | "comeback" | "spartan" | "no-skips";

export const STAMPS: Record<StampId, string> = {
  perfect: "Perfect paper",
  streak: "Hot streak",
  speed: "Speed demon",
  clutch: "Clutch",
  comeback: "Comeback kid",
  spartan: "Survived Spartan",
  "no-skips": "No skips",
};

/** Achievements earned in one solo game. */
export function earnedStamps(game: {
  correct: number;
  total: number;
  bestStreak: number;
  answered: number;
  /** Seconds taken for each right answer. */
  rightTimes: number[];
  timerSeconds: number;
  clutches: number;
  comebacks: number;
  questionDifficulty: QuestionDifficulty;
}): StampId[] {
  const pct = game.total ? game.correct / game.total : 0;
  const out: StampId[] = [];
  if (game.total >= 3 && pct === 1) out.push("perfect");
  if (game.bestStreak >= 5) out.push("streak");
  const avg = game.rightTimes.length ? game.rightTimes.reduce((a, b) => a + b, 0) / game.rightTimes.length : Infinity;
  const fast = game.timerSeconds > 0 ? avg <= game.timerSeconds * 0.35 : avg <= 4;
  if (fast && pct >= 0.6) out.push("speed");
  if (game.clutches > 0) out.push("clutch");
  if (game.comebacks > 0) out.push("comeback");
  if (game.questionDifficulty === "spartan" && pct >= 0.5) out.push("spartan");
  if (game.total >= 5 && game.answered === game.total && pct < 1) out.push("no-skips");
  return out;
}

/** "🟩🟩🟥⬜🟩": one square per question, for sharing. */
export function resultGrid(results: Array<"good" | "bad" | "skip">): string {
  return results.map((r) => (r === "good" ? "🟩" : r === "bad" ? "🟥" : "⬜")).join("");
}

// ── Setting up ──────────────────────────────────────────────────────────────

export const QDIFF_FLAVOR: Record<QuestionDifficulty, string> = {
  easy: "A warm-up. Pencils optional.",
  medium: "A proper quiz. Bring your A game.",
  hard: "For people who read the footnotes.",
  spartan: "This is Spartan. Good luck.",
};

export const TIMER_FLAVOR: Record<Difficulty, string> = {
  none: "No clock. Take all the time you need.",
  easy: "30 seconds. Plenty of time to overthink.",
  medium: "15 seconds. Think fast-ish.",
  hard: "8 seconds. Blink and it's gone.",
};

const QUIZ_ADJECTIVE: Record<QuestionDifficulty, string> = {
  easy: "Friendly",
  medium: "Great",
  hard: "Fiendish",
  spartan: "Brutal",
};

/** "The Fiendish Space Quiz" */
export function quizName(tags: string[], difficulty: QuestionDifficulty): string | null {
  if (tags.length === 0) return null;
  const [a, b] = tags.map((t) => titleCase(t));
  const subject = tags.length === 1 ? a : tags.length === 2 ? `${a} & ${b}` : `${a}, ${b} & More`;
  return `The ${QUIZ_ADJECTIVE[difficulty]} ${subject} Quiz`;
}

/** Topics for "Surprise me" and the topic of the day. */
export const FUN_TOPICS = [
  "Volcanoes", "Famous cats", "Pixar movies", "Ancient Rome", "Dinosaurs", "Space missions",
  "World flags", "Inventions", "Deep sea creatures", "Olympic history", "Board games", "Chocolate",
  "Pirates", "Bridges", "Video game history", "The human body", "Ancient Egypt", "Famous paintings",
  "Coffee", "Mythical creatures", "Rainforests", "Musical instruments", "Islands", "Cheese",
  "Superheroes", "The Beatles", "Sharks", "Castles", "Tea", "Robots", "Bees", "Greek myths",
  "Weather", "Bollywood", "Cricket", "Moons of the Solar System", "Spices", "Famous scientists",
] as const;

/** Same topic for everyone all day; changes at local midnight. */
export function topicOfTheDay(date = new Date()): string {
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
  return pick(FUN_TOPICS, day * 7 + 3);
}

// ── While Claude writes the questions ───────────────────────────────────────

export const LOADING_LINES = [
  "Sharpening pencils…",
  "Bribing the quizmaster…",
  "Hiding the answer key…",
  "Writing wrong answers that sound right…",
  "Fact-checking the fun facts…",
  "Making it tricky, but fair…",
  "Drawing the margins…",
] as const;

/** Things to read while you wait. Every one of these is true. */
export const WAITING_FACTS = [
  "Octopuses have three hearts.",
  "Botanically, bananas are berries and strawberries aren't.",
  "A day on Venus lasts longer than its year.",
  "Wombat poop is cube-shaped.",
  "There are more trees on Earth than stars in the Milky Way.",
  "Sharks have been around longer than trees.",
  "Oxford University is older than the Aztec Empire.",
  "A group of flamingos is called a flamboyance.",
  "The Eiffel Tower can grow about 15 cm taller in summer heat.",
  "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
  "Honey found in ancient Egyptian tombs was still edible.",
  "Sloths can hold their breath longer than dolphins.",
] as const;
