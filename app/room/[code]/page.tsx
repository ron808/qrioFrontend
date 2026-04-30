"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createWebSocket } from "@/lib/api";
import { getUsername, hasUser, getHomePath } from "@/lib/auth";
import { fadeUp, scaleIn, stagger } from "@/lib/motion";
import {
  DIFFICULTY_CONFIG,
  MULTI_DIFFICULTIES,
  type GamePhase,
  type PlayerScores,
  type Question,
  type QuestionDifficulty,
  type WSMessage,
  type WSPlayerAnswered,
  type WSPlayerJoined,
  type WSPlayerLeft,
  type WSPlayerList,
  type WSPlayerSkipped,
  type WSStartGame,
  type WSVoteDifficulty,
  type WSNextQuestion,
} from "@/lib/types";
import { saveMultiplayerGame } from "@/lib/stats";
import {
  Copy, Users, Hash, Timer, Trophy, Check, X,
  Leaf, Flame, Infinity as InfinityIcon, Play, RotateCcw, Home,
  ChevronDown, Crown, ArrowRight, Wifi, AlertTriangle,
  SkipForward, Loader2,
} from "lucide-react";

const OPTION_LABELS = ["A", "B", "C", "D"];
const TRANSITION_MS = 1500;

function TimerDifficultyIcon({ seconds }: { seconds: number }) {
  if (seconds === 0) return <InfinityIcon size={20} />;
  if (seconds >= 25) return <Leaf size={20} />;
  if (seconds >= 12) return <Timer size={20} />;
  return <Flame size={20} />;
}

function CircularTimer({ seconds, total }: { seconds: number; total: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (seconds / total) * circ;
  const dangerZone = seconds <= 5;
  const warnZone = !dangerZone && seconds <= Math.floor(total * 0.4);
  const stroke = dangerZone ? "var(--accent-red)" : warnZone ? "var(--accent-amber)" : "var(--ink)";
  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={stroke} strokeWidth="6" strokeLinecap="square"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={seconds}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="text-2xl font-black tabular-nums"
          style={{ color: stroke }}
        >
          {seconds}
        </motion.span>
      </div>
    </div>
  );
}

function QuestionTransition({ nextNum, total }: { nextNum: number; total: number }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / TRANSITION_MS, 1);
      setProgress(p);
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, []);

  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - progress * circ;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen flex flex-col items-center justify-center gap-5"
    >
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none" stroke="var(--ink)" strokeWidth="5"
            strokeLinecap="square" strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black text-ink">{nextNum}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-heading text-2xl text-ink">Question {nextNum} of {total}</p>
        <p className="text-ink-muted text-sm font-medium mt-1">Get ready…</p>
      </div>
    </motion.div>
  );
}

