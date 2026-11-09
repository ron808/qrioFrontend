"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { motion } from "framer-motion";
import { getUser, isLoggedIn } from "@/lib/auth";
import { getStats, accuracy, topTopics, type Stats, type GameRecord } from "@/lib/stats";
import { ArrowRight, CalendarDays, Flame, Target, Users } from "lucide-react";
import { topicOfTheDay } from "@/lib/fun";
import PageShell from "../components/PageShell";
import { MarkerLoop } from "../components/Marks";
import { TimerRing } from "../components/GameUI";
import { EASE, fadeUp, stagger } from "@/lib/motion";

function GameRow({ game }: { game: GameRecord }) {
  const date = new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const pct = game.totalQuestions > 0 ? Math.round((game.correctAnswers / game.totalQuestions) * 100) : 0;
  return (
    <li className="flex items-center gap-3 px-5 py-3.5 border-b-2 border-line-faint last:border-0">
      <span
        className={`w-9 h-9 shrink-0 rounded-full border-2 border-ink flex items-center justify-center ${game.type === "solo" ? "bg-card text-ink" : "bg-hl text-hl-ink"}`}
        aria-label={game.type === "solo" ? "Solo game" : "Multiplayer game"}
      >
        {game.type === "solo" ? <Target size={16} /> : <Users size={16} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-ink truncate">{game.topics.join(", ")}</p>
        <p className="text-xs font-bold text-ink-muted">
          {game.correctAnswers}/{game.totalQuestions} right · {pct}%
          {game.rank != null && ` · ${game.rank === 1 ? "won" : `#${game.rank} of ${game.totalPlayers}`}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-heading text-lg text-ink tabular-nums leading-none">{game.score}</p>
        <p className="mt-1 text-xs font-bold text-ink-muted">{date}</p>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [code, setCode] = useState("");
  // Depends on the local date, so it's worked out in the browser.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    setUser(getUser());
    setStats(getStats());
    setToday(topicOfTheDay());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const acc = stats ? accuracy(stats) : 0;
  const topics = stats ? topTopics(stats, 5) : [];
  const recentGames = stats?.recentGames.slice(0, 5) ?? [];
  const totalGames = stats ? stats.soloGames + stats.multiplayerGames : 0;
  const hasStats = totalGames > 0;

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length === 6) router.push(`/room/${c}`);
  }

  return (
    <PageShell>
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-14"
      >
        <motion.p variants={fadeUp} className="font-hand text-2xl sm:text-3xl text-ink-muted">
          hey {user?.username ?? "there"},
        </motion.p>
        <motion.h1 variants={fadeUp} className="font-heading text-ink text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.95]">
          What are we playing?
        </motion.h1>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lone Wolf */}
          <motion.button
            variants={fadeUp}
            onClick={() => router.push("/solo")}
            className="group text-left sketch-card pressable p-6 sm:p-7 focus-ring flex flex-col"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl text-ink">Lone Wolf</h2>
                <p className="mt-1 text-base font-semibold text-ink-soft">Pick a topic, set the clock, chase your best score.</p>
              </div>
              <TimerRing seconds={8} total={15} size={52} />
            </div>
            <span className="mt-auto pt-6 inline-flex items-center gap-2 font-extrabold text-ink">
              Play solo <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </span>
          </motion.button>

          {/* Multiplayer: host, or join with a code right here */}
          <motion.section variants={fadeUp} className="sketch-card overflow-clip flex flex-col">
            <button onClick={() => router.push("/multiplayer")} className="group text-left p-6 sm:p-7 flex-1 focus-ring">
              <h2 className="font-heading text-3xl text-ink">Multiplayer</h2>
              <p className="mt-1 text-base font-semibold text-ink-soft">Host a room and race your friends on the same questions.</p>
              <span className="mt-6 inline-flex items-center gap-2 font-extrabold text-ink">
                Host a room <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
            <form onSubmit={join} className="border-t-2 border-dashed border-ink bg-hl-soft px-6 sm:px-7 py-4 flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                maxLength={6}
                placeholder="Room code"
                aria-label="Room code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                className="min-w-0 flex-1 sketch-inset h-11 px-3 font-mono text-lg font-black uppercase tracking-[0.25em] text-ink placeholder:font-body placeholder:normal-case placeholder:tracking-normal placeholder:text-sm placeholder:font-bold placeholder-ink-ghost"
              />
              <button type="submit" disabled={code.length !== 6} className="sketch-btn-dark gap-1.5 h-11 px-4 text-sm shrink-0 focus-ring">
                Join <ArrowRight size={16} />
              </button>
            </form>
          </motion.section>
        </div>

        {/* Topic of the day: one tap into a solo game */}
        {today && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease: EASE }}
            onClick={() => router.push(`/solo?topic=${encodeURIComponent(today)}`)}
            className="group mt-6 w-full text-left sketch-card pressable p-5 sm:p-6 flex items-center gap-4 sm:gap-6 focus-ring"
          >
            <span className="w-12 h-12 shrink-0 rounded-xl border-2 border-ink bg-hl text-hl-ink flex items-center justify-center -rotate-3">
              <CalendarDays size={22} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">Today&apos;s topic</span>
              <span className="block mt-1 font-heading text-2xl sm:text-3xl text-ink truncate">{today}</span>
              <span className="block text-sm font-semibold text-ink-soft">A new one every day, the same for everyone.</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-2 font-extrabold text-ink shrink-0">
              Play it <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </span>
            <ArrowRight size={20} className="sm:hidden shrink-0 text-ink" aria-hidden="true" />
          </motion.button>
        )}

        {/* Report card */}
        {stats && (
          <motion.section variants={fadeUp} className="mt-14">
            <h2 className="font-heading text-3xl sm:text-4xl text-ink">Your report card</h2>
            {!hasStats ? (
              <p className="mt-3 text-base font-semibold text-ink-soft">
                Nothing marked yet. Play a round and your scores land here.
              </p>
            ) : (
              <>
                <div className="mt-6 sketch-card p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-8 sm:gap-12 items-center">
                  <div className="flex flex-col items-center">
                    <div className="relative w-44 h-32 flex items-center justify-center">
                      <MarkerLoop stretch color="var(--bad-mark)" strokeWidth={3.5} duration={0.8} delay={0.4} className="inset-0 w-full h-full" />
                      <span className="font-heading text-6xl text-ink tabular-nums leading-none">{acc}%</span>
                    </div>
                    <p className="mt-2 text-sm font-extrabold text-ink-muted">
                      {stats.totalCorrect} of {stats.totalQuestionsAnswered} right
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
                    {[
                      { k: "Games played", v: totalGames },
                      { k: "Best score", v: stats.bestScore || "—" },
                      { k: "Room wins", v: stats.multiplayerGames > 0 ? `${stats.multiplayerWins}/${stats.multiplayerGames}` : "—" },
                      { k: "Solo games", v: stats.soloGames },
                    ].map((s) => (
                      <div key={s.k} className="border-l-2 border-dashed border-line-soft pl-4">
                        <dd className="font-heading text-3xl sm:text-4xl text-ink tabular-nums leading-none">{s.v}</dd>
                        <dt className="mt-1.5 text-sm font-bold text-ink-muted">{s.k}</dt>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {topics.length > 0 && (
                    <section className="sketch-card p-5 sm:p-6">
                      <h3 className="font-heading text-xl text-ink flex items-center gap-2">
                        <Flame size={18} /> Favourite topics
                      </h3>
                      <ul className="mt-4 space-y-3.5">
                        {topics.map(([topic, n], i) => (
                          <li key={topic}>
                            <div className="flex justify-between gap-3 text-sm font-extrabold text-ink mb-1.5">
                              <span className="truncate">{topic}</span>
                              <span className="text-ink-muted shrink-0 tabular-nums">{n} game{n === 1 ? "" : "s"}</span>
                            </div>
                            <div className="h-3.5 rounded-full border-2 border-ink overflow-clip" style={{ background: "var(--inset)" }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round((n / topics[0][1]) * 100)}%` }}
                                transition={{ duration: 0.8, delay: 0.3 + i * 0.08, ease: EASE }}
                                className="h-full bg-hl"
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {recentGames.length > 0 && (
                    <section className="sketch-card overflow-clip">
                      <h3 className="px-5 sm:px-6 py-4 border-b-2 border-ink font-heading text-xl text-ink">Recent games</h3>
                      <ul>
                        {recentGames.map((g, i) => <GameRow key={i} game={g} />)}
                      </ul>
                    </section>
                  )}
                </div>
              </>
            )}
          </motion.section>
        )}
      </motion.div>
    </PageShell>
  );
}
