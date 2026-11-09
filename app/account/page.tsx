"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getUser, isLoggedIn, saveAuth } from "@/lib/auth";
import { fadeUp, stagger } from "@/lib/motion";
import PageShell from "../components/PageShell";
import Notice from "../components/Notice";
import { Avatar } from "../components/Navbar";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

function PasswordField({
  id, label, value, onChange, show, onToggle, autoComplete, placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show?: boolean;
  onToggle?: () => void;
  autoComplete: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full sketch-inset pl-4 ${onToggle ? "pr-12" : "pr-4"} h-12 text-base text-ink placeholder-ink-ghost`}
        />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink transition-colors focus-ring"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

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
    if (newPw.length < 8) { setErr("The new password needs at least 8 characters."); return; }
    if (newPw !== confirm) { setErr("Those passwords don't match."); return; }
    if (newPw === oldPw) { setErr("Pick a password that\u2019s different from the current one."); return; }
    setBusy(true);
    try {
      const res = await api.changePassword(oldPw, newPw);
      if (user) saveAuth(res.token, user);
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
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="w-full max-w-xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-14 space-y-6"
      >
        <motion.section variants={fadeUp} className="sketch-card p-5 sm:p-7 flex items-center gap-4">
          <Avatar name={user?.username ?? "?"} size={56} />
          <div className="min-w-0">
            <h1 className="font-heading text-3xl text-ink truncate leading-tight">{user?.username}</h1>
            <p className="text-sm font-bold text-ink-muted truncate">{user?.email}</p>
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="sketch-card p-5 sm:p-7">
          <h2 className="font-heading text-2xl text-ink flex items-center gap-2"><KeyRound size={20} /> Change password</h2>
          <p className="mt-1 text-sm font-bold text-ink-muted">You&apos;ll stay signed in here. Other devices get signed out.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <PasswordField
              id="current" label="Current password" value={oldPw} onChange={setOldPw}
              show={showOld} onToggle={() => setShowOld((v) => !v)} autoComplete="current-password"
            />
            <PasswordField
              id="new" label="New password" value={newPw} onChange={setNewPw}
              show={showNew} onToggle={() => setShowNew((v) => !v)} autoComplete="new-password" placeholder="At least 8 characters"
            />
            <PasswordField
              id="confirm" label="Type it again" value={confirm} onChange={setConfirm}
              show={showNew} autoComplete="new-password"
            />
            <Notice>{err}</Notice>
            <Notice tone="success">{success ? "Password updated." : null}</Notice>
            <button type="submit" disabled={busy} className="w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : "Update password"}
            </button>
          </form>
        </motion.section>
      </motion.div>
    </PageShell>
  );
}
