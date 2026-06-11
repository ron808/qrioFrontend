"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";
import { fadeUp, scaleIn, stagger } from "@/lib/motion";
import PageShell from "../components/PageShell";
import {
  KeyRound, Eye, EyeOff, AlertTriangle, Check, User as UserIcon, Mail, AtSign,
} from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    setUser(getUser());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSuccess(false);
    if (newPw.length < 8) { setErr("New password must be at least 8 characters"); return; }
    if (newPw !== confirm) { setErr("Passwords don't match"); return; }
    if (newPw === oldPw) { setErr("New password must differ from current password"); return; }
    setBusy(true);
    try {
      await api.changePassword(oldPw, newPw);
      setSuccess(true);
      setOldPw(""); setNewPw(""); setConfirm("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Account" showBack>
      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8 sm:py-10">
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          animate="show"
          className="w-full max-w-lg space-y-5"
        >

          <motion.div variants={scaleIn} className="sketch-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-ink rounded-xl flex items-center justify-center shrink-0">
                <UserIcon size={22} className="text-on-ink" />
              </div>
              <div>
                <h2 className="font-heading text-2xl text-ink">{user?.username}</h2>
                <p className="text-ink-muted text-xs font-medium">Your profile</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-ink-soft">
                <Mail size={14} className="text-ink-faint" />
                <span className="font-bold">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-ink-soft">
                <AtSign size={14} className="text-ink-faint" />
                <span className="font-bold">Username:</span>
                <span className="font-medium">{user?.username}</span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="sketch-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center shrink-0">
                <KeyRound size={18} className="text-on-ink" />
              </div>
              <div>
                <h3 className="font-heading text-xl text-ink">Change password</h3>
                <p className="text-ink-muted text-xs font-medium">Pick something strong</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showOld ? "text" : "password"}
                    value={oldPw}
                    onChange={(e) => setOldPw(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full sketch-inset px-4 py-3 pr-12 text-ink placeholder-ink-ghost text-sm focus-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1.5 focus-ring rounded-md"
                    aria-label={showOld ? "Hide password" : "Show password"}
                  >
                    {showOld ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="w-full sketch-inset px-4 py-3 pr-12 text-ink placeholder-ink-ghost text-sm focus-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1.5 focus-ring rounded-md"
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-ink-soft uppercase tracking-widest mb-1.5">
                  Confirm new password
                </label>
                <input
                  type={showNew ? "text" : "password"}
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
                    className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 text-sm font-semibold"
                    style={{ boxShadow: "3px 3px 0px var(--shadow-soft)" }}
                  >
                    <AlertTriangle size={15} className="shrink-0" />
                    {err}
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-xl px-4 py-3 text-emerald-700 dark:text-emerald-300 text-sm font-semibold"
                    style={{ boxShadow: "3px 3px 0px var(--accent-emerald)" }}
                  >
                    <Check size={15} className="shrink-0" />
                    Password updated.
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
                {busy ? "Updating…" : "Update password"}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </PageShell>
  );
}
