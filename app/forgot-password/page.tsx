"use client";

import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { motion } from "framer-motion";
import { api, isLocalDev } from "@/lib/api";
import { EASE, fadeUp, stagger } from "@/lib/motion";
import AuthBar from "../components/AuthBar";
import Notice from "../components/Notice";
import { MarkerLoop } from "../components/Marks";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, Mail, Terminal } from "lucide-react";

type Step = "request" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api.forgotPassword(email);
      setNotice(res.message);
      setStep("reset");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!/^\d{6}$/.test(code.trim())) { setErr("The reset code is 6 digits."); return; }
    if (password.length < 8) { setErr("Passwords need at least 8 characters."); return; }
    if (password !== confirm) { setErr("Those passwords don't match."); return; }
    setBusy(true);
    try {
      await api.resetPassword(email, code.trim(), password);
      setStep("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: "request", label: "Email" },
    { key: "reset", label: "Code" },
    { key: "done", label: "Done" },
  ];
  const stepIndex = steps.findIndex((x) => x.key === step);

  return (
    <div className="min-h-svh flex flex-col">
      <AuthBar backHref="/login" backLabel="Sign in" />
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pt-4 pb-12">
        <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="w-full max-w-md">
          <motion.div variants={fadeUp}>
            <h1 className="font-heading text-4xl sm:text-5xl text-ink leading-none">Reset your password</h1>
            <p className="mt-2 font-hand text-2xl text-ink-muted">
              {step === "request" ? "we'll send a one-time code" : step === "reset" ? "enter the code, pick a new password" : "all sorted"}
            </p>
            <ol className="mt-5 flex items-center gap-2" aria-label="Progress">
              {steps.map((x, i) => (
                <li key={x.key} className="flex items-center gap-2">
                  <span
                    aria-current={i === stepIndex ? "step" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-sm font-extrabold ${
                      i === stepIndex ? "border-ink bg-hl text-hl-ink" : i < stepIndex ? "border-ink bg-card text-ink" : "border-line-soft text-ink-muted"
                    }`}
                  >
                    {i < stepIndex && <Check size={13} strokeWidth={3} />} {x.label}
                  </span>
                  {i < steps.length - 1 && <span aria-hidden="true" className="w-5 h-0.5 rounded-full" style={{ background: "var(--line-soft)" }} />}
                </li>
              ))}
            </ol>
          </motion.div>

          <motion.section variants={fadeUp} className="mt-6 sketch-card p-5 sm:p-7">
            {step === "done" ? (
              <div className="text-center py-4">
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                  <MarkerLoop duration={0.6} className="inset-0 w-full h-full" />
                  <Check size={36} strokeWidth={3} className="text-good" />
                </div>
                <p className="mt-5 text-base font-bold text-ink">Password updated. Sign in with the new one.</p>
                <button onClick={() => router.push("/login")} className="mt-6 w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
                  Sign in <ArrowRight size={18} />
                </button>
              </div>
            ) : step === "request" ? (
              <form onSubmit={handleRequest} className="space-y-4">
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
                <Notice>{err}</Notice>
                <button type="submit" disabled={busy} className="w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
                  {busy ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : <><Mail size={18} /> Send me a code</>}
                </button>
              </form>
            ) : (
              <motion.form
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                onSubmit={handleReset}
                className="space-y-4"
              >
                <Notice tone="info">{notice}</Notice>
                {isLocalDev() && (
                  <p className="flex items-start gap-2 rounded-xl border-2 border-dashed border-line-soft px-3.5 py-3 text-sm font-semibold text-ink-soft">
                    <Terminal size={16} className="shrink-0 mt-0.5" />
                    <span>Running Qrio locally? There&apos;s no email sender yet, so the code is printed in the backend terminal.</span>
                  </p>
                )}

                <div>
                  <label htmlFor="code" className="field-label mb-1.5">Reset code</label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    placeholder="123456"
                    className="w-full sketch-inset px-4 h-14 text-center font-mono text-3xl font-black tracking-[0.4em] text-ink placeholder-ink-ghost"
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="field-label mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
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

                <div>
                  <label htmlFor="confirm" className="field-label mb-1.5">Type it again</label>
                  <input
                    id="confirm"
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full sketch-inset px-4 h-12 text-base text-ink placeholder-ink-ghost"
                  />
                </div>

                <Notice>{err}</Notice>

                <button type="submit" disabled={busy} className="w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
                  {busy ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : <><KeyRound size={18} /> Update password</>}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("request"); setCode(""); setErr(""); }}
                  className="w-full h-10 text-sm font-bold text-ink-muted hover:text-ink focus-ring rounded-lg"
                >
                  Use a different email or get a new code
                </button>
              </motion.form>
            )}
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}
