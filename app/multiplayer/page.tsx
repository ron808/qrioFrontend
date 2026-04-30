"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { hasUser } from "@/lib/auth";
import { QUESTION_DIFFICULTY_CONFIG, type QuestionDifficulty } from "@/lib/types";
import { fadeUp, scaleIn, stagger } from "@/lib/motion";
import PageShell from "../components/PageShell";
import {
  Users, DoorOpen, BookOpen, Hash, Brain,
  AlertTriangle, ArrowRight, Bot, Leaf, Target, Skull,
  Key, Timer,
} from "lucide-react";

function QuestionDifficultyIcon({ d }: { d: QuestionDifficulty }) {
  if (d === "easy") return <Leaf size={18} />;
  if (d === "medium") return <Target size={18} />;
  return <Skull size={18} />;
}

export default function MultiplayerPage() {
  const router = useRouter();
  useEffect(() => { if (!hasUser()) router.replace("/"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficulty>("medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  function addTag(raw: string) {
    const t = raw.trim().replace(/,+$/, "");
    if (t && !tags.includes(t) && tags.length < 10) setTags((p) => [...p, t]);
    setTagInput("");
  }
  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
    if (e.key === "Backspace" && !tagInput && tags.length) setTags((p) => p.slice(0, -1));
  }

  async function handleCreate() {
    if (tags.length === 0) { setCreateError("Add at least one topic!"); return; }
    setCreateError("");
    setCreating(true);
    try {
      const genRes = await api.generateQuestions(tags, count, questionDifficulty);
      const roomRes = await api.createRoom(genRes.questions, tags);
      sessionStorage.setItem(`qrio_questions_${roomRes.room_code}`, JSON.stringify(genRes.questions));
      sessionStorage.setItem(`qrio_host_${roomRes.room_code}`, "true");
      sessionStorage.setItem(`qrio_tags_${roomRes.room_code}`, JSON.stringify(tags));
      sessionStorage.setItem(`qrio_qdiff_${roomRes.room_code}`, questionDifficulty);
      router.push(`/room/${roomRes.room_code}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create room");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 6) { setJoinError("Enter a valid 6-character code"); return; }
    router.push(`/room/${code}`);
  }

  return (
    <PageShell title="Multiplayer" showBack>
      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8 sm:py-10">
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          animate="show"
          className="w-full max-w-4xl grid md:grid-cols-2 gap-5 sm:gap-6"
        >

          {/* Create a Room */}
          <motion.div variants={scaleIn} className="sketch-card p-5 sm:p-6 space-y-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center shrink-0">
                  <Users size={20} className="text-on-ink" />
                </div>
                <h2 className="font-heading text-2xl text-ink">Create a Room</h2>
              </div>
              <p className="text-ink-muted text-sm font-medium pl-1">Generate questions and host a game</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-2">
                <BookOpen size={13} /> Topics
              </label>
              <div
                className="flex flex-wrap gap-2 p-3 sketch-inset min-h-[52px] focus-within:border-ink cursor-text"
                onClick={() => document.getElementById("mp-tag-input")?.focus()}
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
                        ×
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                <input
                  id="mp-tag-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={() => tagInput.trim() && addTag(tagInput)}
                  placeholder={tags.length === 0 ? "Type a topic, press Enter…" : "Add more…"}
                  className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-ink placeholder-ink-ghost"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-2">
                <Hash size={13} /> Questions: <span className="text-ink ml-1">{count}</span>
              </label>
              <input
                type="range" min={3} max={20} value={count}
                onChange={(e) => setCount(+e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-ink-faint mt-1 font-medium">
                <span>3</span><span>20</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-1">
                <Brain size={13} /> Question Difficulty
              </label>
              <p className="text-xs text-ink-faint mb-2 font-medium">How hard should the AI make the questions?</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(QUESTION_DIFFICULTY_CONFIG) as QuestionDifficulty[]).map((d) => {
                  const cfg = QUESTION_DIFFICULTY_CONFIG[d];
                  const active = questionDifficulty === d;
                  return (
                    <motion.button
                      key={d}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setQuestionDifficulty(d)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 font-bold text-xs transition-colors duration-150 touch-manipulation focus-ring ${
                        active
                          ? cfg.activeClass
                          : "border-line-soft text-ink-muted bg-card hover:border-ink hover:text-ink"
                      }`}
                    >
                      <QuestionDifficultyIcon d={d} />
                      <span>{cfg.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-card-soft border-2 border-line-soft rounded-xl px-3 py-2 text-xs text-ink-muted font-medium">
              <Timer size={13} className="shrink-0" />
              Timer difficulty will be voted on by all players in the lobby
            </div>

            <AnimatePresence>
              {createError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 text-sm font-semibold"
                  style={{ boxShadow: "3px 3px 0px var(--shadow-soft)" }}
                >
                  <AlertTriangle size={14} className="shrink-0" />
                  {createError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              onClick={handleCreate}
              disabled={creating}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              className="w-full sketch-btn-dark gap-2 py-3.5 focus-ring"
            >
              {creating
                ? <><Bot size={16} className="animate-spin-slow" /> Generating &amp; Creating…</>
                : <>Create Room <ArrowRight size={15} /></>}
            </motion.button>
          </motion.div>

          {/* Join a Room */}
          <motion.div variants={scaleIn} className="sketch-card p-5 sm:p-6 flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center shrink-0">
                  <DoorOpen size={20} className="text-on-ink" />
                </div>
                <h2 className="font-heading text-2xl text-ink">Join a Room</h2>
              </div>
              <p className="text-ink-muted text-sm font-medium pl-1">Enter a room code from your friend</p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4 flex-1 flex flex-col">
              <div className="flex-1">
                <label className="flex items-center gap-2 text-xs font-black text-ink-soft uppercase tracking-widest mb-2">
                  <Key size={13} /> Room Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full sketch-inset px-5 py-4 text-ink placeholder-ink-ghost font-mono text-3xl tracking-[0.4em] uppercase text-center focus-ring"
                />
                <p className="text-xs text-ink-faint text-center mt-2 font-medium">6-character code</p>
              </div>

              <AnimatePresence>
                {joinError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 text-sm font-semibold text-center"
                    style={{ boxShadow: "3px 3px 0px var(--shadow-soft)" }}
                  >
                    <AlertTriangle size={14} className="shrink-0" />
                    {joinError}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -1 }}
                className="w-full sketch-btn-dark gap-2 py-3.5 focus-ring"
              >
                Join Room <ArrowRight size={15} />
              </motion.button>
            </form>
          </motion.div>

        </motion.div>
      </div>
    </PageShell>
  );
}
