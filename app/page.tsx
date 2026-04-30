"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { saveAuth, isLoggedIn, saveGuest } from "@/lib/auth";
import { fadeUp, scaleIn, stagger, bounceIn } from "@/lib/motion";
import ThemeToggle from "./components/ThemeToggle";
import {
  LogIn, UserPlus, Eye, EyeOff, AlertTriangle, Zap, ArrowRight,
} from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
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
    if (!name || name.length < 2) { setGuestError("Pick a name with at least 2 characters!"); return; }
    if (name.length > 20) { setGuestError("Keep it under 20 characters."); return; }
    saveGuest(name);
    router.push("/multiplayer");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Floating theme toggle */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="absolute top-4 right-4"
      >
        <ThemeToggle />
      </motion.div>

      <motion.div
        variants={stagger(0.1)}
        initial="hidden"
        animate="show"
        className="w-full max-w-md space-y-4"
      >

        {/* Logo */}
        <motion.div variants={bounceIn} className="text-center mb-8">
          <h1 className="font-marker text-7xl text-ink tracking-tight">Qrio</h1>
          <p className="text-ink-soft mt-2 text-sm font-semibold tracking-wide">
            Play. Compete. Learn. Together.
          </p>
        </motion.div>

        {/* Auth Card */}
        <motion.div variants={fadeUp} className="sketch-card p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all border-2 focus-ring ${
                  tab === t
                    ? "bg-ink text-on-ink border-ink shadow-[2px_2px_0_var(--shadow-soft)]"
                    : "bg-card text-ink-muted border-line-soft hover:border-ink hover:text-ink"
                }`}
              >
                {t === "login" ? <LogIn size={14} /> : <UserPlus size={14} />}
                {t === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full sketch-inset px-4 py-3 text-ink placeholder-ink-ghost text-sm focus-ring"
              />
            </div>

            <AnimatePresence initial={false}>
              {tab === "register" && (
                <motion.div
                  key="username"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                    placeholder="coolplayer99"
                    className="w-full sketch-inset px-4 py-3 text-ink placeholder-ink-ghost text-sm focus-ring"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={tab === "register" ? 8 : 1}
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  placeholder={tab === "register" ? "At least 8 characters" : "••••••••"}
                  className="w-full sketch-inset px-4 py-3 pr-12 text-ink placeholder-ink-ghost text-sm focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors p-1.5 focus-ring rounded-md"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 text-sm font-semibold"
                  style={{ boxShadow: "3px 3px 0px var(--shadow-soft)" }}
                >
                  <AlertTriangle size={15} className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              className="w-full sketch-btn-dark gap-2 py-3.5 text-sm focus-ring"
            >
              {loading
                ? "Just a sec..."
                : (
                  <>
                    {tab === "login" ? "Sign In" : "Create Account"}
                    <ArrowRight size={15} />
                  </>
                )}
            </motion.button>
          </form>
        </motion.div>

        {/* Divider */}
        <motion.div variants={fadeUp} className="flex items-center gap-3 px-2">
          <div className="flex-1 border-t-2 border-line-soft" />
          <span className="text-ink-faint text-xs uppercase tracking-wider font-black">or jump straight in</span>
          <div className="flex-1 border-t-2 border-line-soft" />
        </motion.div>

        {/* Guest Card */}
        <motion.div variants={scaleIn} className="sketch-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="w-11 h-11 bg-ink rounded-xl flex items-center justify-center shrink-0"
            >
              <Zap size={20} className="text-on-ink" />
            </motion.div>
            <div>
              <h3 className="font-heading text-xl text-ink font-bold">Play as Guest</h3>
              <p className="text-ink-faint text-xs">No account needed — pick a cool name</p>
            </div>
          </div>
          <form onSubmit={handleGuest} className="space-y-3">
            <input
              type="text"
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); setGuestError(""); }}
              maxLength={20}
              placeholder="e.g. ShadowFox, NeonBolt, ChaosQueen…"
              className="w-full sketch-inset px-4 py-3 text-ink placeholder-ink-ghost text-sm focus-ring"
            />
            <AnimatePresence>
              {guestError && (
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-600 dark:text-red-400 text-xs px-1 font-bold"
                >
                  {guestError}
                </motion.p>
              )}
            </AnimatePresence>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              className="w-full sketch-btn-dark gap-2 py-3.5 focus-ring"
            >
              Jump In <ArrowRight size={15} />
            </motion.button>
          </form>
        </motion.div>

      </motion.div>
    </div>
  );
}
