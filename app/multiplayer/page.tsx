"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { hasUser, getUsername, guestMustRegister } from "@/lib/auth";
import { type QuestionDifficulty } from "@/lib/types";
import { fadeUp, stagger } from "@/lib/motion";
import PageShell from "../components/PageShell";
import Notice from "../components/Notice";
import { ChoiceGrid, CountSlider, TopicInput, QUESTION_DIFFICULTY_CHOICES } from "../components/QuizSettings";
import { ArrowRight, Loader2, Timer } from "lucide-react";

export default function MultiplayerPage() {
  const router = useRouter();
  useEffect(() => {
    if (!hasUser()) { router.replace("/"); return; }
    if (guestMustRegister()) { router.replace("/login?reason=trial_used"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficulty>("medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  async function handleCreate() {
    if (tags.length === 0) { setCreateError("Add at least one topic first."); return; }
    const username = getUsername();
    if (!username) { setCreateError("Pick a name first"); return; }
    setCreateError("");
    setCreating(true);
    try {
      const roomRes = await api.createRoom(tags, count, username, questionDifficulty);
      router.push(`/room/${roomRes.room_code}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create room");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 6) { setJoinError("Room codes are 6 characters."); return; }
    router.push(`/room/${code}`);
  }

  return (
    <PageShell title="Multiplayer" showBack>
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-14"
      >
        <motion.h1 variants={fadeUp} className="font-heading text-4xl sm:text-5xl text-ink leading-none">
          Play with friends
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-2 font-hand text-2xl text-ink-muted">
          same questions, same clock, one winner
        </motion.p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 lg:gap-8 items-start">
          {/* Join: the quick path, first on phones */}
          <motion.section variants={fadeUp} className="lg:order-2 lg:sticky lg:top-24 sketch-card overflow-clip">
            <form onSubmit={handleJoin} className="p-5 sm:p-7">
              <h2 className="font-heading text-2xl text-ink">Got a code?</h2>
              <p className="mt-1 text-sm font-bold text-ink-muted">Type the 6 characters your friend sent.</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setJoinError(""); }}
                placeholder="ABC123"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Room code"
                className="mt-4 w-full sketch-inset h-16 px-4 text-center font-mono text-3xl sm:text-4xl font-black uppercase tracking-[0.35em] text-ink placeholder-ink-ghost"
              />
              <Notice className="mt-3">{joinError}</Notice>
              <button type="submit" className="mt-4 w-full sketch-btn-dark gap-2 h-12 text-base focus-ring">
                Join room <ArrowRight size={18} />
              </button>
            </form>
          </motion.section>

          {/* Host */}
          <motion.section variants={fadeUp} className="lg:order-1 sketch-card p-5 sm:p-7">
            <h2 className="font-heading text-2xl text-ink">Host a room</h2>
            <p className="mt-1 text-sm font-bold text-ink-muted">Pick the quiz, then share the code.</p>
            <div className="mt-6 space-y-7">
              <TopicInput tags={tags} onChange={(t) => { setTags(t); setCreateError(""); }} />
              <hr className="border-t-2 border-dashed border-line-soft" />
              <CountSlider value={count} onChange={setCount} />
              <ChoiceGrid
                label="Question difficulty"
                hint="Harder questions are worth more."
                options={QUESTION_DIFFICULTY_CHOICES}
                value={questionDifficulty}
                onChange={setQuestionDifficulty}
              />
              <p className="flex items-center gap-2 rounded-xl border-2 border-dashed border-line-soft px-3.5 py-3 text-sm font-bold text-ink-soft">
                <Timer size={16} className="shrink-0" /> Everyone votes on the timer in the lobby.
              </p>
              <Notice>{createError}</Notice>
              <button onClick={handleCreate} disabled={creating} className="w-full sketch-btn-accent gap-2 h-14 text-lg focus-ring">
                {creating
                  ? <><Loader2 size={20} className="animate-spin" /> Writing questions…</>
                  : <>Create room <ArrowRight size={20} /></>}
              </button>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </PageShell>
  );
}
