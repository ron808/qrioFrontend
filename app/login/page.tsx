"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { saveAuth, isLoggedIn, saveGuest, GUEST_GAME_LIMIT } from "@/lib/auth";
import { adoptGuestStats } from "@/lib/stats";
import { EASE, fadeUp, stagger } from "@/lib/motion";
import AuthBar from "../components/AuthBar";
import Logo from "../components/Logo";
import Notice from "../components/Notice";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-paper" />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const initialTab = search.get("tab") === "register" ? "register" : "login";
  const trialUsed = search.get("reason") === "trial_used";
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState("");

  useEffect(() => {
    if (isLoggedIn()) router.replace("/dashboard");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        tab === "login"
          ? await api.login(email, password)
          : await api.register(email, username, password);
      saveAuth(res.token, res.user);
      // A guest who signs up keeps the games they just played.
      if (tab === "register") adoptGuestStats(res.user.id);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleGuest(e: React.FormEvent) {
    e.preventDefault();
    const name = guestName.trim();
    if (!name || name.length < 2) { setGuestError("Pick a name with at least 2 characters."); return; }
    if (name.length > 20) { setGuestError("Keep it under 20 characters."); return; }
    saveGuest(name);
    router.push("/");
  }

  return (
    <div className="min-h-svh flex flex-col">
      <AuthBar />
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pt-4 pb-12">
        <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="w-full max-w-md">
          <motion.div variants={fadeUp} className="text-center">
            <span className="text-6xl sm:text-7xl"><Logo /></span>
            <p className="mt-3 font-hand text-2xl text-ink-muted">
              {tab === "login" ? "welcome back" : "keep your stats, play without limits"}
            </p>
          </motion.div>

          {trialUsed && (
            <motion.div variants={fadeUp} className="mt-6">
              <Notice tone="info">You&apos;ve used your free guest games. Make a free account to keep playing.</Notice>
            </motion.div>
          )}

          <motion.section variants={fadeUp} className="mt-6 sketch-card p-5 sm:p-7">
            {/* Sign in / Register switch */}
            <div role="tablist" className="relative grid grid-cols-2 rounded-xl border-2 border-ink p-1" style={{ background: "var(--inset)" }}>
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => { setTab(t); setError(""); }}
                  className={`relative z-10 h-10 rounded-lg text-sm font-extrabold transition-colors focus-ring ${tab === t ? "text-hl-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {tab === t && (
                    <motion.span
                      layoutId="auth-tab"
                      transition={{ duration: 0.3, ease: EASE }}
                      className="absolute inset-0 -z-10 rounded-lg border-2 border-ink bg-hl"
                    />
                  )}
                  {t === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="field-label mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full sketch-inset px-4 h-12 text-base text-ink placeholder-ink-ghost"
                />
              </div>

              <AnimatePresence initial={false}>
                {tab === "register" && (
                  <motion.div
                    key="username"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-clip"
                  >
                    <label htmlFor="username" className="field-label mb-1.5">Username</label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      placeholder="What friends see in rooms"
                      className="w-full sketch-inset px-4 h-12 text-base text-ink placeholder-ink-ghost"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="field-label">Password</label>
                  {tab === "login" && (
                    <button
                      type="button"
                      onClick={() => router.push("/forgot-password")}
                      className="tap-inline text-sm font-bold text-ink-muted hover:text-ink underline-offset-2 hover:underline focus-ring rounded"
                    >
                      Forgot it?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={tab === "register" ? 8 : 1}
                    autoComplete={tab === "register" ? "new-password" : "current-password"}
                    placeholder={tab === "register" ? "At least 8 characters" : "Your password"}
                    className="w-full sketch-inset pl-4 pr-12 h-12 text-base text-ink placeholder-ink-ghost"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink transition-colors focus-ring"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Notice>{error}</Notice>

              <button type="submit" disabled={loading} className="w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
                {loading
                  ? <><Loader2 size={18} className="animate-spin" /> One sec…</>
                  : <>{tab === "login" ? "Sign in" : "Create account"} <ArrowRight size={18} /></>}
              </button>
            </form>
          </motion.section>

          {!trialUsed && (
            <motion.section variants={fadeUp} className="mt-6 rounded-2xl border-2 border-dashed border-ink p-5 sm:p-6">
              <h2 className="font-heading text-xl text-ink">Just want to play?</h2>
              <p className="mt-1 text-sm font-bold text-ink-muted">Pick a name. {GUEST_GAME_LIMIT} free games, no account.</p>
              <form onSubmit={handleGuest} className="mt-4 flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setGuestError(""); }}
                  maxLength={20}
                  aria-label="Guest name"
                  placeholder="e.g. ShadowFox"
                  className="w-full sm:flex-1 min-w-0 sketch-inset px-4 h-12 text-base text-ink placeholder-ink-ghost"
                />
                <button type="submit" className="sketch-btn-dark gap-2 h-12 px-5 text-base shrink-0 focus-ring">
                  Jump in <ArrowRight size={17} />
                </button>
              </form>
              <Notice className="mt-3">{guestError}</Notice>
            </motion.section>
          )}
        </motion.div>
      </main>
    </div>
  );
}
