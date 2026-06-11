"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { fadeUp, scaleIn, stagger, bounceIn } from "@/lib/motion";
import ThemeToggle from "../components/ThemeToggle";
import {
  KeyRound, Eye, EyeOff, AlertTriangle, ArrowRight, Check, ArrowLeft,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) { setErr("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setErr("Passwords don't match"); return; }
    setBusy(true);
    try {
      await api.forgotPassword(email, password);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
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
        <motion.div variants={bounceIn} className="text-center mb-4">
          <h1 className="font-marker text-5xl text-ink tracking-tight">Reset</h1>
          <p className="text-ink-soft mt-2 text-sm font-semibold">
            Enter your email and a new password
          </p>
        </motion.div>

        <motion.div variants={scaleIn} className="sketch-card p-6 space-y-4">
          {done ? (
            <div className="text-center space-y-4 py-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl flex items-center justify-center mx-auto"
                style={{ boxShadow: "4px 4px 0px var(--accent-emerald)" }}
              >
                <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <p className="text-ink font-bold">
                If that email is registered, the password has been updated.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/login")}
                className="sketch-btn-dark gap-2 px-6 py-3 focus-ring"
              >
                Sign in <ArrowRight size={14} />
              </motion.button>
            </div>
          ) : (
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

              <div>
                <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
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

              <div>
                <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  className="w-full sketch-inset px-4 py-3 text-ink placeholder-ink-ghost text-sm focus-ring"
                />
              </div>

              <AnimatePresence>
                {err && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 text-sm font-semibold"
                    style={{ boxShadow: "3px 3px 0px var(--shadow-soft)" }}
                  >
                    <AlertTriangle size={15} className="shrink-0" />
                    {err}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={busy}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -1 }}
                className="w-full sketch-btn-dark gap-2 py-3.5 text-sm focus-ring"
              >
                {busy ? "Updating…" : <><KeyRound size={15} /> Update Password</>}
              </motion.button>
            </form>
          )}
        </motion.div>

        <motion.div variants={fadeUp} className="text-center">
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink transition-colors text-sm font-bold focus-ring rounded-md px-2 py-1"
          >
            <ArrowLeft size={14} /> Back to sign in
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
