"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getUser, isLoggedIn } from "@/lib/auth";
import { getStats, accuracy, topTopics, type Stats, type GameRecord } from "@/lib/stats";
import {
  Target, Users, ArrowRight, Bot, Crown,
  Check, X, BarChart2, Flame, BookOpen, Clock, Zap, Award,
} from "lucide-react";
import PageShell from "../components/PageShell";
import { fadeUp, scaleIn, stagger } from "@/lib/motion";

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="sketch-card-sm p-4 text-center"
    >
      {icon && <div className="flex justify-center mb-1.5 text-ink-muted">{icon}</div>}
      <div className="font-heading text-3xl text-ink leading-none">{value}</div>
      <div className="text-xs font-black text-ink-soft uppercase tracking-wider mt-1.5">{label}</div>
      {sub && <div className="text-xs text-ink-faint font-medium mt-0.5 leading-tight">{sub}</div>}
    </motion.div>
  );
}

function GameRow({ game }: { game: GameRecord }) {
  const date = new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const pct = game.totalQuestions > 0 ? Math.round((game.correctAnswers / game.totalQuestions) * 100) : 0;
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-3 px-4 py-3 hover:bg-card-soft transition-colors border-b border-line-faint last:border-0"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${game.type === "solo" ? "bg-ink" : "bg-blue-600"}`}>
        {game.type === "solo"
          ? <Target size={15} className="text-on-ink" />
          : <Users size={15} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ink truncate">{game.topics.join(", ")}</p>
        <p className="text-xs text-ink-faint font-medium">
          {game.correctAnswers}/{game.totalQuestions} correct · {pct}%
          {game.rank != null && ` · #${game.rank}/${game.totalPlayers}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-black text-ink tabular-nums">{game.score}<span className="text-ink-faint text-[10px] ml-0.5">pts</span></div>
        <div className="text-xs text-ink-faint">{date}</div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    setUser(getUser());
    setStats(getStats());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const acc = stats ? accuracy(stats) : 0;
  const topics = stats ? topTopics(stats, 5) : [];
  const recentGames = stats?.recentGames.slice(0, 5) ?? [];
  const totalGames = stats ? stats.soloGames + stats.multiplayerGames : 0;
  const hasStats = totalGames > 0;
  const winRate = stats && stats.multiplayerGames > 0
    ? Math.round((stats.multiplayerWins / stats.multiplayerGames) * 100)
    : 0;

  return (
    <PageShell>
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-8 sm:py-10 gap-10">

        {/* Mode picker */}
        <div className="w-full max-w-3xl">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-center mb-8"
          >
            <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl text-ink mb-2 leading-tight">
              How do you want to play?
            </h2>
            <p className="text-ink-muted text-base font-semibold">
              Choose your adventure{user?.username ? `, ${user.username}` : ""}
            </p>
          </motion.div>

          <motion.div
            variants={stagger(0.08)}
            initial="hidden"
            animate="show"
            className="grid sm:grid-cols-2 gap-5 sm:gap-6"
          >
            {/* Lone Wolf */}
            <motion.button
              variants={scaleIn}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/solo")}
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
                Solo challenge. Pick your topics, set your difficulty, and prove yourself against
                AI-generated questions. Your rules, your pace.
              </p>
              <div className="mt-6 flex items-center gap-2 font-black text-sm text-ink">
                <span>Play Solo</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            {/* Multiplayer */}
            <motion.button
              variants={scaleIn}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/multiplayer")}
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
                Challenge your friends in real-time! Create a room, share the code, vote on
                difficulty together, and see who reigns supreme.
              </p>
              <div className="mt-6 flex items-center gap-2 font-black text-sm text-ink">
                <span>Play Online</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          </motion.div>

          <p className="mt-8 text-ink-faint text-xs flex items-center justify-center gap-1.5">
            <Bot size={12} />
            Powered by AI · Questions generated fresh every time
          </p>
        </div>

        {/* Stats section */}
        {hasStats && stats && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="w-full max-w-3xl space-y-5"
          >
            <div className="flex items-center gap-2">
              <BarChart2 size={18} className="text-ink-soft" />
              <h3 className="font-heading text-2xl text-ink">Your Stats</h3>
            </div>

            <motion.div
              variants={stagger(0.05)}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <StatCard label="Total Games" value={totalGames} icon={<Zap size={16} />} />
              <StatCard label="Accuracy" value={`${acc}%`} sub={`${stats.totalCorrect}/${stats.totalQuestionsAnswered}`} icon={<Target size={16} />} />
              <StatCard label="MP Win Rate" value={stats.multiplayerGames > 0 ? `${winRate}%` : "—"} sub={`${stats.multiplayerWins} wins`} icon={<Crown size={16} />} />
              <StatCard label="Best Score" value={stats.bestScore || "—"} sub="Single game" icon={<Award size={16} />} />
            </motion.div>

            <div className="grid md:grid-cols-2 gap-5">
              {topics.length > 0 && (
                <motion.div variants={fadeUp} className="sketch-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b-2 border-ink flex items-center gap-2">
                    <Flame size={15} className="text-ink-soft" />
                    <h4 className="font-black text-sm text-ink uppercase tracking-wider">Favorite Topics</h4>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {topics.map(([topic, count], i) => {
                      const maxCount = topics[0][1];
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={topic}>
                          <div className="flex justify-between text-sm font-bold text-ink mb-1">
                            <span className="truncate">{topic}</span>
                            <span className="text-ink-muted font-medium ml-2 shrink-0">{count}×</span>
                          </div>
                          <div className="h-2 bg-card-soft border border-line-soft overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full bg-ink"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {recentGames.length > 0 && (
                <motion.div variants={fadeUp} className="sketch-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b-2 border-ink flex items-center gap-2">
                    <Clock size={15} className="text-ink-soft" />
                    <h4 className="font-black text-sm text-ink uppercase tracking-wider">Recent Games</h4>
                  </div>
                  <motion.div variants={stagger(0.05)}>
                    {recentGames.map((game, i) => <GameRow key={i} game={game} />)}
                  </motion.div>
                </motion.div>
              )}
            </div>

            <motion.div variants={fadeUp} className="sketch-card p-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <Check size={18} className="text-emerald-600" />
                <span className="font-heading text-2xl text-emerald-600">{stats.totalCorrect}</span>
                <span className="text-sm text-ink-muted font-bold">correct</span>
              </div>
              <div className="flex items-center gap-2">
                <X size={18} className="text-red-500" />
                <span className="font-heading text-2xl text-red-500">{stats.totalQuestionsAnswered - stats.totalCorrect}</span>
                <span className="text-sm text-ink-muted font-bold">wrong</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <BookOpen size={15} className="text-ink-faint" />
                <span className="text-sm text-ink-faint font-bold">{stats.totalQuestionsAnswered} questions total</span>
              </div>
            </motion.div>
          </motion.div>
        )}

        {stats && !hasStats && (
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-ink-faint text-sm font-medium"
          >
            Play a game to start tracking your stats.
          </motion.p>
        )}
      </div>
    </PageShell>
  );
}
