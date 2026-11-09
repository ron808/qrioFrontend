"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { hasUser, getHomePath, isLoggedIn, incrementGuestGamesPlayed, guestMustRegister } from "@/lib/auth";
import { getStats, saveSoloGame, calcSoloScore, soloPointsPerCorrect, type GameRecord } from "@/lib/stats";
import { EASE, fadeUp, stagger } from "@/lib/motion";
import {
  LOADING_LINES, QDIFF_FLAVOR, RIGHT_HEADLINES, STAMPS, TIMER_FLAVOR, WAITING_FACTS, WRONG_HEADLINES,
  calloutFor, earnedStamps, earnedTitle, pick, quizName, randomPick, resultGrid, teacherComment,
  type Callout,
} from "@/lib/fun";
import { buzz, play } from "@/lib/sound";
import { pulseDots, pulseFrom } from "@/lib/pulse";
import PageShell from "../components/PageShell";
import Notice from "../components/Notice";
import Confetti from "../components/Confetti";
import ShareDialog from "../components/ShareDialog";
import { MarkerLoop, Scribble } from "../components/Marks";
import {
  FeedbackBar, OptionButton, ProgressTicks, QuestionSheet, QuestionTransition, SoundToggle, Stamp, TimerRing,
  STAMP_DELAY, TRANSITION_MS, useKeepAboveFeedback, type OptionState, type TickState,
} from "../components/GameUI";
import {
  ChoiceGrid, CountSlider, TopicInput, QUESTION_DIFFICULTY_CHOICES, TIMER_CHOICES,
} from "../components/QuizSettings";
import {
  ArrowRight, Check, ChevronDown, Flame, Home, Lightbulb, RotateCcw, Share2, SkipForward, Trophy, X,
} from "lucide-react";
import {
  DIFFICULTY_CONFIG,
  QUESTION_DIFFICULTY_CONFIG,
  type AnswerRecord,
  type Difficulty,
  type Question,
  type QuestionDifficulty,
} from "@/lib/types";

type Phase = "setup" | "generating" | "playing" | "results";

/** Bits of a game that only matter for stamps and callouts. */
interface Extras {
  rightTimes: number[];
  clutches: number;
  comebacks: number;
}

const NO_EXTRAS: Extras = { rightTimes: [], clutches: 0, comebacks: 0 };

/** "Writing your questions": lines appear on a notebook page, one by one. */
function WritingSheet() {
  const widths = ["86%", "70%", "92%", "58%"];
  return (
    <div className="relative w-full sketch-card notebook h-40 [--rule-h:2rem] overflow-clip" aria-hidden="true">
      {widths.map((w, i) => (
        <motion.span
          key={i}
          className="absolute left-12 h-2 rounded-full origin-left"
          style={{ top: `${1.25 + i * 2}rem`, width: `calc(${w} - 4rem)`, background: "var(--ink-soft)" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 1, 1, 0] }}
          transition={{ duration: 3.2, times: [0, 0.3, 0.85, 1], delay: i * 0.45, repeat: Infinity, repeatDelay: 0.4, ease: EASE }}
        />
      ))}
    </div>
  );
}

/** While Claude writes the questions: rotating silly status lines and a fact to read. */
function GeneratingScreen({ tags, count, questionDifficulty }: {
  tags: string[];
  count: number;
  questionDifficulty: QuestionDifficulty;
}) {
  const [tick, setTick] = useState(0);
  const [fact] = useState(() => randomPick(WAITING_FACTS));
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2200);
    return () => window.clearInterval(id);
  }, []);
  // Every other line is about one of their topics.
  const line = tick % 2 === 1 && tags.length
    ? `Reading up on ${tags[Math.floor(tick / 2) % tags.length]}…`
    : LOADING_LINES[Math.floor(tick / 2) % LOADING_LINES.length];

  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="w-full max-w-md text-center"
        role="status"
      >
        <WritingSheet />
        <h2 className="mt-8 font-heading text-3xl text-ink">Writing your questions…</h2>
        <div className="h-16 mt-1">
          <AnimatePresence mode="wait">
            <motion.p
              key={tick}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="font-hand text-2xl leading-8 text-ink-muted text-balance"
            >
              {line}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="text-base font-semibold text-ink-soft">
          {count} {QUESTION_DIFFICULTY_CONFIG[questionDifficulty].label.toLowerCase()} questions on
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full border-2 border-ink bg-hl px-3 py-0.5 text-sm font-extrabold text-hl-ink">{t}</span>
          ))}
        </div>
        <div className="mt-10 sketch-card p-4 sm:p-5 text-left -rotate-1">
          <p className="field-label"><Lightbulb size={16} /> While you wait</p>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink-soft">{fact}</p>
        </div>
      </motion.div>
    </div>
  );
}

