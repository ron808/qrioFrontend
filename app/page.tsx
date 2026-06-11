"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Users, Target, Zap, ArrowRight, Bot, BookOpen, Trophy, Clock,
  LogIn, UserPlus, Sparkles, Swords, AlertTriangle,
} from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";
import {
  isLoggedIn,
  getGuestName,
  saveGuest,
  getGuestGamesPlayed,
  guestMustRegister,
  GUEST_GAME_LIMIT,
} from "@/lib/auth";
import { fadeUp, scaleIn, stagger, bounceIn } from "@/lib/motion";

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [guest, setGuest] = useState<string | null>(null);
  const [gamesUsed, setGamesUsed] = useState(0);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [showGuestPrompt, setShowGuestPrompt] = useState<null | "solo" | "multiplayer">(null);
  const [guestErr, setGuestErr] = useState("");
  const [showLimitPrompt, setShowLimitPrompt] = useState(false);

  // Auto-bounce signed-in users straight to their dashboard. The landing page
  // is for unauthenticated visitors.
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/dashboard");
      return;
    }
    setMounted(true);
    setLoggedIn(false);
    setGuest(getGuestName());
    setGamesUsed(getGuestGamesPlayed());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePlay(mode: "solo" | "multiplayer") {
    // Trial cap → push the user toward registering.
    if (!loggedIn && guestMustRegister()) {
      setShowLimitPrompt(true);
      return;
    }
    // Already have a guest name → just go.
    if (loggedIn || guest) {
      router.push(`/${mode}`);
      return;
    }
    // First-time guest → ask for a name first.
    setGuestNameInput("");
    setGuestErr("");
    setShowGuestPrompt(mode);
  }

  function commitGuestAndPlay(mode: "solo" | "multiplayer") {
    const name = guestNameInput.trim();
    if (name.length < 2) { setGuestErr("Pick at least 2 characters"); return; }
    if (name.length > 20) { setGuestErr("Keep it under 20 characters"); return; }
    saveGuest(name);
    setGuest(name);
    setShowGuestPrompt(null);
    router.push(`/${mode}`);
  }

  if (!mounted) {
    return <div className="min-h-screen bg-paper" />;
  }

  const gamesLeft = Math.max(0, GUEST_GAME_LIMIT - gamesUsed);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navbar */}
      <motion.nav
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b-2 border-ink bg-card/95 backdrop-blur-sm"
      >
        <div className="font-marker text-2xl sm:text-3xl text-ink leading-none">Qrio</div>
        <div className="flex items-center gap-2">
          {guest && (
            <span className="hidden sm:inline-flex items-center gap-1.5 sketch-card-sm px-3 py-1.5">
              <Zap size={13} className="text-ink-muted" />
              <span className="text-xs font-bold text-ink truncate max-w-[120px]">{guest}</span>
            </span>
          )}
          <ThemeToggle />
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -1 }}
            onClick={() => router.push("/login")}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border-2 border-line-soft text-ink hover:border-ink bg-card focus-ring"
          >
            <LogIn size={14} /> Sign In
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -1 }}
            onClick={() => router.push("/login?tab=register")}
            className="inline-flex items-center gap-1.5 sketch-btn-dark px-3 py-2 text-sm focus-ring"
          >
            <UserPlus size={14} /> Register
          </motion.button>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section
        variants={stagger(0.1)}
        initial="hidden"
        animate="show"
        className="px-4 sm:px-6 pt-12 sm:pt-20 pb-10 text-center"
      >
        <motion.div variants={bounceIn} className="inline-flex items-center gap-1.5 bg-card border-2 border-ink rounded-full px-3 py-1 mb-5 text-xs font-black text-ink uppercase tracking-wider"
          style={{ boxShadow: "2px 2px 0px var(--shadow)" }}>
          <Sparkles size={12} className="text-amber-500" />
          AI-powered · Free to play
        </motion.div>
        <motion.h1
          variants={bounceIn}
          className="font-marker text-6xl sm:text-7xl md:text-8xl text-ink tracking-tight leading-none"
        >
          Qrio
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="mt-4 text-ink-soft text-lg sm:text-xl font-semibold max-w-xl mx-auto"
        >
          Pick any topic. Beat the clock. Out-trivia your friends. Fresh
          AI-generated questions every game.
        </motion.p>

        {/* Guest trial counter */}
        {guest && !loggedIn && (
          <motion.div
            variants={fadeUp}
            className="mt-6 inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500 rounded-full px-3 py-1.5 text-xs font-black text-amber-800 dark:text-amber-300"
            style={{ boxShadow: "2px 2px 0px var(--accent-amber)" }}
          >
            {gamesLeft > 0
              ? <>Playing as {guest} · {gamesLeft} free game{gamesLeft === 1 ? "" : "s"} left</>
              : <>You&apos;ve used your free games — register to keep playing</>
            }
          </motion.div>
        )}
      </motion.section>

      {/* Play options */}
      <motion.section
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="px-4 sm:px-6 pb-12"
      >
        <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-5">
          {/* Lone Wolf */}
          <motion.button
            variants={scaleIn}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePlay("solo")}
            className="group sketch-card p-6 sm:p-8 text-left transition-shadow duration-150 hover:shadow-[6px_6px_0_var(--shadow)] focus-ring"
          >
            <motion.div
              animate={{ rotate: [0, 0, -3, 3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="w-14 h-14 sm:w-16 sm:h-16 bg-ink rounded-xl flex items-center justify-center mb-5"
            >
              <Target size={28} className="text-on-ink" />
            </motion.div>
            <h3 className="font-heading text-3xl text-ink mb-2">Lone Wolf</h3>
            <p className="text-ink-soft text-sm leading-relaxed">
              Solo challenge. Pick your topics, set your difficulty, prove yourself.
            </p>
            <div className="mt-5 flex items-center gap-2 font-black text-sm text-ink">
              <span>Play Solo</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>

          {/* Multiplayer */}
          <motion.button
            variants={scaleIn}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePlay("multiplayer")}
            className="group sketch-card p-6 sm:p-8 text-left transition-shadow duration-150 hover:shadow-[6px_6px_0_var(--shadow)] focus-ring"
          >
            <motion.div
              animate={{ rotate: [0, 3, -3, 0, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="w-14 h-14 sm:w-16 sm:h-16 bg-ink rounded-xl flex items-center justify-center mb-5"
            >
              <Users size={28} className="text-on-ink" />
            </motion.div>
            <h3 className="font-heading text-3xl text-ink mb-2">Multiplayer</h3>
            <p className="text-ink-soft text-sm leading-relaxed">
              Real-time, room-code based. Vote on timer. See live scores.
            </p>
            <div className="mt-5 flex items-center gap-2 font-black text-sm text-ink">
              <span>Play Online</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        </div>
      </motion.section>

      {/* How it works */}
      <motion.section
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        viewport={{ once: true, amount: 0.3 }}
        className="px-4 sm:px-6 py-12 border-t-2 border-ink bg-card-soft"
      >
        <div className="max-w-3xl mx-auto">
          <motion.h2
            variants={fadeUp}
            className="font-heading text-3xl sm:text-4xl text-ink text-center mb-2"
          >
            How it works
          </motion.h2>
          <motion.p variants={fadeUp} className="text-center text-ink-muted text-sm font-medium mb-8">
            Three simple steps from idle thought to leaderboard victory
          </motion.p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: <BookOpen size={22} />, title: "Pick a topic", body: "Type anything — history, NBA, anime, your favourite movie." },
              { icon: <Bot       size={22} />, title: "AI cooks questions", body: "Fresh multiple-choice questions, tailored to your difficulty." },
              { icon: <Trophy    size={22} />, title: "Beat the timer", body: "Score points. Climb the leaderboard. Re-match in one click." },
            ].map((step, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="sketch-card-sm p-5 text-center"
              >
                <div className="w-12 h-12 mx-auto bg-ink rounded-xl flex items-center justify-center text-on-ink mb-3">
                  {step.icon}
                </div>
                <h3 className="font-heading text-xl text-ink mb-1">{step.title}</h3>
                <p className="text-ink-muted text-sm font-medium">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Feature grid */}
      <motion.section
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        viewport={{ once: true, amount: 0.3 }}
        className="px-4 sm:px-6 py-12 border-t-2 border-ink"
      >
        <div className="max-w-3xl mx-auto">
          <motion.h2
            variants={fadeUp}
            className="font-heading text-3xl sm:text-4xl text-ink text-center mb-8"
          >
            Why Qrio?
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: <Brain  size={20} className="text-blue-600 dark:text-blue-400" />, title: "Truly endless quizzes",   body: "No question bank to run out. AI writes them on demand." },
              { icon: <Swords size={20} className="text-purple-600 dark:text-purple-400" />, title: "Four difficulty tiers", body: "Easy, Medium, Hard, and Spartan — for the truly merciless." },
              { icon: <Users  size={20} className="text-emerald-600 dark:text-emerald-400" />, title: "Real-time multiplayer", body: "Share a room code. Vote on timer. Rejoin mid-game if you drop." },
              { icon: <Clock  size={20} className="text-amber-600 dark:text-amber-400" />, title: "Speed bonuses", body: "Faster answers, more points. Streaks tracked across rounds." },
            ].map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="sketch-card p-5 flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-card-soft border-2 border-line-soft flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-heading text-xl text-ink leading-tight">{f.title}</h3>
                  <p className="text-ink-muted text-sm font-medium mt-1">{f.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Footer CTA */}
      <motion.section
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        viewport={{ once: true, amount: 0.3 }}
        className="px-4 sm:px-6 py-12 border-t-2 border-ink bg-card-soft text-center"
      >
        <motion.h2 variants={fadeUp} className="font-heading text-3xl sm:text-4xl text-ink mb-3">
          Ready to play?
        </motion.h2>
        <motion.p variants={fadeUp} className="text-ink-muted text-sm font-medium mb-6">
          {loggedIn ? "Jump back in." : "Free to try — no card required. Register to save your stats."}
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            onClick={() => handlePlay("multiplayer")}
            className="sketch-btn-dark gap-2 px-6 py-3.5 focus-ring"
          >
            Start Playing <ArrowRight size={15} />
          </motion.button>
          {!loggedIn && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              onClick={() => router.push("/login?tab=register")}
              className="sketch-btn-light gap-2 px-6 py-3.5 focus-ring"
            >
              <UserPlus size={15} /> Create Account
            </motion.button>
          )}
        </motion.div>
        <p className="mt-6 text-ink-faint text-xs flex items-center justify-center gap-1.5">
          <Bot size={12} />
          Powered by AI · Questions generated fresh every time
        </p>
      </motion.section>

      {/* Guest name prompt modal */}
      <AnimatePresence>
        {showGuestPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowGuestPrompt(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="sketch-card p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-ink rounded-xl flex items-center justify-center">
                  <Zap size={20} className="text-on-ink" />
                </div>
                <div>
                  <h3 className="font-heading text-xl text-ink">Pick a name</h3>
                  <p className="text-ink-muted text-xs font-medium">
                    {GUEST_GAME_LIMIT} free games · no account needed
                  </p>
                </div>
              </div>
              <input
                autoFocus
                type="text"
                value={guestNameInput}
                onChange={(e) => { setGuestNameInput(e.target.value); setGuestErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") commitGuestAndPlay(showGuestPrompt); }}
                maxLength={20}
                placeholder="e.g. ShadowFox"
                className="w-full sketch-inset px-4 py-3 text-ink placeholder-ink-ghost text-sm focus-ring"
              />
              {guestErr && (
                <p className="text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {guestErr}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGuestPrompt(null)}
                  className="flex-1 sketch-btn-light py-3 text-sm focus-ring"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -1 }}
                  onClick={() => commitGuestAndPlay(showGuestPrompt)}
                  className="flex-1 sketch-btn-dark gap-2 py-3 text-sm focus-ring"
                >
                  Play <ArrowRight size={14} />
                </motion.button>
              </div>
              <p className="text-center text-xs text-ink-faint font-medium">
                or{" "}
                <button
                  onClick={() => router.push("/login")}
                  className="text-ink font-bold underline focus-ring rounded-md"
                >
                  sign in
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trial-cap modal */}
      <AnimatePresence>
        {showLimitPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowLimitPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="sketch-card p-6 w-full max-w-sm space-y-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 mx-auto bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-500 rounded-xl flex items-center justify-center"
                   style={{ boxShadow: "3px 3px 0px var(--accent-amber)" }}>
                <Sparkles size={26} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-heading text-2xl text-ink">Free games used up</h3>
                <p className="text-ink-muted text-sm font-medium mt-1">
                  You&apos;ve played {GUEST_GAME_LIMIT} free games. Create an account to keep going — it&apos;s free and your stats stick.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLimitPrompt(false)}
                  className="flex-1 sketch-btn-light py-3 text-sm focus-ring"
                >
                  Not yet
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -1 }}
                  onClick={() => router.push("/login?tab=register")}
                  className="flex-1 sketch-btn-dark gap-2 py-3 text-sm focus-ring"
                >
                  <UserPlus size={14} /> Register
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
