"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { hasUser, getHomePath } from "@/lib/auth";
import { saveSoloGame } from "@/lib/stats";
import { fadeUp, scaleIn, stagger } from "@/lib/motion";
import PageShell from "../components/PageShell";
import {
  Target, Leaf, Skull, Infinity as InfinityIcon, Flame, Timer,
  BookOpen, Hash, Brain, AlertTriangle, ArrowRight, Check, X,
  Trophy, Star, ThumbsUp, RotateCcw, Home, ChevronDown, Bot, SkipForward,
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

const OPTION_LABELS = ["A", "B", "C", "D"];
const TRANSITION_MS = 1500;

function QuestionDifficultyIcon({ d }: { d: QuestionDifficulty }) {
  if (d === "easy") return <Leaf size={20} />;
  if (d === "medium") return <Target size={20} />;
  return <Skull size={20} />;
}

function TimerDifficultyIcon({ d }: { d: Difficulty }) {
  if (d === "none") return <InfinityIcon size={20} />;
  if (d === "easy") return <Leaf size={20} />;
  if (d === "medium") return <Timer size={20} />;
  return <Flame size={20} />;
}

function CircularTimer({ seconds, total }: { seconds: number; total: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (seconds / total) * circ;
  const dangerZone = seconds <= 5;
  const warnZone = !dangerZone && seconds <= Math.floor(total * 0.4);
  const stroke = dangerZone ? "var(--accent-red)" : warnZone ? "var(--accent-amber)" : "var(--ink)";
  return (
    <div className="relative w-16 h-16">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none"
          stroke={stroke} strokeWidth="5" strokeLinecap="square"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={seconds}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="text-lg font-black tabular-nums"
          style={{ color: stroke }}
        >
          {seconds}
        </motion.span>
      </div>
    </div>
  );
}

function QuestionTransition({ nextNum, total }: { nextNum: number; total: number }) {
  const [progress, setProgress] = useState(0);
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - progress * circ;

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / TRANSITION_MS, 1);
      setProgress(p);
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-paper z-20"
    >
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 70 70">
          <circle cx="35" cy="35" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="6" />
          <circle
            cx="35" cy="35" r={r} fill="none"
            stroke="var(--ink)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-black text-xl text-ink">Q{nextNum}</span>
        </div>
      </div>
      <p className="mt-5 font-bold text-ink-soft">Question {nextNum} of {total}</p>
    </motion.div>
  );
}