/** Desktop: a live preview of the quiz you're setting up, with the start button. */
function QuizTicket({
  tags, count, questionDifficulty, difficulty, maxPoints, best, error, onStart,
}: {
  tags: string[];
  count: number;
  questionDifficulty: QuestionDifficulty;
  difficulty: Difficulty;
  maxPoints: number;
  best: number | null;
  error: string;
  onStart: () => void;
}) {
  const name = quizName(tags, questionDifficulty);
  const seconds = DIFFICULTY_CONFIG[difficulty].seconds;
  return (
    <div className="sketch-card overflow-clip">
      <div className="px-6 pt-6 pb-5 border-b-2 border-dashed border-line-soft">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Your quiz</p>
        <h2 className={`mt-2 font-heading text-[28px] leading-[1.05] text-balance ${name ? "text-ink" : "text-ink-ghost"}`}>
          {name ?? "Untitled quiz"}
        </h2>
        {!name && <p className="mt-1 font-hand text-xl text-ink-muted">add a topic to give it a name</p>}
      </div>
      <div className="px-6 py-5 space-y-5">
        <div>
          <p className="text-sm font-extrabold text-ink">
            {count} questions · {QUESTION_DIFFICULTY_CONFIG[questionDifficulty].label} · {seconds ? `${seconds}s each` : "no timer"}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-hidden="true">
            <AnimatePresence initial={false}>
              {Array.from({ length: count }, (_, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="w-5 h-5 rounded-md border-2 border-ink bg-card"
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
        <ul className="space-y-1 font-hand text-[22px] leading-tight text-ink-soft">
          <li>{QDIFF_FLAVOR[questionDifficulty]}</li>
          <li>{TIMER_FLAVOR[difficulty]}</li>
        </ul>
        <dl className="grid grid-cols-2 gap-3 pt-5 border-t-2 border-dashed border-line-soft">
          <div>
            <dd className="font-heading text-3xl text-ink tabular-nums leading-none">{maxPoints}</dd>
            <dt className="mt-1.5 text-xs font-bold text-ink-muted">points up for grabs</dt>
          </div>
          <div>
            <dd className="font-heading text-3xl text-ink tabular-nums leading-none">{best ?? "—"}</dd>
            <dt className="mt-1.5 text-xs font-bold text-ink-muted">{best ? "your best on these" : "first try on these"}</dt>
          </div>
        </dl>
        <Notice>{error}</Notice>
        <button onClick={onStart} className="w-full sketch-btn-accent gap-2 h-14 text-lg focus-ring">
          Start {count} questions <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default function SoloPage() {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>([]);
  const [history, setHistory] = useState<GameRecord[]>([]);

  useEffect(() => {
    if (!hasUser()) { router.replace("/"); return; }
    if (guestMustRegister()) { router.replace("/login?reason=trial_used"); return; }
    // "Topic of the day" and other links can pre-fill a topic.
    const topic = new URLSearchParams(window.location.search).get("topic")?.trim();
    if (topic) setTags([topic.slice(0, 50)]);
    setHistory(getStats().recentGames.filter((g) => g.type === "solo"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [count, setCount] = useState(5);
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficulty>("medium");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [setupError, setSetupError] = useState("");

  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  /** The picked option; -1 once the question ended without one (skipped or timed out). */
  const [answered, setAnswered] = useState<number | null>(null);
  const [noAnswer, setNoAnswer] = useState<"skip" | "timeout" | null>(null);
  const [answers, setAnswers] = useState<(AnswerRecord | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [inTransition, setInTransition] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lostStreak, setLostStreak] = useState(0);
  const [missRun, setMissRun] = useState(0);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [extras, setExtras] = useState<Extras>(NO_EXTRAS);
  const [speedBonusAccum, setSpeedBonusAccum] = useState(0);
  const [gameSeed, setGameSeed] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  const inTransitionRef = useRef(false);
  const statsSaved = useRef(false);
  const questionStart = useRef(0);
  const lastTick = useRef(0);
  const optionsRef = useRef<HTMLDivElement>(null);

  const timerSeconds = DIFFICULTY_CONFIG[difficulty].seconds;
  useKeepAboveFeedback(optionsRef, phase === "playing" && answered !== null && !inTransition);

  async function handleStart() {
    if (tags.length === 0) { setSetupError("Add at least one topic first."); return; }
    setSetupError("");
    statsSaved.current = false;
    setStreak(0);
    setBestStreak(0);
    setMissRun(0);
    setExtras(NO_EXTRAS);
    setSpeedBonusAccum(0);
    setGameSeed(Math.floor(Math.random() * 1000));
    setShareOpen(false);
    setPhase("generating");
    try {
      const res = await api.generateQuestions(tags, count, questionDifficulty);
      setQuestions(res.questions);
      setAnswers(new Array(res.questions.length).fill(null));
      setCurrentQ(0);
      resetQuestion();
      if (timerSeconds > 0) setTimeLeft(timerSeconds);
      questionStart.current = Date.now();
      setPhase("playing");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Generation failed");
      setPhase("setup");
    }
  }

  function resetQuestion() {
    setAnswered(null);
    setNoAnswer(null);
    setCallout(null);
    setLostStreak(0);
  }

  function advanceQ(questionsArr: Question[], qIndex: number) {
    if (inTransitionRef.current) return;
    const next = qIndex + 1;
    if (next >= questionsArr.length) {
      setPhase("results");
      return;
    }
    inTransitionRef.current = true;
    setInTransition(true);
    setTimeout(() => {
      setCurrentQ(next);
      resetQuestion();
      setTimeLeft(timerSeconds);
      setInTransition(false);
      inTransitionRef.current = false;
      questionStart.current = Date.now();
    }, TRANSITION_MS);
  }

  /** Record "no answer" for a question unless it already has one. */
  function recordNoAnswer(qIndex: number) {
    setAnswers((prev) => {
      if (prev[qIndex] !== null) return prev;
      const next = [...prev];
      next[qIndex] = { selected: -1, correct: false, points: 0 };
      return next;
    });
  }

  /** Skipped or out of time: show the answer anyway, then wait for "Next". */
  function endWithoutAnswer(reason: "skip" | "timeout") {
    recordNoAnswer(currentQ);
    setLostStreak(streak);
    setStreak(0);
    setMissRun((m) => m + 1);
    setNoAnswer(reason);
    setAnswered(-1);
    if (reason === "timeout") {
      play("wrong");
      buzz([40, 30, 40]);
      pulseDots({ tone: "bad", strength: 0.8 });
    } else {
      play("tap");
    }
  }

  // Countdown for the current question. It stops as soon as the player
  // answers or skips, so a slow "Next" click (or the transition after it) can
  // never time out a question that was already answered and reset the streak.
  useEffect(() => {
    if (phase !== "playing" || timerSeconds === 0 || answered !== null || inTransition) return;
    // timeLeft was already reset to the full timer when this question started.
    const deadline = Date.now() + timerSeconds * 1000;
    lastTick.current = timerSeconds;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left !== lastTick.current && left > 0 && left <= 5) play("tick");
      lastTick.current = left;
      if (left === 0) {
        clearInterval(interval);
        endWithoutAnswer("timeout");
      }
    }, 250);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQ, timerSeconds, answered, inTransition]);

  function selectAnswer(i: number, el?: HTMLElement | null) {
    if (answered !== null || inTransitionRef.current) return;
    setAnswered(i);
    const q = questions[currentQ];
    const correct = i === q.answer;
    const elapsed = (Date.now() - questionStart.current) / 1000;
    let points = 0;
    if (correct) {
      points = soloPointsPerCorrect(questionDifficulty, difficulty);
      const ns = streak + 1;
      setStreak(ns);
      setBestStreak((b) => Math.max(b, ns));
      // Speed bonus: faster answer = more points (only when timer > 0)
      if (timerSeconds > 0) {
        const bonus = Math.round((timeLeft / timerSeconds) * 5);
        points += bonus;
        setSpeedBonusAccum((s) => s + bonus);
      }
      const secondsLeft = timerSeconds > 0 ? timerSeconds - elapsed : null;
      const c = calloutFor({ streak: ns, elapsed, secondsLeft, missesBefore: missRun, timerSeconds });
      setCallout(c);
      setExtras((e) => ({
        rightTimes: [...e.rightTimes, elapsed],
        clutches: e.clutches + (c?.text === "Clutch!" ? 1 : 0),
        comebacks: e.comebacks + (missRun >= 2 ? 1 : 0),
      }));
      setMissRun(0);
      play("correct");
      pulseFrom(el, { tone: "good", strength: 0.9 });
      if (c) {
        window.setTimeout(() => {
          play(c.tone === "hl" ? "streak" : "stamp");
          pulseFrom(el, { tone: "hl", strength: 0.7 });
        }, STAMP_DELAY * 1000);
      }
    } else {
      setLostStreak(streak);
      setStreak(0);
      setMissRun((m) => m + 1);
      play("wrong");
      buzz([40, 30, 40]);
      pulseFrom(el, { tone: "bad", shake: true });
    }
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = { selected: i, correct, points };
      return next;
    });
  }

  function handleNext() {
    recordNoAnswer(currentQ);
    advanceQ(questions, currentQ);
  }

  // Keyboard: 1–4 or A–D to answer, S to skip, Enter for the next question.
  useEffect(() => {
    if (phase !== "playing") return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || inTransitionRef.current) return;
      if (e.target instanceof Element && e.target.closest("input, textarea")) return;
      const k = e.key.toLowerCase();
      const idx = "1234".indexOf(k) >= 0 ? "1234".indexOf(k) : "abcd".indexOf(k);
      if (answered === null && idx >= 0 && idx < (questions[currentQ]?.options.length ?? 0)) {
        e.preventDefault();
        selectAnswer(idx, optionsRef.current?.children[idx] as HTMLElement | undefined);
      } else if (answered === null && k === "s") {
        endWithoutAnswer("skip");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answered, currentQ, questions, streak, missRun, timeLeft]);

  const correctCount = answers.filter((a) => a?.correct).length;
  const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const verdict =
    pct === 100 ? "Perfect!" : pct >= 80 ? "Brilliant!" : pct >= 60 ? "Nice work!" : pct >= 40 ? "Not bad!" : "Keep at it!";
  const finalScore = calcSoloScore(correctCount, questionDifficulty, difficulty, speedBonusAccum);
  const maxPoints = count * (soloPointsPerCorrect(questionDifficulty, difficulty) + (timerSeconds > 0 ? 5 : 0));
  const lowerTags = tags.map((t) => t.toLowerCase());
  const best = history
    .filter((g) => g.topics.some((t) => lowerTags.includes(t.toLowerCase())))
    .reduce((m, g) => Math.max(m, g.score), 0) || null;

  const stamps = earnedStamps({
    correct: correctCount,
    total: questions.length,
    bestStreak,
    answered: answers.filter((a) => a && a.selected !== -1).length,
    rightTimes: extras.rightTimes,
    timerSeconds,
    clutches: extras.clutches,
    comebacks: extras.comebacks,
    questionDifficulty,
  });

  useEffect(() => {
    if (phase !== "results" || questions.length === 0) return;
    if (!statsSaved.current) {
      statsSaved.current = true;
      saveSoloGame({
        topics: tags,
        correct: correctCount,
        total: questions.length,
        questionDifficulty,
        timerDifficulty: difficulty,
        longestStreak: bestStreak,
        speedBonus: speedBonusAccum,
      });
      // Guests get a finite free-trial; bump the counter so the home page
      // can prompt them to register after the limit.
      if (!isLoggedIn()) incrementGuestGamesPlayed();
    }
    // The paper gets marked: a cheer for a good score, then a thud per stamp.
    const timers = [
      window.setTimeout(() => {
        if (pct >= 80) { play("fanfare"); pulseDots({ tone: "hl", strength: 1.4 }); }
        else if (pct >= 50) play("streak");
      }, 900),
      ...stamps.map((_, i) =>
        window.setTimeout(() => play("stamp"), 1500 + i * 260)),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);


  const q = questions[currentQ];

  // ── SETUP ───────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <PageShell title="Lone Wolf" showBack>
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          animate="show"
          className="w-full max-w-xl lg:max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 lg:pb-16"
        >
          <motion.h1 variants={fadeUp} className="font-heading text-4xl sm:text-5xl text-ink leading-none">
            Set up your quiz
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-2 font-hand text-2xl text-ink-muted">
            just you and the clock
          </motion.p>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
            <motion.div variants={fadeUp} className="sketch-card p-5 sm:p-7 space-y-7">
              <TopicInput tags={tags} onChange={(t) => { setTags(t); setSetupError(""); }} />
              <hr className="border-t-2 border-dashed border-line-soft" />
              <CountSlider value={count} onChange={setCount} />
              <ChoiceGrid
                label="Question difficulty"
                hint="Harder questions are worth more."
                options={QUESTION_DIFFICULTY_CHOICES}
                value={questionDifficulty}
                onChange={setQuestionDifficulty}
              />
              <ChoiceGrid
                label="Timer"
                hint="Seconds per question. Shorter timers pay a bonus."
                options={TIMER_CHOICES}
                value={difficulty}
                onChange={setDifficulty}
              />
            </motion.div>

            <motion.aside variants={fadeUp} className="hidden lg:block sticky top-24">
              <QuizTicket
                tags={tags}
                count={count}
                questionDifficulty={questionDifficulty}
                difficulty={difficulty}
                maxPoints={maxPoints}
                best={best}
                error={setupError}
                onStart={handleStart}
              />
            </motion.aside>
          </div>
        </motion.div>

        {/* Start: pinned to the bottom on phones so it's always in reach */}
        <div className="lg:hidden sticky bottom-0 z-20 mt-6 border-t-2 border-ink sm:border-0 sm:static" style={{ background: "var(--paper)" }}>
          <div className="w-full max-w-xl mx-auto px-4 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-14 space-y-3">
            <Notice>{setupError}</Notice>
            <button onClick={handleStart} className="w-full sketch-btn-accent gap-2 h-14 text-lg focus-ring">
              Start {count} questions <ArrowRight size={20} />
            </button>
            <p className="text-center text-sm font-bold text-ink-muted">
              Worth up to {maxPoints} points
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── GENERATING ──────────────────────────────────────────────────────────
  if (phase === "generating") {
    return <GeneratingScreen tags={tags} count={count} questionDifficulty={questionDifficulty} />;
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────
  if (phase === "playing" && q) {
    const isAnswered = answered !== null;
    const isCorrect = isAnswered && answered === q.answer;
    const last = currentQ + 1 >= questions.length;
    const ticks: TickState[] = answers.map((a) =>
      a === null ? null : a.selected === -1 ? "skip" : a.correct ? "good" : "bad");
    const points = answers[currentQ]?.points ?? 0;
    const seed = currentQ * 7 + gameSeed;

    const stateFor = (i: number): OptionState => {
      if (!isAnswered) return "idle";
      if (i === answered) return i === q.answer ? "correct" : "wrong";
      if (i === q.answer) return "missed";
      return "dim";
    };

    const title = isCorrect
      ? pick(RIGHT_HEADLINES, seed)
      : noAnswer === "timeout" ? "Time's up"
      : noAnswer === "skip" ? "Skipped"
      : pick(WRONG_HEADLINES, seed);

    return (
      <div className="min-h-svh flex flex-col">
        <header className="sticky top-0 z-20 border-b-2 border-ink bg-card">
          <div className="max-w-2xl mx-auto h-16 px-4 sm:px-6 flex items-center gap-3">
            <ProgressTicks total={questions.length} current={currentQ} results={ticks} />
            <span className="text-sm font-extrabold text-ink tabular-nums whitespace-nowrap">
              {currentQ + 1}<span className="text-ink-muted">/{questions.length}</span>
            </span>
            {streak >= 2 && (
              <motion.span
                key={streak}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1 rounded-full border-2 border-ink bg-hl px-2 py-0.5 text-sm font-extrabold text-hl-ink"
                aria-label={`${streak} in a row`}
              >
                <Flame size={14} /> {streak}
              </motion.span>
            )}
            <SoundToggle />
            {timerSeconds > 0 && <TimerRing seconds={timeLeft} total={timerSeconds} size={46} />}
          </div>
        </header>

        <main
          className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-10"
          style={isAnswered ? { paddingBottom: "calc(var(--feedback-h, 14rem) + 1.5rem)" } : undefined}
        >
          <QuestionSheet number={currentQ + 1} category={q.category} stamp={callout}>{q.question}</QuestionSheet>

          <div ref={optionsRef} key={`opts-${currentQ}`} className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const state = stateFor(i);
              return (
                <OptionButton
                  key={i}
                  index={i}
                  text={opt}
                  state={state}
                  onPick={(el) => selectAnswer(i, el)}
                  note={state === "correct" ? `+${points}` : state === "missed" ? "this one!" : undefined}
                  remark={state === "wrong" ? q.option_notes?.[i] || undefined : undefined}
                />
              );
            })}
          </div>

          {!isAnswered && (
            <div className="mt-6 flex flex-col items-center gap-1">
              <button
                onClick={() => endWithoutAnswer("skip")}
                className="flex items-center gap-1.5 rounded-lg px-4 h-11 text-sm font-extrabold text-ink-muted hover:text-ink transition-colors focus-ring"
              >
                <SkipForward size={16} /> Skip this one
              </button>
              <p className="hidden [@media(hover:hover)_and_(pointer:fine)]:block text-xs font-bold text-ink-faint">
                Tip: press 1–4 to answer
              </p>
            </div>
          )}
        </main>

        <AnimatePresence>
          {isAnswered && !inTransition && (
            <FeedbackBar
              key={`fb-${currentQ}`}
              tone={isCorrect ? "good" : "bad"}
              title={title}
              aside={isCorrect
                ? <>+{points} points{streak >= 2 && <> · {streak} in a row</>}</>
                : undefined}
              explanation={isCorrect ? undefined : q.explanation || `The answer was ${q.options[q.answer]}.`}
              quip={(isCorrect ? q.quip_right : q.quip_wrong) || undefined}
              fact={q.fact || undefined}
              footer={!isCorrect && lostStreak >= 3 ? <>That ends a streak of {lostStreak}. It was a good run.</> : undefined}
              action={
                <button autoFocus onClick={handleNext} className="sketch-btn-accent gap-2 h-12 px-6 text-base w-full sm:w-auto shrink-0 focus-ring">
                  {last ? <><Trophy size={18} /> See results</> : <>Next question <ArrowRight size={18} /></>}
                </button>
              }
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {inTransition && (
            <motion.div
              key="transition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 flex items-center justify-center"
              style={{ background: "var(--paper)" }}
            >
              <QuestionTransition nextNum={currentQ + 2} total={questions.length} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── RESULTS: the marked paper ───────────────────────────────────────────
  // The title names one of your topics: the one you did best in.
  const byTopic = new Map<string, { right: number; total: number }>(tags.map((t) => [t, { right: 0, total: 0 }]));
  questions.forEach((question, i) => {
    const category = question.category.toLowerCase();
    const tag = tags.find((t) => category.includes(t.toLowerCase()) || t.toLowerCase().includes(category));
    const row = tag ? byTopic.get(tag) : undefined;
    if (!row) return;
    row.total += 1;
    if (answers[i]?.correct) row.right += 1;
  });
  const ratio = (r: { right: number; total: number }) => (r.total ? r.right / r.total : -1);
  const bestTopic = [...byTopic.entries()]
    .sort(([, a], [, b]) => ratio(b) - ratio(a) || b.total - a.total)[0]?.[0] ?? "Trivia";
  const title = earnedTitle(pct, bestTopic);
  const marks = answers.map((a): "good" | "bad" | "skip" => (a?.correct ? "good" : a && a.selected !== -1 ? "bad" : "skip"));
  const comment = teacherComment(pct, gameSeed);
  const shareCaption = [
    `Qrio · ${tags.join(", ")} · ${QUESTION_DIFFICULTY_CONFIG[questionDifficulty].label}`,
    `${resultGrid(marks)} ${correctCount}/${questions.length} · ${finalScore} pts`,
    `Title earned: ${title}`,
    typeof window !== "undefined" ? window.location.origin : "",
  ].join("\n");

  return (
    <PageShell title="Lone Wolf">
      {pct >= 80 && <Confetti />}
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6"
      >
        <motion.section variants={fadeUp} className="relative sketch-card p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <div className="relative w-52 h-36 shrink-0 flex items-center justify-center">
              <MarkerLoop stretch color="var(--bad-mark)" strokeWidth={3.5} duration={0.8} delay={0.35} className="-inset-1 w-[calc(100%+0.5rem)] h-[calc(100%+0.5rem)]" />
              <span className="font-heading text-7xl text-ink leading-none tabular-nums">
                {correctCount}<span className="text-4xl text-ink-muted">/{questions.length}</span>
              </span>
            </div>
            <div className="text-center sm:text-left min-w-0">
              <motion.p
                initial={{ opacity: 0, rotate: -8, y: 6 }}
                animate={{ opacity: 1, rotate: -4, y: 0 }}
                transition={{ duration: 0.4, delay: 0.9, ease: EASE }}
                className="font-hand text-4xl sm:text-5xl text-bad leading-none"
              >
                {verdict}
              </motion.p>
              <h1 className="mt-3 font-heading text-4xl sm:text-5xl text-ink tabular-nums leading-none">
                {finalScore} <span className="text-2xl sm:text-3xl">points</span>
              </h1>
              <p className="mt-3 text-sm font-semibold text-ink-muted">
                {tags.join(", ")} · {QUESTION_DIFFICULTY_CONFIG[questionDifficulty].label} · {DIFFICULTY_CONFIG[difficulty].seconds ? `${DIFFICULTY_CONFIG[difficulty].seconds}s timer` : "No timer"}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t-2 border-dashed border-line-soft text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Title earned</p>
            <p className="mt-2 inline-block font-heading text-[clamp(1.75rem,7vw,2.5rem)] leading-none text-ink text-balance">
              {title}
              <Scribble delay={1.1} className="mt-1 h-3 w-full" />
            </p>
          </div>

          <dl className="mt-7 pt-6 border-t-2 border-dashed border-line-soft grid grid-cols-3 gap-2 text-center">
            {[
              { k: "Accuracy", v: `${pct}%` },
              { k: "Best streak", v: bestStreak },
              { k: "Speed bonus", v: `+${speedBonusAccum}` },
            ].map((s) => (
              <div key={s.k}>
                <dd className="font-heading text-3xl sm:text-4xl text-ink tabular-nums">{s.v}</dd>
                <dt className="mt-1 text-xs sm:text-sm font-bold text-ink-muted">{s.k}</dt>
              </div>
            ))}
          </dl>

          <motion.p
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 0.9, delay: 1.3, ease: EASE }}
            className="mt-7 font-hand text-2xl sm:text-[28px] leading-tight text-bad text-center sm:text-right -rotate-1 text-pretty"
          >
            {comment}
          </motion.p>
        </motion.section>

        <motion.section variants={fadeUp} className="sketch-card p-5 sm:p-6">
          <h2 className="font-heading text-xl text-ink">Stamps earned</h2>
          {stamps.length > 0 ? (
            <div className="mt-5 mb-1 flex flex-wrap gap-x-4 gap-y-5">
              {stamps.map((id, i) => (
                <Stamp
                  key={id}
                  text={STAMPS[id]}
                  tone={id === "perfect" || id === "streak" ? "hl" : "good"}
                  delay={1.5 + i * 0.26}
                  className={i % 2 ? "rotate-3" : ""}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-ink-muted">
              None this time. Streaks, quick answers and perfect papers earn them.
            </p>
          )}
        </motion.section>

        <motion.section variants={fadeUp} className="sketch-card overflow-clip">
          <h2 className="px-5 sm:px-6 py-4 border-b-2 border-ink font-heading text-xl text-ink">Your answers</h2>
          <ol className="divide-y-2 divide-line-faint">
            {questions.map((question, i) => {
              const a = answers[i];
              const correct = a?.correct ?? false;
              const skipped = !a || a.selected === -1;
              return (
                <li key={i}>
                  <details className="group">
                    <summary className="flex items-center gap-3 px-5 sm:px-6 py-4 hover:bg-card-soft transition-colors">
                      <span className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center ${correct ? "border-good text-good" : skipped ? "border-line-soft text-ink-faint" : "border-bad text-bad"}`}>
                        {correct ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                      </span>
                      <span className="flex-1 min-w-0 text-sm sm:text-base font-bold text-ink line-clamp-2">
                        {question.question}
                      </span>
                      <span className={`shrink-0 font-hand text-2xl leading-none ${correct ? "text-good" : "text-ink-faint"}`}>
                        {correct ? `+${a?.points ?? 0}` : "0"}
                      </span>
                      <ChevronDown size={16} className="chevron text-ink-muted shrink-0" />
                    </summary>
                    <div className="px-5 sm:px-6 pb-4 pl-16 sm:pl-[4.25rem] space-y-1.5 text-sm font-semibold">
                      {skipped ? (
                        <p className="text-ink-muted">Skipped or out of time</p>
                      ) : !correct ? (
                        <p className="text-ink-soft">You said <span className="strike-mark text-ink">{question.options[a.selected]}</span></p>
                      ) : null}
                      <p className="text-ink-soft">Answer: <span className="font-extrabold text-good">{question.options[question.answer]}</span></p>
                      {question.fact && (
                        <p className="flex gap-1.5 pt-1 text-ink-muted">
                          <Lightbulb size={14} className="shrink-0 mt-0.5" aria-hidden="true" /> {question.fact}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        </motion.section>

        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4">
          <button
            onClick={() => {
              statsSaved.current = false;
              setPhase("setup");
              setQuestions([]);
              setAnswers([]);
              setCurrentQ(0);
              resetQuestion();
              setStreak(0);
              setBestStreak(0);
              setSpeedBonusAccum(0);
              setHistory(getStats().recentGames.filter((g) => g.type === "solo"));
            }}
            className="sketch-btn-accent gap-2 h-14 text-base focus-ring"
          >
            <RotateCcw size={18} /> Play again
          </button>
          <button onClick={() => setShareOpen(true)} className="sketch-btn-light gap-2 h-14 text-base focus-ring">
            <Share2 size={18} /> Share result
          </button>
          <button onClick={() => router.push(getHomePath())} className="sketch-btn-light gap-2 h-14 text-base focus-ring">
            <Home size={18} /> Home
          </button>
        </motion.div>
      </motion.div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        text={shareCaption}
        card={{
          mode: "Lone Wolf",
          topics: tags,
          difficulty: QUESTION_DIFFICULTY_CONFIG[questionDifficulty].label,
          correct: correctCount,
          total: questions.length,
          score: finalScore,
          verdict,
          title,
          titleLabel: "Title earned",
          grid: marks,
          comment,
          stamps: stamps.map((id) => STAMPS[id]),
        }}
      />
    </PageShell>
  );
}
