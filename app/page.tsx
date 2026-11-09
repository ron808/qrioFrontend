"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Flame, Lightbulb, LogIn, Sparkles, Target, UserPlus, Users } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";
import Logo from "./components/Logo";
import Modal from "./components/Modal";
import Notice from "./components/Notice";
import { DoodleArrow, Highlight, MarkerLoop, Scribble } from "./components/Marks";
import { OptionButton, QuestionSheet, TimerRing, type OptionState } from "./components/GameUI";
import { questionDifficultyIcon } from "./components/QuizSettings";
import {
  isLoggedIn,
  getGuestName,
  saveGuest,
  getGuestGamesPlayed,
  guestMustRegister,
  GUEST_GAME_LIMIT,
} from "@/lib/auth";
import { qDiffMultiplier } from "@/lib/stats";
import { QUESTION_DIFFICULTY_CONFIG, type QuestionDifficulty } from "@/lib/types";
import { EASE, fadeUp, stagger } from "@/lib/motion";
import { play } from "@/lib/sound";
import { pulseFrom } from "@/lib/pulse";

type Mode = "solo" | "multiplayer";

/** A real question to try on the landing page; it gets marked like the game. */
const SAMPLE = {
  category: "Space",
  question: "Which planet takes longer to spin once than to go around the Sun?",
  options: ["Mars", "Venus", "Jupiter", "Mercury"],
  answer: 1,
  explanation: "Venus takes 243 Earth days to spin once, but only 225 to go around the Sun.",
  quip_right: "Correct. Venus is in no hurry whatsoever.",
  quip_wrong: "Venus, the slowest spinner in the Solar System, is still turning around to look at you.",
  fact: "Venus also spins backwards, so the Sun there rises in the west.",
  option_notes: [
    "Mars spins in about 24.6 hours, a lot like Earth.",
    "",
    "Jupiter spins fastest of all, in under 10 hours.",
    "Mercury spins once every 59 days but orbits in 88.",
  ],
};

const reveal = {
  initial: "hidden",
  whileInView: "show",
  viewport: { once: true, amount: 0.25 },
} as const;