function calcTimer(votes: Record<string, number>): number {
  const vals = Object.values(votes);
  if (vals.length === 0) return 15;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(8, Math.min(30, Math.round(avg)));
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.code as string).toUpperCase();
  const myUsername = useRef(getUsername());
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => { if (!hasUser()) router.replace("/"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [phase, setPhase] = useState<GamePhase>("connecting");
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
  const [scores, setScores] = useState<PlayerScores>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [myResult, setMyResult] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [isHost, setIsHost] = useState(false);
  const [myVoteSeconds, setMyVoteSeconds] = useState(15);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, Record<string, boolean>>>({});
  const [copied, setCopied] = useState(false);

  const [respondedUsers, setRespondedUsers] = useState<Set<string>>(new Set());
  const [inTransition, setInTransition] = useState(false);
  const [advanceTrigger, setAdvanceTrigger] = useState(0);

  const reconnectCount = useRef(0);
  const intentionalClose = useRef(false);
  const phaseRef = useRef<GamePhase>("connecting");
  const currentQRef = useRef(0);
  const questionsRef = useRef<Question[]>([]);
  const inTransitionRef = useRef(false);
  const advanceTriggerHandled = useRef(-1);

  const [roomTags, setRoomTags] = useState<string[]>([]);
  const [roomQDiff, setRoomQDiff] = useState<QuestionDifficulty>("medium");

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  useEffect(() => {
    const stored = sessionStorage.getItem(`qrio_tags_${roomCode}`);
    if (stored) {
      try { setRoomTags(JSON.parse(stored) as string[]); } catch { /* ignore */ }
    }
    const qd = sessionStorage.getItem(`qrio_qdiff_${roomCode}`);
    if (qd === "easy" || qd === "medium" || qd === "hard") setRoomQDiff(qd);
  }, [roomCode]);

  const statsSaved = useRef(false);
  useEffect(() => {
    if (phase !== "results" || !myUsername.current || statsSaved.current) return;
    statsSaved.current = true;
    const myScore = scores[myUsername.current] ?? 0;
    const qMult = roomQDiff === "easy" ? 1 : roomQDiff === "medium" ? 1.5 : 2;
    const myCorrect = Math.round(myScore / (10 * qMult));
    const sortedByScore = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const myRank = sortedByScore.findIndex(([name]) => name === myUsername.current) + 1;
    saveMultiplayerGame({
      topics: roomTags,
      correct: myCorrect,
      total: questionsRef.current.length,
      rank: myRank || 1,
      totalPlayers: Math.max(sortedByScore.length, 1),
      questionDifficulty: roomQDiff,
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function sendWS(data: object) {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(data));
  }

  useEffect(() => {
    if (advanceTrigger === 0 || advanceTrigger === advanceTriggerHandled.current) return;
    if (phaseRef.current !== "playing") return;
    if (inTransitionRef.current) return;

    advanceTriggerHandled.current = advanceTrigger;
    inTransitionRef.current = true;
    setInTransition(true);

    const nextQ = currentQRef.current + 1;

    setTimeout(() => {
      if (nextQ >= questionsRef.current.length) {
        setPhase("results");
      } else {
        setCurrentQ(nextQ);
        setAnswered(null);
        setMyResult(null);
        setRespondedUsers(new Set());
      }
      setInTransition(false);
      inTransitionRef.current = false;
    }, TRANSITION_MS);
  }, [advanceTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "player_list": {
        const m = msg as WSPlayerList;
        setPlayers(m.players);
        setScores((s) => {
          const next = { ...s };
          for (const p of m.players) {
            if (next[p] === undefined) next[p] = 0;
          }
          return next;
        });
        if (m.votes) setVotes(m.votes);
        break;
      }
      case "player_joined": {
        const m = msg as WSPlayerJoined;
        setPlayers((p) => [...new Set([...p, m.username])]);
        setScores((s) => ({ ...s, [m.username]: s[m.username] ?? 0 }));
        break;
      }
      case "player_left": {
        const m = msg as WSPlayerLeft;
        setPlayers((p) => p.filter((u) => u !== m.username));
        break;
      }
      case "player_answered": {
        const m = msg as WSPlayerAnswered;
        setScores((s) => ({ ...s, [m.username]: m.new_score }));
        setRespondedUsers((prev) => new Set([...prev, m.username]));
        setQuestionAnswers((qa) => ({
          ...qa,
          [m.question_index]: { ...(qa[m.question_index] ?? {}), [m.username]: m.is_correct },
        }));
        if (m.username === myUsername.current) setMyResult(m.is_correct);
        break;
      }
      case "player_skipped": {
        const m = msg as WSPlayerSkipped;
        setRespondedUsers((prev) => new Set([...prev, m.username]));
        break;
      }
      case "start_game": {
        const m = msg as WSStartGame;
        setQuestions(m.questions);
        setTimerSeconds(m.timer_seconds ?? 15);
        setCurrentQ(0);
        setAnswered(null);
        setMyResult(null);
        setRespondedUsers(new Set());
        setTimeLeft(m.timer_seconds ?? 15);
        setPhase("playing");
        break;
      }
      case "vote_difficulty": {
        const m = msg as WSVoteDifficulty;
        setVotes((v) => ({ ...v, [m.username]: m.seconds }));
        break;
      }
      case "next_question": {
        const m = msg as WSNextQuestion;
        if (phaseRef.current === "playing" && m.question_index === currentQRef.current) {
          setAdvanceTrigger((n) => n + 1);
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!myUsername.current) return;
    setIsHost(sessionStorage.getItem(`qrio_host_${roomCode}`) === "true");

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const socket = createWebSocket(roomCode, myUsername.current);
      ws.current = socket;

      socket.onopen = () => {
        reconnectCount.current = 0;
        setReconnecting(false);
        if (phaseRef.current === "connecting" || phaseRef.current === "error") {
          setPhase("lobby");
        }
      };

      socket.onclose = (ev) => {
        ws.current = null;
        if (intentionalClose.current) return;
        if (phaseRef.current === "results") return;

        // Server tells us the room is gone — stop retrying and tell the user.
        if (ev.code === 4404) {
          setReconnecting(false);
          setPhase("error");
          setError("This room no longer exists. Ask the host for a fresh code.");
          return;
        }

        // Keep retrying with capped exponential backoff. Phones can sleep for
        // a long time, so don't give up after a few attempts — the backend
        // holds the room for several minutes after the last client leaves.
        reconnectCount.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectCount.current - 1), 8000);
        setReconnecting(true);
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        // Don't surface anything here — onclose handles the retry/error state.
      };

      socket.onmessage = (e) => {
        try { handleMessage(JSON.parse(e.data as string) as WSMessage); } catch { /* ignore */ }
      };
    }

    // When the phone screen wakes / tab refocuses, the WS may already be
    // dead but the close event hasn't fired yet. Force a reconnect.
    function wakeReconnect() {
      if (intentionalClose.current) return;
      if (phaseRef.current === "results" || phaseRef.current === "error") return;
      const sock = ws.current;
      if (!sock || sock.readyState === WebSocket.CLOSED || sock.readyState === WebSocket.CLOSING) {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        reconnectCount.current = 0;
        connect();
      }
    }

    function onVisible() { if (document.visibilityState === "visible") wakeReconnect(); }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", wakeReconnect);
    window.addEventListener("online", wakeReconnect);

    connect();
    return () => {
      intentionalClose.current = true;
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", wakeReconnect);
      window.removeEventListener("online", wakeReconnect);
      ws.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (phase !== "lobby" || !myUsername.current) return;
    sendWS({ type: "vote_difficulty", username: myUsername.current, seconds: myVoteSeconds });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myVoteSeconds, phase]);

  useEffect(() => {
    if (phase !== "playing" || inTransition) return;
    setTimeLeft(timerSeconds);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setAdvanceTrigger((n) => n + 1);
          return timerSeconds;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, currentQ, timerSeconds, inTransition]);

  function startGame() {
    const timer = calcTimer(votes);
    sendWS({ type: "start_game", timer_seconds: timer });
  }

  function submitAnswer(i: number) {
    if (answered !== null) return;
    setAnswered(i);
    sendWS({ type: "submit_answer", data: { question_index: currentQ, answer_index: i } });
  }

  function submitSkip() {
    if (answered !== null) return;
    setAnswered(-1);
    sendWS({ type: "skip_question", data: { question_index: currentQ, answer_index: -1 } });
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const q = questions[currentQ];

  const ReconnectingBanner = (
    <AnimatePresence>
      {reconnecting && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-ink text-on-ink py-2.5 px-4 font-bold text-sm"
        >
          <Wifi size={15} className="animate-pulse" />
          Reconnecting… (attempt {reconnectCount.current})
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── CONNECTING ──────────────────────────────────────────────────────────
  if (phase === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 bg-ink rounded-2xl flex items-center justify-center mx-auto"
            style={{ boxShadow: "4px 4px 0px var(--shadow)" }}
          >
            <Wifi size={36} className="text-on-ink" />
          </motion.div>
          <p className="text-ink-soft font-black text-lg">Connecting to room…</p>
          <div className="flex gap-2 justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                className="w-2.5 h-2.5 bg-ink rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── ERROR ───────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="text-center space-y-4 max-w-sm"
        >
          <div
            className="w-20 h-20 bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto"
            style={{ boxShadow: "4px 4px 0px var(--accent-red)" }}
          >
            <AlertTriangle size={36} className="text-red-600 dark:text-red-400" />
          </div>
          <h2 className="font-heading text-3xl text-ink">Oops!</h2>
          <p className="text-ink-soft font-medium">{error || "Room not found or server unreachable."}</p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            onClick={() => router.push("/multiplayer")}
            className="sketch-btn-dark gap-2 px-6 py-3 focus-ring"
          >
            Back to Multiplayer <ArrowRight size={15} />
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── LOBBY ───────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    const calculatedTimer = calcTimer(votes);
    const votedCount = Object.keys(votes).length;
    // Tally votes per option
    const voteTally: Record<number, number> = {};
    for (const sec of Object.values(votes)) {
      voteTally[sec] = (voteTally[sec] ?? 0) + 1;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5">
        {ReconnectingBanner}
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          animate="show"
          className="w-full max-w-lg space-y-5"
        >

          <motion.div variants={scaleIn} className="sketch-card p-6 text-center">
            <p className="flex items-center justify-center gap-2 text-xs font-black text-ink-muted uppercase tracking-widest mb-3">
              <Hash size={12} /> Room Code
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={copyCode}
              className="font-mono text-5xl font-black tracking-[0.3em] text-ink hover:text-ink-soft transition-colors inline-flex items-center gap-3 focus-ring rounded-md"
              title="Click to copy"
            >
              {roomCode}
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  >
                    <Check size={22} className="text-emerald-600" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy size={22} className="text-ink-faint" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <p className="text-xs text-ink-faint mt-2 font-medium">Click to copy · Share with friends!</p>
          </motion.div>

          <motion.div variants={fadeUp} className="sketch-card p-5">
            <p className="flex items-center gap-2 text-xs font-black text-ink-muted uppercase tracking-widest mb-3">
              <Users size={12} /> Players ({players.length})
            </p>
            {players.length === 0 ? (
              <p className="text-ink-faint text-sm font-medium">Waiting for players to join…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {players.map((p) => (
                    <motion.div
                      key={p}
                      layout
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      className="flex items-center gap-2 sketch-card-sm px-3 py-1.5"
                    >
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-sm font-bold text-ink">{p}</span>
                      {p === myUsername.current && <span className="text-xs text-ink-faint font-medium">(you)</span>}
                      {isHost && p === myUsername.current && <Crown size={11} className="text-amber-500" />}
                      {votes[p] !== undefined && <TimerDifficultyIcon seconds={votes[p]} />}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="sketch-card p-5">
            <p className="flex items-center gap-2 text-xs font-black text-ink-muted uppercase tracking-widest mb-3">
              <Timer size={12} /> Vote on Timer Difficulty
            </p>
            <div className="grid grid-cols-3 gap-3">
              {MULTI_DIFFICULTIES.map((d) => {
                const cfg = DIFFICULTY_CONFIG[d];
                const active = myVoteSeconds === cfg.seconds;
                const tally = voteTally[cfg.seconds] ?? 0;
                const pct = votedCount > 0 ? (tally / votedCount) * 100 : 0;
                return (
                  <motion.button
                    key={d}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ y: -2 }}
                    onClick={() => setMyVoteSeconds(cfg.seconds)}
                    className={`relative overflow-hidden flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-bold text-xs transition-colors duration-150 focus-ring ${
                      active ? `${cfg.activeClass} shadow-[2px_2px_0_var(--shadow)]` : "border-line-soft text-ink-muted bg-card hover:border-ink hover:text-ink"
                    }`}
                  >
                    {/* Tally bar fill */}
                    {tally > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute bottom-0 left-0 h-1 bg-current opacity-50"
                      />
                    )}
                    <TimerDifficultyIcon seconds={cfg.seconds} />
                    <span>{cfg.label}</span>
                    <span className="text-[10px] opacity-70">{cfg.seconds}s</span>
                    {tally > 0 && (
                      <span className="absolute top-1 right-1.5 text-[9px] font-black opacity-70 tabular-nums">{tally}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
            {votedCount > 0 && (
              <p className="text-xs text-ink-faint mt-3 text-center font-medium">
                {votedCount} voted · Avg timer: <span className="text-ink font-black">{calculatedTimer}s</span>
              </p>
            )}
          </motion.div>

          {isHost ? (
            <motion.button
              variants={fadeUp}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              onClick={startGame}
              disabled={players.length === 0}
              className="w-full sketch-btn-dark gap-2 py-4 text-lg font-heading focus-ring"
            >
              <Play size={20} /> Start Game!
            </motion.button>
          ) : (
            <motion.div variants={fadeUp} className="text-center text-ink-muted text-sm font-bold sketch-card py-4 flex items-center justify-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
                    className="w-2 h-2 bg-ink rounded-full"
                  />
                ))}
              </div>
              Waiting for the host to start…
            </motion.div>
          )}

          <motion.button
            variants={fadeUp}
            onClick={() => { intentionalClose.current = true; router.push("/multiplayer"); }}
            className="w-full text-ink-faint hover:text-ink text-sm font-bold py-2 transition-colors focus-ring rounded-md"
          >
            Leave Room
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── TRANSITION ──────────────────────────────────────────────────────────
  if (phase === "playing" && inTransition) {
    const nextNum = currentQ + 2;
    const capped = Math.min(nextNum, questions.length);
    return <QuestionTransition nextNum={capped} total={questions.length} />;
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────
  if (phase === "playing" && q) {
    const progress = (currentQ / questions.length) * 100;
    const isAnswered = answered !== null;
    const isSkipped = answered === -1;
    const isCorrect = isAnswered && !isSkipped && answered === q.answer;
    const showWaiting = isAnswered && respondedUsers.size < players.length && players.length > 1;

    return (
      <div className="min-h-screen flex flex-col bg-paper">
        {ReconnectingBanner}

        <div className="px-5 py-3 border-b-2 border-ink bg-card flex items-center gap-3">
          <div className="flex-1 bg-card-soft h-3 overflow-hidden border border-ink">
            <motion.div
              className="h-full bg-ink"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-sm font-black text-ink tabular-nums whitespace-nowrap">
            {currentQ + 1} / {questions.length}
          </span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-5 gap-5 max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between w-full">
              {q.category && (
                <span
                  className="text-xs font-black bg-card border-2 border-ink text-ink px-4 py-1.5 rounded-full uppercase tracking-wider"
                  style={{ boxShadow: "2px 2px 0px var(--shadow)" }}
                >
                  {q.category}
                </span>
              )}
              <CircularTimer seconds={timeLeft} total={timerSeconds} />
            </div>

            <motion.div
              key={currentQ}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="sketch-card p-6 w-full"
            >
              <h2 className="font-body font-extrabold text-xl md:text-2xl text-ink leading-snug text-center">
                {q.question}
              </h2>
            </motion.div>

            <motion.div
              key={`opts-${currentQ}`}
              variants={stagger(0.05)}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full"
            >
              {q.options.map((opt, i) => {
                const sel = answered === i;
                const correct = i === q.answer;
                let cls = "bg-card border-ink text-ink hover:shadow-[3px_3px_0_var(--shadow)] hover:-translate-y-0.5";
                if (isAnswered && !isSkipped) {
                  if (sel && correct) cls = "bg-emerald-600 border-emerald-700 text-white shadow-[3px_3px_0px_#166534]";
                  else if (sel && !correct) cls = "bg-red-600 border-red-700 text-white shadow-[3px_3px_0px_#991b1b]";
                  else if (correct) cls = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300";
                  else cls = "bg-card border-line-soft text-ink-faint opacity-50";
                } else if (isSkipped) {
                  cls = "bg-card border-line-soft text-ink-faint opacity-40";
                }
                return (
                  <motion.button
                    key={i}
                    variants={scaleIn}
                    whileTap={!isAnswered ? { scale: 0.97 } : {}}
                    onClick={() => submitAnswer(i)}
                    disabled={isAnswered}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 font-bold text-sm text-left transition-all duration-150 disabled:cursor-not-allowed focus-ring ${cls} ${sel && !isCorrect && !isSkipped ? "animate-shake" : ""} ${sel && isCorrect ? "animate-pop" : ""}`}
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0 transition-colors ${
                      isAnswered && !isSkipped
                        ? sel && correct ? "bg-white/20 text-white"
                        : sel ? "bg-white/20 text-white"
                        : correct ? "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                        : "bg-card-soft text-ink-faint"
                        : isSkipped ? "bg-card-soft text-ink-faint"
                        : "bg-ink text-on-ink"
                    }`}>
                      {isAnswered && !isSkipped && sel && correct
                        ? <Check size={16} />
                        : isAnswered && !isSkipped && sel
                        ? <X size={16} />
                        : isAnswered && !isSkipped && correct
                        ? <Check size={16} />
                        : OPTION_LABELS[i]}
                    </span>
                    <span className="flex-1 leading-snug">{opt}</span>
                  </motion.button>
                );
              })}
            </motion.div>

            <AnimatePresence>
              {!isAnswered && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={submitSkip}
                  className="flex items-center gap-2 text-sm font-bold text-ink-faint hover:text-ink transition-colors px-4 py-2 rounded-lg border-2 border-transparent hover:border-line-soft hover:bg-card focus-ring"
                >
                  <SkipForward size={15} /> Skip this question
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isAnswered && !isSkipped && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className={`font-heading text-2xl font-bold ${isCorrect ? "text-emerald-600" : "text-red-600"}`}
                >
                  {isCorrect ? "Correct!" : myResult === false ? "Wrong!" : "Locked in!"}
                </motion.p>
              )}
              {isSkipped && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="font-heading text-xl text-ink-muted"
                >
                  Skipped
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:flex w-52 border-l-2 border-ink bg-card flex-col p-4 gap-3">
            <p className="flex items-center gap-2 text-xs font-black text-ink-muted uppercase tracking-widest">
              <Trophy size={12} /> Scores
            </p>
            <div className="space-y-2 overflow-y-auto flex-1">
              <AnimatePresence>
                {sortedScores.map(([name, score], i) => (
                  <motion.div
                    key={name}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs text-ink-faint font-black w-4 text-center">{i + 1}</span>
                    <span className={`flex-1 text-sm truncate font-bold ${name === myUsername.current ? "text-ink" : "text-ink-soft"}`}>
                      {name}
                      {name === myUsername.current && <span className="text-xs text-ink-faint font-medium"> (you)</span>}
                    </span>
                    <motion.span
                      key={score}
                      initial={{ scale: 1.3, color: "var(--accent-emerald)" }}
                      animate={{ scale: 1, color: "var(--ink)" }}
                      transition={{ duration: 0.4 }}
                      className="text-sm font-black tabular-nums"
                    >
                      {score}
                    </motion.span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${respondedUsers.has(name) ? "bg-emerald-500" : "bg-line-soft"}`} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <p className="text-xs text-ink-faint font-medium text-center border-t border-line-faint pt-2">
              {respondedUsers.size}/{players.length} answered
            </p>
          </div>
        </div>

        <AnimatePresence>
          {showWaiting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className="sketch-card p-6 max-w-sm w-full mx-4"
              >
                <h3 className="font-heading text-xl text-ink mb-1">
                  {isSkipped ? "Skipped!" : isCorrect ? "Correct!" : "Answered!"}
                </h3>
                <p className="text-ink-muted text-sm font-medium mb-4">Waiting for others…</p>
                <div className="space-y-2">
                  {players.map((p) => (
                    <div key={p} className="flex items-center gap-2.5">
                      {respondedUsers.has(p)
                        ? <Check size={16} className="text-emerald-600 shrink-0" />
                        : <Loader2 size={16} className="animate-spin text-ink-ghost shrink-0" />}
                      <span className={`text-sm font-bold ${respondedUsers.has(p) ? "text-ink-muted" : "text-ink"}`}>
                        {p}
                        {p === myUsername.current && <span className="text-xs text-ink-faint font-medium ml-1">(you)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center p-5 pt-8">
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="w-full max-w-2xl space-y-5"
      >

        <motion.div variants={scaleIn} className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            className="w-20 h-20 bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ boxShadow: "4px 4px 0px var(--accent-amber)" }}
          >
            <Trophy size={40} className="text-amber-600 dark:text-amber-400" />
          </motion.div>
          <h1 className="font-heading text-5xl text-ink">Game Over!</h1>
          <p className="text-ink-muted mt-1 text-sm font-medium">
            {players.length} players · Room {roomCode}
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="sketch-card overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-ink flex items-center gap-2">
            <Trophy size={15} />
            <h3 className="font-black text-ink">Leaderboard</h3>
          </div>
          {sortedScores.map(([name, score], i) => {
            const qMult = roomQDiff === "easy" ? 1 : roomQDiff === "medium" ? 1.5 : 2;
            const correct = Math.round(score / (10 * qMult));
            const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
            const isMe = name === myUsername.current;
            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className={`flex items-center gap-3 px-5 py-4 ${i < sortedScores.length - 1 ? "border-b border-line-faint" : ""} ${isMe ? "bg-card-soft" : ""}`}
              >
                <span className={`w-8 text-center font-black text-lg shrink-0 ${
                  i === 0 ? "text-amber-500" : i === 1 ? "text-ink-muted" : i === 2 ? "text-amber-700" : "text-ink-ghost"
                }`}>
                  {i === 0 ? <Crown size={20} className="mx-auto" /> : `#${i + 1}`}
                </span>
                <span className={`flex-1 font-bold truncate ${isMe ? "text-ink" : "text-ink-soft"}`}>
                  {name}
                  {isMe && <span className="text-xs text-ink-faint font-medium ml-1">(you)</span>}
                </span>
                <div className="text-right shrink-0">
                  <div className="font-heading text-xl text-ink tabular-nums">{score} pts</div>
                  <div className="text-xs text-ink-faint font-medium">
                    {correct}/{questions.length} correct · {pct}%
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {questions.length > 0 && (
          <motion.div variants={fadeUp} className="sketch-card overflow-hidden">
            <div className="px-6 py-4 border-b-2 border-ink">
              <h3 className="font-black text-ink">Question Breakdown</h3>
            </div>
            <div className="divide-y divide-line-faint">
              {questions.map((question, i) => {
                const qa = questionAnswers[i] ?? {};
                const correct = Object.entries(qa).filter(([, c]) => c).map(([u]) => u);
                const wrong = Object.entries(qa).filter(([, c]) => !c).map(([u]) => u);
                return (
                  <details key={i} className="group">
                    <summary className="flex items-center gap-3 px-5 py-4 hover:bg-card-soft transition-colors cursor-pointer">
                      <span className="text-ink-muted text-sm font-black w-6 shrink-0">Q{i + 1}</span>
                      <span className="flex-1 text-sm text-ink font-medium line-clamp-1">{question.question}</span>
                      <span className="text-xs text-ink-muted font-bold shrink-0 flex items-center gap-1">
                        <Check size={12} className="text-emerald-600" />{correct.length}
                        <X size={12} className="text-red-500 ml-1" />{wrong.length}
                      </span>
                      <ChevronDown size={14} className="text-ink-faint ml-1 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-5 pb-4 pt-1 bg-card-soft text-sm space-y-2 border-t border-line-faint">
                      <p className="text-ink-muted text-xs font-medium">
                        Correct: <span className="text-emerald-600 font-black">{question.options[question.answer]}</span>
                      </p>
                      {correct.length > 0 && (
                        <p className="text-emerald-600 font-semibold flex items-center gap-1.5">
                          <Check size={13} /> Got it: {correct.join(", ")}
                        </p>
                      )}
                      {wrong.length > 0 && (
                        <p className="text-red-600 font-semibold flex items-center gap-1.5">
                          <X size={13} /> Missed: {wrong.join(", ")}
                        </p>
                      )}
                      {correct.length === 0 && wrong.length === 0 && (
                        <p className="text-ink-faint">No answers recorded</p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            onClick={() => {
              sessionStorage.removeItem(`qrio_questions_${roomCode}`);
              sessionStorage.removeItem(`qrio_host_${roomCode}`);
              sessionStorage.removeItem(`qrio_tags_${roomCode}`);
              sessionStorage.removeItem(`qrio_qdiff_${roomCode}`);
              router.push("/multiplayer");
            }}
            className="flex-1 sketch-btn-dark gap-2 py-3.5 focus-ring"
          >
            <RotateCcw size={15} /> Play Again
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            onClick={() => router.push(getHomePath())}
            className="flex-1 sketch-btn-light gap-2 py-3.5 focus-ring"
          >
            <Home size={15} /> Home
          </motion.button>
        </motion.div>

      </motion.div>
    </div>
  );
}