export default function SoloPage() {
  const router = useRouter();
  useEffect(() => { if (!hasUser()) router.replace("/"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficulty>("medium");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [setupError, setSetupError] = useState("");

  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(AnswerRecord | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [animClass, setAnimClass] = useState("");
  const [inTransition, setInTransition] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [speedBonusAccum, setSpeedBonusAccum] = useState(0);

  const inTransitionRef = useRef(false);
  const statsSaved = useRef(false);

  const timerSeconds = DIFFICULTY_CONFIG[difficulty].seconds;

  function addTag(raw: string) {
    const t = raw.trim().replace(/,+$/, "");
    if (t && !tags.includes(t) && tags.length < 10) setTags((p) => [...p, t]);
    setTagInput("");
  }
  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
    if (e.key === "Backspace" && !tagInput && tags.length) setTags((p) => p.slice(0, -1));
  }

  async function handleStart() {
    if (tags.length === 0) { setSetupError("Add at least one topic!"); return; }
    setSetupError("");
    statsSaved.current = false;
    setStreak(0);
    setBestStreak(0);
    setSpeedBonusAccum(0);
    setPhase("generating");
    try {
      const res = await api.generateQuestions(tags, count, questionDifficulty);
      setQuestions(res.questions);
      setAnswers(new Array(res.questions.length).fill(null));
      setCurrentQ(0);
      setAnswered(null);
      if (timerSeconds > 0) setTimeLeft(timerSeconds);
      setPhase("playing");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Generation failed");
      setPhase("setup");
    }
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
      setAnswered(null);
      setAnimClass("animate-slide-up");
      setTimeout(() => setAnimClass(""), 400);
      setInTransition(false);
      inTransitionRef.current = false;
    }, TRANSITION_MS);
  }

  useEffect(() => {
    if (phase !== "playing" || timerSeconds === 0) return;
    setTimeLeft(timerSeconds);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setAnswers((prev) => {
            if (prev[currentQ] !== null) return prev;
            const next = [...prev];
            next[currentQ] = { selected: -1, correct: false };
            return next;
          });
          setStreak(0);
          advanceQ(questions, currentQ);
          return timerSeconds;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQ, timerSeconds]);

  function selectAnswer(i: number) {
    if (answered !== null) return;
    setAnswered(i);
    const correct = i === questions[currentQ].answer;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = { selected: i, correct };
      return next;
    });
    if (correct) {
      setStreak((s) => {
        const ns = s + 1;
        setBestStreak((b) => Math.max(b, ns));
        return ns;
      });
      // Speed bonus: faster answer = more points (only when timer > 0)
      if (timerSeconds > 0) {
        const fraction = timeLeft / timerSeconds;
        const bonus = Math.round(fraction * 5);
        setSpeedBonusAccum((s) => s + bonus);
      }
    } else {
      setStreak(0);
    }
    setAnimClass(correct ? "animate-pop" : "animate-shake");
    setTimeout(() => setAnimClass(""), 500);
  }

  function handleSkip() {
    if (answered !== null || inTransitionRef.current) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = { selected: -1, correct: false };
      return next;
    });
    setStreak(0);
    advanceQ(questions, currentQ);
  }

  function handleNext() {
    if (answers[currentQ] === null) {
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQ] = { selected: -1, correct: false };
        return next;
      });
    }
    advanceQ(questions, currentQ);
  }

  useEffect(() => {
    if (phase === "results" && questions.length > 0 && !statsSaved.current) {
      statsSaved.current = true;
      const correct = answers.filter((a) => a?.correct).length;
      saveSoloGame({
        topics: tags,
        correct,
        total: questions.length,
        questionDifficulty,
        timerDifficulty: difficulty,
        longestStreak: bestStreak,
        speedBonus: speedBonusAccum,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const correctCount = answers.filter((a) => a?.correct).length;
  const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const stars = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
  const messages = ["Keep going!", "Good effort!", "Nice work!", "Brilliant!"];
  const finalScore = correctCount * 10 * (questionDifficulty === "easy" ? 1 : questionDifficulty === "medium" ? 1.5 : 2)
    + correctCount * (difficulty === "none" ? 0 : difficulty === "easy" ? 2 : difficulty === "medium" ? 4 : 8)
    + speedBonusAccum;

  const q = questions[currentQ];

  // ── SETUP PHASE ─────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <PageShell title="Lone Wolf" showBack>
        <div className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8 sm:py-10">
          <motion.div
            variants={stagger(0.07)}
            initial="hidden"
            animate="show"
            className="w-full max-w-lg space-y-5"
          >

            <motion.div variants={fadeUp} className="sketch-card p-6">
              <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-3">
                <BookOpen size={14} /> Topics
              </label>
              <div
                className="flex flex-wrap gap-2 p-3 sketch-inset min-h-[52px] focus-within:border-ink cursor-text"
                onClick={() => document.getElementById("tag-input")?.focus()}
              >
                <AnimatePresence>
                  {tags.map((tag, i) => (
                    <motion.span
                      key={tag}
                      layout
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      className="flex items-center gap-1 bg-ink text-on-ink text-sm px-3 py-1 rounded-full font-bold"
                    >
                      {tag}
                      <button
                        onClick={() => setTags((p) => p.filter((_, j) => j !== i))}
                        className="ml-1 opacity-60 hover:opacity-100"
                        aria-label={`Remove ${tag}`}
                      >
                        <X size={11} />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                <input
                  id="tag-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={() => tagInput.trim() && addTag(tagInput)}
                  placeholder={tags.length === 0 ? "Type a topic, press Enter…" : "Add more…"}
                  className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-ink placeholder-ink-ghost"
                />
              </div>
              <p className="text-xs text-ink-faint mt-2 font-medium">e.g. History, Science, Movies, NBA…</p>
            </motion.div>

            <motion.div variants={fadeUp} className="sketch-card p-6">
              <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-3">
                <Hash size={14} /> Questions:
                <span className="text-ink text-base ml-1">{count}</span>
              </label>
              <input
                type="range" min={3} max={20} value={count}
                onChange={(e) => setCount(+e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-ink-faint mt-2 font-medium">
                <span>3 (Quick)</span><span>20 (Marathon)</span>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="sketch-card p-6">
              <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-1">
                <Brain size={14} /> Question Difficulty
              </label>
              <p className="text-xs text-ink-faint mb-3 font-medium">How hard should the AI make the questions?</p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(QUESTION_DIFFICULTY_CONFIG) as QuestionDifficulty[]).map((d) => {
                  const cfg = QUESTION_DIFFICULTY_CONFIG[d];
                  const active = questionDifficulty === d;
                  return (
                    <motion.button
                      key={d}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setQuestionDifficulty(d)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 font-bold text-xs transition-colors duration-150 touch-manipulation focus-ring ${
                        active
                          ? `${cfg.activeClass} shadow-[2px_2px_0px_currentColor]`
                          : "border-line-soft text-ink-muted bg-card hover:border-ink hover:text-ink"
                      }`}
                    >
                      <QuestionDifficultyIcon d={d} />
                      <span>{cfg.label}</span>
                      <span className="text-[10px] opacity-70 text-center">{cfg.description}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="sketch-card p-6">
              <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-1">
                <Timer size={14} /> Timer Difficulty
              </label>
              <p className="text-xs text-ink-faint mb-3 font-medium">How much time per question?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
                  const cfg = DIFFICULTY_CONFIG[d];
                  const active = difficulty === d;
                  return (
                    <motion.button
                      key={d}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setDifficulty(d)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 font-bold text-xs transition-colors duration-150 touch-manipulation focus-ring ${
                        active
                          ? `${cfg.activeClass} shadow-[2px_2px_0_var(--shadow)]`
                          : "border-line-soft text-ink-muted bg-card hover:border-ink hover:text-ink"
                      }`}
                    >
                      <TimerDifficultyIcon d={d} />
                      <span>{cfg.label}</span>
                      {cfg.seconds > 0 && <span className="text-[10px] opacity-70">{cfg.seconds}s</span>}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            <AnimatePresence>
              {setupError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 text-sm font-semibold"
                  style={{ boxShadow: "3px 3px 0px var(--shadow-soft)" }}
                >
                  <AlertTriangle size={15} className="shrink-0" />
                  {setupError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              variants={fadeUp}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              onClick={handleStart}
              className="w-full sketch-btn-dark gap-2 py-4 text-lg font-heading focus-ring"
            >
              Let&apos;s Go! <ArrowRight size={18} />
            </motion.button>
          </motion.div>
        </div>
      </PageShell>
    );
  }

  // ── GENERATING PHASE ─────────────────────────────────────────────────────
  if (phase === "generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 bg-ink rounded-2xl flex items-center justify-center"
          style={{ boxShadow: "4px 4px 0px var(--shadow)" }}
        >
          <Bot size={40} className="text-on-ink" />
        </motion.div>
        <div className="text-center">
          <h2 className="font-heading text-3xl text-ink mb-2">Cooking up questions…</h2>
          <p className="text-ink-muted font-medium">
            AI is generating {count} questions on: {tags.join(", ")}
          </p>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              className="w-3 h-3 bg-ink rounded-full"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── PLAYING PHASE ────────────────────────────────────────────────────────
  if (phase === "playing" && q) {
    const progress = (currentQ / questions.length) * 100;
    const isAnswered = answered !== null;
    const isCorrect = isAnswered && answered === q.answer;

    return (
      <div className="min-h-screen flex flex-col bg-paper relative">
        <AnimatePresence>
          {inTransition && (
            <QuestionTransition nextNum={currentQ + 2} total={questions.length} />
          )}
        </AnimatePresence>

        <div className="px-5 py-3 border-b-2 border-ink bg-card flex items-center gap-3">
          <div className="flex-1 bg-card-soft h-3 overflow-hidden border border-ink">
            <motion.div
              className="h-full bg-ink"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-sm font-black text-ink whitespace-nowrap tabular-nums">
            {currentQ + 1} / {questions.length}
          </span>
          {streak >= 2 && (
            <motion.span
              key={streak}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 text-xs font-black text-amber-500"
            >
              <Flame size={13} /> {streak}
            </motion.span>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-5 gap-6 max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between w-full">
            {q.category && (
              <span
                className="text-xs font-black bg-card border-2 border-ink text-ink px-4 py-1.5 rounded-full uppercase tracking-wider"
                style={{ boxShadow: "2px 2px 0px var(--shadow)" }}
              >
                {q.category}
              </span>
            )}
            {timerSeconds > 0 && (
              <CircularTimer seconds={timeLeft} total={timerSeconds} />
            )}
          </div>

          <motion.div
            key={currentQ}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`text-center w-full sketch-card p-6 ${animClass}`}
          >
            <h2 className="font-body font-extrabold text-xl md:text-2xl text-ink leading-snug">
              {q.question}
            </h2>
          </motion.div>

          <motion.div
            key={`opts-${currentQ}`}
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full"
          >
            {q.options.map((opt, i) => {
              const sel = answered === i;
              const correct = i === q.answer;
              let cls = "bg-card border-ink text-ink hover:shadow-[3px_3px_0_var(--shadow)] hover:-translate-y-0.5";
              if (isAnswered) {
                if (sel && correct) cls = "bg-emerald-600 border-emerald-700 text-white shadow-[3px_3px_0px_#166534]";
                else if (sel && !correct) cls = "bg-red-600 border-red-700 text-white shadow-[3px_3px_0px_#991b1b]";
                else if (correct) cls = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300";
                else cls = "bg-card border-line-soft text-ink-faint opacity-50";
              }
              return (
                <motion.button
                  key={i}
                  variants={scaleIn}
                  whileTap={!isAnswered ? { scale: 0.97 } : {}}
                  onClick={() => selectAnswer(i)}
                  disabled={isAnswered}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 font-bold text-sm text-left transition-all duration-150 disabled:cursor-not-allowed focus-ring ${cls} ${sel && !isCorrect ? "animate-shake" : ""} ${sel && isCorrect ? "animate-pop" : ""}`}
                >
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0 transition-colors ${
                    isAnswered
                      ? sel && correct ? "bg-white/20 text-white"
                      : sel ? "bg-white/20 text-white"
                      : correct ? "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                      : "bg-card-soft text-ink-faint"
                      : "bg-ink text-on-ink"
                  }`}>
                    {isAnswered && sel && correct
                      ? <Check size={16} />
                      : isAnswered && sel
                      ? <X size={16} />
                      : isAnswered && correct
                      ? <Check size={16} />
                      : OPTION_LABELS[i]}
                  </span>
                  <span className="flex-1 leading-snug">{opt}</span>
                </motion.button>
              );
            })}
          </motion.div>

          <div className="flex items-center justify-between w-full gap-3">
            {!isAnswered ? (
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 text-sm font-bold text-ink-muted hover:text-ink transition-colors px-3 py-2 focus-ring rounded-md"
              >
                <SkipForward size={15} /> Skip
              </button>
            ) : (
              <div />
            )}

            <AnimatePresence>
              {isAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="flex flex-col items-end gap-2"
                >
                  <p className={`font-heading text-xl font-bold ${isCorrect ? "text-emerald-600" : "text-red-600"}`}>
                    {isCorrect ? "Correct!" : "Wrong!"}
                  </p>
                  {!isCorrect && (
                    <p className="text-sm text-ink-soft font-medium">
                      Correct: <span className="text-emerald-600 font-black">{q.options[q.answer]}</span>
                    </p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ y: -1 }}
                    onClick={handleNext}
                    className="sketch-btn-dark gap-2 px-8 py-3 focus-ring"
                  >
                    {currentQ + 1 >= questions.length ? (
                      <><Trophy size={16} /> See Results</>
                    ) : (
                      <>Next Question <ArrowRight size={15} /></>
                    )}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center p-5 pt-8">
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="w-full max-w-2xl space-y-5"
      >

        <motion.div variants={scaleIn} className="sketch-card p-8 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
            className="flex justify-center mb-4"
          >
            {pct >= 80
              ? <Trophy size={52} className="text-amber-500" />
              : pct >= 60
              ? <Star size={52} className="text-blue-500 fill-blue-500" />
              : pct >= 40
              ? <ThumbsUp size={52} className="text-emerald-500" />
              : <BookOpen size={52} className="text-ink-muted" />}
          </motion.div>
          <h2 className="font-heading text-4xl text-ink mb-1">{messages[stars]}</h2>

          <div className="flex justify-center gap-2 my-4">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.4 + i * 0.15 }}
              >
                <Star
                  size={36}
                  className={i < stars ? "text-amber-400 fill-amber-400" : "text-ink-ghost fill-[var(--line-soft)]"}
                />
              </motion.span>
            ))}
          </div>

          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <div className="font-heading text-5xl text-emerald-600">{correctCount}</div>
              <div className="text-xs text-ink-faint uppercase tracking-wider mt-1 font-black">Correct</div>
            </div>
            <div className="text-center border-x-2 border-line-soft px-8">
              <div className="font-heading text-5xl text-ink">{pct}%</div>
              <div className="text-xs text-ink-faint uppercase tracking-wider mt-1 font-black">Score</div>
            </div>
            <div className="text-center">
              <div className="font-heading text-5xl text-red-500">
                {questions.length - correctCount}
              </div>
              <div className="text-xs text-ink-faint uppercase tracking-wider mt-1 font-black">Wrong</div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-5 inline-flex items-center gap-2 bg-ink text-on-ink px-4 py-2 rounded-full font-black text-sm"
          >
            <Trophy size={14} /> {Math.round(finalScore)} pts
            {bestStreak >= 2 && <span className="opacity-80">· {bestStreak}× streak</span>}
          </motion.div>

          <p className="text-ink-faint text-sm mt-4 font-medium">
            Topics: {tags.join(", ")} · {QUESTION_DIFFICULTY_CONFIG[questionDifficulty].label} questions · {DIFFICULTY_CONFIG[difficulty].label} timer
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="sketch-card overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-ink">
            <h3 className="font-black text-ink">Question Breakdown</h3>
          </div>
          <div className="divide-y-2 divide-line-faint">
            {questions.map((question, i) => {
              const a = answers[i];
              const correct = a?.correct ?? false;
              const timedOut = a?.selected === -1;
              return (
                <details key={i} className="group">
                  <summary className="flex items-center gap-3 px-6 py-4 hover:bg-card-soft transition-colors cursor-pointer">
                    <span className={`shrink-0 ${correct ? "text-emerald-600" : "text-red-500"}`}>
                      {correct ? <Check size={18} /> : <X size={18} />}
                    </span>
                    <span className="flex-1 text-sm font-bold text-ink line-clamp-1">
                      Q{i + 1}: {question.question}
                    </span>
                    <span className={`text-xs font-black px-2 py-1 rounded-full shrink-0 ${correct ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300"}`}>
                      {correct ? "+10" : "0"}
                    </span>
                    <ChevronDown size={14} className="chevron text-ink-faint ml-1 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-4 pt-1 bg-card-soft text-sm space-y-2 border-t border-line-faint">
                    {timedOut ? (
                      <p className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                        <Timer size={14} /> Timed out — no answer submitted
                      </p>
                    ) : a ? (
                      <>
                        <p className={`font-semibold flex items-center gap-1.5 ${a.correct ? "text-emerald-600" : "text-red-600"}`}>
                          {a.correct ? <Check size={14} /> : <X size={14} />}
                          Your answer: {question.options[a.selected]}
                        </p>
                        {!a.correct && (
                          <p className="text-emerald-600 font-semibold flex items-center gap-1.5">
                            <Check size={14} />
                            Correct: {question.options[question.answer]}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-ink-faint">Not answered</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            onClick={() => {
              statsSaved.current = false;
              setPhase("setup");
              setQuestions([]);
              setAnswers([]);
              setCurrentQ(0);
              setAnswered(null);
              setStreak(0);
              setBestStreak(0);
              setSpeedBonusAccum(0);
            }}
            className="flex-1 sketch-btn-dark gap-2 py-3.5 focus-ring"
          >
            <RotateCcw size={15} /> Play Again
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            onClick={() => router.push(getHomePath())}
            className="flex-1 sketch-btn-light gap-2 py-3.5 focus-ring"
          >
            <Home size={15} /> Home
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