function SampleQuestion({ onPlay }: { onPlay: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === SAMPLE.answer;

  function pickOption(i: number, el: HTMLElement) {
    if (picked !== null) return;
    setPicked(i);
    if (i === SAMPLE.answer) {
      play("correct");
      pulseFrom(el, { tone: "good", strength: 0.9 });
    } else {
      play("wrong");
      pulseFrom(el, { tone: "bad", shake: true });
    }
  }

  function stateFor(i: number): OptionState {
    if (picked === null) return "idle";
    if (i === picked) return i === SAMPLE.answer ? "correct" : "wrong";
    if (i === SAMPLE.answer) return "missed";
    return "dim";
  }

  return (
    <div className="relative">
      <div aria-hidden="true" className="tape -top-3 left-10 -rotate-6 z-10" />
      <div className="space-y-3 sm:rotate-[0.8deg]">
        <QuestionSheet number={1} category={SAMPLE.category}>{SAMPLE.question}</QuestionSheet>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {SAMPLE.options.map((o, i) => (
            <OptionButton
              key={o}
              index={i}
              text={o}
              state={stateFor(i)}
              onPick={(el) => pickOption(i, el)}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 min-h-[5.5rem]" aria-live="polite">
        {picked === null ? (
          <p className="font-hand text-2xl text-ink-muted flex items-center gap-2">
            <span aria-hidden="true" className="inline-block -scale-x-100 rotate-[200deg]">
              <DoodleArrow className="w-12 h-6 text-ink-muted" />
            </span>
            Go on, take a guess.
          </p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.5, ease: EASE }}
          >
            {/* The options are too narrow here for notes, so the one about your pick goes first. */}
            {!right && picked !== null && (
              <p className="text-[15px] font-bold leading-snug text-ink text-pretty">
                {SAMPLE.option_notes[picked]} {SAMPLE.explanation}
              </p>
            )}
            <p className={`mt-1 font-hand text-2xl leading-tight text-pretty ${right ? "text-good" : "text-bad"}`}>
              {right ? SAMPLE.quip_right : SAMPLE.quip_wrong}
            </p>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1 flex gap-2 text-sm font-semibold leading-snug text-ink-soft text-pretty">
                <Lightbulb size={16} className="shrink-0 mt-px text-ink" aria-hidden="true" />
                <span><span className="font-extrabold text-ink">Fun fact:</span> {SAMPLE.fact}</span>
              </p>
              <button onClick={onPlay} className="sketch-btn-dark gap-2 px-5 h-12 text-sm shrink-0 focus-ring">
                Pick my topic <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Name a topic",
    body: "Anything you can type: Roman emperors, K-pop, the periodic table.",
    art: (
      <div className="flex flex-wrap gap-1.5">
        {["Greek myths", "Jazz", "Volcanoes"].map((t, i) => (
          <span key={t} className={`rounded-full border-2 border-ink bg-hl px-2.5 py-0.5 text-xs font-extrabold text-hl-ink ${i === 1 ? "-rotate-3" : ""}`}>{t}</span>
        ))}
      </div>
    ),
  },
  {
    title: "Get fresh questions",
    body: "AI writes a new set every round, with a joke and a fun fact behind every answer.",
    art: (
      <div className="notebook rounded-lg border-2 border-ink h-[3.25rem] [--rule-h:0.8rem] relative overflow-clip">
        <span className="absolute left-12 right-4 top-[0.35rem] h-1.5 rounded-full bg-ink/70" style={{ background: "var(--ink-soft)" }} />
        <span className="absolute left-12 right-10 top-[1.15rem] h-1.5 rounded-full" style={{ background: "var(--ink-soft)" }} />
        <span className="absolute left-12 w-16 top-[1.95rem] h-1.5 rounded-full" style={{ background: "var(--ink-ghost)" }} />
      </div>
    ),
  },
  {
    title: "Beat the clock",
    body: "Faster answers earn bonus points, and every answer gets marked on the spot.",
    art: (
      <div className="flex items-center gap-3">
        <TimerRing seconds={6} total={15} size={48} />
        <span className="font-hand text-3xl text-good -rotate-6">+24</span>
      </div>
    ),
  },
];

const LADDER: QuestionDifficulty[] = ["easy", "medium", "hard", "spartan"];

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [guest, setGuest] = useState<string | null>(null);
  const [gamesUsed, setGamesUsed] = useState(0);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [showGuestPrompt, setShowGuestPrompt] = useState<null | Mode>(null);
  const [guestErr, setGuestErr] = useState("");
  const [showLimitPrompt, setShowLimitPrompt] = useState(false);

  // Signed-in players go straight to their dashboard; this page is for
  // visitors and guests.
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/dashboard");
      return;
    }
    setMounted(true);
    setGuest(getGuestName());
    setGamesUsed(getGuestGamesPlayed());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePlay(mode: Mode) {
    if (guestMustRegister()) {
      setShowLimitPrompt(true);
      return;
    }
    if (guest) {
      router.push(`/${mode}`);
      return;
    }
    setGuestNameInput("");
    setGuestErr("");
    setShowGuestPrompt(mode);
  }

  function commitGuestAndPlay(mode: Mode) {
    const name = guestNameInput.trim();
    if (name.length < 2) { setGuestErr("Pick at least 2 characters."); return; }
    if (name.length > 20) { setGuestErr("Keep it under 20 characters."); return; }
    saveGuest(name);
    setGuest(name);
    setShowGuestPrompt(null);
    router.push(`/${mode}`);
  }

  if (!mounted) {
    return <div className="min-h-svh bg-paper" />;
  }

  const gamesLeft = Math.max(0, GUEST_GAME_LIMIT - gamesUsed);

  return (
    <div className="min-h-svh flex flex-col">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 h-16 border-b-2 border-ink bg-card">
        <div className="h-full max-w-6xl mx-auto flex items-center justify-between gap-2 px-4 sm:px-6">
          <span className="text-[28px]"><Logo /></span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => router.push("/login")} className="sketch-btn-light gap-1.5 px-3.5 h-10 text-sm focus-ring">
              <LogIn size={15} /> Sign in
            </button>
            <button onClick={() => router.push("/login?tab=register")} className="hidden sm:inline-flex sketch-btn-dark gap-1.5 px-3.5 h-10 text-sm focus-ring">
              <UserPlus size={15} /> Register
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ── Hero: the pitch on the left, a question you can answer on the right ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-20 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="[container-type:inline-size]">
            <motion.h1
              variants={fadeUp}
              className="font-heading text-ink leading-[0.98] text-[clamp(2.4rem,12.4cqi,5.75rem)]"
            >
              <span className="block">Quiz yourself</span>
              <span className="block">
                on{" "}
                <Highlight className="font-marker font-normal tracking-normal" delay={0.5}>anything.</Highlight>
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 max-w-md text-lg sm:text-xl font-semibold text-ink-soft leading-relaxed text-pretty">
              Type any topic and AI writes a fresh set of questions. Race the clock on your own, or race your friends in a live room.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row gap-3">
              <button onClick={() => handlePlay("solo")} className="sketch-btn-accent gap-2 px-6 h-14 text-base focus-ring">
                <Target size={18} /> Play solo <ArrowRight size={18} />
              </button>
              <button onClick={() => handlePlay("multiplayer")} className="sketch-btn-light gap-2 px-6 h-14 text-base focus-ring">
                <Users size={18} /> Play with friends
              </button>
            </motion.div>
            <motion.p variants={fadeUp} className="mt-4 text-sm font-bold text-ink-muted">
              {guest
                ? gamesLeft > 0
                  ? <>Playing as <span className="text-ink">{guest}</span> · {gamesLeft} free game{gamesLeft === 1 ? "" : "s"} left</>
                  : <>You&apos;ve used your free games. Register to keep playing, it&apos;s free.</>
                : <>No account needed for your first {GUEST_GAME_LIMIT} games.</>}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
            className="w-full max-w-xl mx-auto lg:mx-0"
          >
            <SampleQuestion onPlay={() => handlePlay("solo")} />
          </motion.div>
        </section>

        {/* ── How a round works: three steps joined by hand-drawn arrows ── */}
        <section className="border-y-2 border-ink bg-card">
          <motion.div {...reveal} variants={stagger(0.1)} className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <motion.h2 variants={fadeUp} className="font-heading text-ink text-[clamp(2rem,6vw,3.25rem)] leading-[1.05] max-w-2xl">
              From a topic to a marked quiz in three moves.
            </motion.h2>
            <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
              {STEPS.map((s, i) => (
                <motion.li key={s.title} variants={fadeUp} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="relative w-11 h-11 shrink-0 inline-flex items-center justify-center font-heading text-xl text-ink">
                      <MarkerLoop color="var(--ink)" strokeWidth={4} delay={0.2 + i * 0.15} className="inset-0 w-full h-full" />
                      {i + 1}
                    </span>
                    <h3 className="font-heading text-2xl text-ink">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-base font-semibold text-ink-soft leading-relaxed max-w-xs">{s.body}</p>
                  <div className="mt-5 max-w-[15rem]">{s.art}</div>
                  {i < STEPS.length - 1 && (
                    <DoodleArrow
                      delay={0.3 + i * 0.2}
                      className="hidden md:block absolute -right-10 top-1 w-16 h-8 text-ink-muted lg:-right-8"
                    />
                  )}
                </motion.li>
              ))}
            </ol>
          </motion.div>
        </section>

        {/* ── Two ways to play: two different objects, not two copies ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <motion.h2 {...reveal} variants={fadeUp} className="font-heading text-ink text-[clamp(2rem,6vw,3.25rem)] leading-[1.05]">
            Two ways to play.
          </motion.h2>
          <motion.div {...reveal} variants={stagger(0.1)} className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Lone Wolf */}
            <motion.button
              variants={fadeUp}
              onClick={() => handlePlay("solo")}
              className="group text-left sketch-card pressable p-6 sm:p-8 focus-ring flex flex-col"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-heading text-3xl sm:text-4xl text-ink">Lone Wolf</h3>
                  <p className="mt-1 font-hand text-2xl text-ink-muted">just you and the clock</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:flex items-center gap-1 rounded-full border-2 border-ink bg-hl px-2 py-0.5 text-sm font-extrabold text-hl-ink">
                    <Flame size={14} /> 4
                  </span>
                  <TimerRing seconds={8} total={15} size={52} />
                </div>
              </div>
              <ul className="mt-6 space-y-2 text-base font-semibold text-ink-soft">
                <li>3 to 20 questions a round</li>
                <li>Timer from 8 seconds to none at all</li>
                <li>Streaks and a bonus for fast answers</li>
              </ul>
              <span className="mt-8 inline-flex items-center gap-2 font-extrabold text-ink">
                Play solo <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            </motion.button>

            {/* Multiplayer, drawn as a ticket stub */}
            <motion.button
              variants={fadeUp}
              onClick={() => handlePlay("multiplayer")}
              className="group text-left sketch-card pressable p-0 focus-ring flex flex-col overflow-clip"
            >
              <div className="p-6 sm:p-8 pb-6 flex-1">
                <h3 className="font-heading text-3xl sm:text-4xl text-ink">Multiplayer</h3>
                <p className="mt-1 font-hand text-2xl text-ink-muted">same questions, one winner</p>
                <ul className="mt-6 space-y-2 text-base font-semibold text-ink-soft">
                  <li>Share a 6-letter room code</li>
                  <li>Everyone votes on the timer</li>
                  <li>Drop out and rejoin mid-game</li>
                </ul>
              </div>
              <div className="border-t-2 border-dashed border-ink bg-hl-soft px-6 sm:px-8 py-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold text-ink-muted">Room code</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black tracking-[0.25em] text-ink">K7Q2MX</p>
                </div>
                <span className="inline-flex items-center gap-2 font-extrabold text-ink shrink-0">
                  Host a room <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </motion.button>
          </motion.div>
        </section>

        {/* ── Difficulty: a staircase, each step worth more ── */}
        <section className="border-y-2 border-ink bg-card">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16 items-end">
            <motion.div {...reveal} variants={stagger(0.08)}>
              <motion.h2 variants={fadeUp} className="font-heading text-ink text-[clamp(2rem,6vw,3.25rem)] leading-[1.05]">
                Pick how hard it bites.
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-lg font-semibold text-ink-soft leading-relaxed max-w-md">
                Harder questions are worth more. Spartan pays triple, and it&apos;s meant to hurt.
              </motion.p>
            </motion.div>
            <motion.ol {...reveal} variants={stagger(0.1)} className="grid grid-cols-4 gap-2 sm:gap-4 items-end">
              {LADDER.map((d) => {
                const m = qDiffMultiplier(d);
                const top = d === "spartan";
                return (
                  <motion.li key={d} variants={fadeUp} className="flex flex-col">
                    <div
                      className={`rounded-xl border-2 border-ink flex flex-col items-center justify-start gap-1 pt-3 sm:pt-4 ${top ? "bg-hl text-hl-ink shadow-[4px_4px_0_var(--shadow)]" : "bg-paper text-ink"}`}
                      style={{ height: `${4.5 + m * 3.25}rem` }}
                    >
                      <span aria-hidden="true">{questionDifficultyIcon(d, 22)}</span>
                      <span className="font-heading text-2xl sm:text-3xl tabular-nums">{m}×</span>
                    </div>
                    <p className="mt-3 font-heading text-base sm:text-lg text-ink">{QUESTION_DIFFICULTY_CONFIG[d].label}</p>
                    <p className="hidden sm:block text-sm font-semibold text-ink-muted leading-snug">{QUESTION_DIFFICULTY_CONFIG[d].description}</p>
                  </motion.li>
                );
              })}
            </motion.ol>
          </div>
        </section>

        {/* ── Last call ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <motion.div {...reveal} variants={stagger(0.08)} className="flex flex-col items-center">
            <motion.h2 variants={fadeUp} className="font-heading text-ink text-[clamp(2.25rem,8vw,4.5rem)] leading-[1]">
              Got a topic in mind?
            </motion.h2>
            <motion.div variants={fadeUp} className="w-48 sm:w-64 mt-2">
              <Scribble delay={0.2} />
            </motion.div>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button onClick={() => handlePlay("solo")} className="sketch-btn-accent gap-2 px-7 h-14 text-base focus-ring">
                Start a quiz <ArrowRight size={18} />
              </button>
              <button onClick={() => router.push("/login?tab=register")} className="sketch-btn-light gap-2 px-7 h-14 text-base focus-ring">
                <UserPlus size={18} /> Create an account
              </button>
            </motion.div>
            <motion.p variants={fadeUp} className="mt-4 text-sm font-bold text-ink-muted">
              An account keeps your stats and lifts the {GUEST_GAME_LIMIT}-game limit.
            </motion.p>
          </motion.div>
        </section>
      </main>

      <footer className="border-t-2 border-ink bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-semibold text-ink-muted">
          <span className="text-2xl"><Logo /></span>
          <span className="flex items-center gap-1.5 text-center">
            <Sparkles size={14} className="shrink-0" /> Questions are written by AI, so double-check anything you&apos;d bet on.
          </span>
        </div>
      </footer>

      {/* Guest name prompt */}
      <Modal
        open={showGuestPrompt !== null}
        onClose={() => setShowGuestPrompt(null)}
        title="What should we call you?"
        subtitle={`${GUEST_GAME_LIMIT} free games, no account needed`}
        icon={<span className="font-marker text-xl">Q</span>}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); if (showGuestPrompt) commitGuestAndPlay(showGuestPrompt); }}
          className="space-y-4"
        >
          <input
            autoFocus
            type="text"
            value={guestNameInput}
            onChange={(e) => { setGuestNameInput(e.target.value); setGuestErr(""); }}
            maxLength={20}
            enterKeyHint="go"
            aria-label="Your name"
            placeholder="e.g. ShadowFox"
            className="w-full sketch-inset px-4 h-12 text-base text-ink placeholder-ink-ghost"
          />
          <Notice>{guestErr}</Notice>
          <button type="submit" className="w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
            Let&apos;s play <ArrowRight size={17} />
          </button>
          <p className="text-center text-sm font-semibold text-ink-muted">
            Have an account?{" "}
            <button type="button" onClick={() => router.push("/login")} className="tap-inline text-ink font-extrabold underline underline-offset-2 focus-ring rounded">
              Sign in
            </button>
          </p>
        </form>
      </Modal>

      {/* Trial used up */}
      <Modal
        open={showLimitPrompt}
        onClose={() => setShowLimitPrompt(false)}
        title="That's your free games"
        subtitle="Make a free account to keep playing"
        icon={<Sparkles size={20} />}
      >
        <p className="text-base font-semibold text-ink-soft leading-relaxed">
          You&apos;ve played {GUEST_GAME_LIMIT} games as a guest. With an account your stats stick around and there&apos;s no limit.
        </p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2.5">
          <button onClick={() => setShowLimitPrompt(false)} className="flex-1 sketch-btn-light h-12 text-sm focus-ring">
            Not now
          </button>
          <button onClick={() => router.push("/login?tab=register")} className="flex-1 sketch-btn-accent gap-2 h-12 text-sm focus-ring">
            <UserPlus size={16} /> Create account
          </button>
        </div>
      </Modal>
    </div>
  );
}
