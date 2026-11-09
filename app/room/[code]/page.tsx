"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createWebSocket } from "@/lib/api";
import {
  getUsername, hasUser, getHomePath, isLoggedIn, incrementGuestGamesPlayed, guestMustRegister,
} from "@/lib/auth";
import { EASE, fadeUp, stagger } from "@/lib/motion";
import {
  DIFFICULTY_CONFIG,
  MULTI_DIFFICULTIES,
  QUESTION_DIFFICULTY_CONFIG,
  type AnswerBreakdown,
  type Commentary,
  type GamePhase,
  type LeaderboardEntry,
  type PlayerCounts,
  type PlayerScores,
  type QuestionDifficulty,
  type RoomQuestion,
  type WSAnswerResult,
  type WSError,
  type WSGameFinished,
  type WSHostChanged,
  type WSMessage,
  type WSNewGameReady,
  type WSNextQuestion,
  type WSPlayerAnswered,
  type WSPlayerJoined,
  type WSPlayerLeft,
  type WSPlayerSkipped,
  type WSQuestionClosed,
  type WSRoomState,
  type WSStartGame,
  type WSVoteDifficulty,
} from "@/lib/types";
import { qDiffMultiplier, saveMultiplayerGame } from "@/lib/stats";
import { RIGHT_HEADLINES, WRONG_HEADLINES, calloutFor, pick, resultGrid, teacherComment, type Callout } from "@/lib/fun";
import { buzz, play } from "@/lib/sound";
import { pulseDots, pulseFrom } from "@/lib/pulse";
import Confetti from "../../components/Confetti";
import ShareDialog from "../../components/ShareDialog";
import Logo from "../../components/Logo";
import Modal from "../../components/Modal";
import Notice from "../../components/Notice";
import ThemeToggle from "../../components/ThemeToggle";
import { Avatar } from "../../components/Navbar";
import {
  FeedbackBar, OptionButton, ProgressTicks, QuestionSheet, QuestionTransition, SoundToggle, TimerRing,
  REVEAL_MS, STAMP_DELAY, TRANSITION_MS, useKeepAboveFeedback, type OptionState,
} from "../../components/GameUI";
import {
  ChoiceGrid, CountSlider, TopicInput, QUESTION_DIFFICULTY_CHOICES, timerIcon,
} from "../../components/QuizSettings";
import {
  AlertTriangle, ArrowRight, Check, ChevronDown, Copy, Crown, Flame, Home, Lightbulb, Link2, Loader2,
  LogOut, Play, RotateCcw, Share2, SkipForward, Wifi, X,
} from "lucide-react";

function calcTimer(votes: Record<string, number>): number {
  const vals = Object.values(votes);
  if (vals.length === 0) return 15;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(8, Math.min(30, Math.round(avg)));
}

const ORDINAL = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Live scores: a swipeable strip on phones, a column beside the question on desktop. */
function Scoreboard({
  sortedScores,
  myUsername,
  respondedUsers,
  variant,
}: {
  sortedScores: [string, number][];
  myUsername: string;
  respondedUsers: Set<string>;
  variant: "strip" | "column";
}) {
  if (variant === "strip") {
    return (
      <div className="lg:hidden border-b-2 border-ink bg-card-soft">
        <div className="max-w-2xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar px-4 py-2.5">
          {sortedScores.map(([name, score], i) => {
            const isMe = name === myUsername;
            return (
              <motion.div
                key={name}
                layout
                className={`flex items-center gap-1.5 shrink-0 rounded-full border-2 pl-1 pr-3 py-0.5 text-sm font-extrabold ${
                  isMe ? "border-ink bg-hl text-hl-ink" : "border-line-soft bg-card text-ink"
                }`}
              >
                <span className="w-6 text-center text-xs tabular-nums opacity-70">{i + 1}</span>
                <span className="truncate max-w-[6.5rem]">{isMe ? "You" : name}</span>
                <motion.span key={score} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="tabular-nums">{score}</motion.span>
                <span
                  aria-label={respondedUsers.has(name) ? "answered" : "thinking"}
                  className="w-2 h-2 rounded-full"
                  style={{ background: respondedUsers.has(name) ? "var(--good-mark)" : "var(--line-soft)" }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-24 sketch-card p-4">
        <h2 className="font-heading text-lg text-ink mb-3">Scores</h2>
        <ol className="space-y-1">
          <AnimatePresence initial={false}>
            {sortedScores.map(([name, score], i) => {
              const isMe = name === myUsername;
              return (
                <motion.li
                  key={name}
                  layout
                  transition={{ duration: 0.35, ease: EASE }}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMe ? "bg-hl-soft" : ""}`}
                >
                  <span className="w-4 text-center text-xs font-extrabold text-ink-muted tabular-nums">{i + 1}</span>
                  <Avatar name={name} size={26} />
                  <span className="flex-1 min-w-0 truncate text-sm font-extrabold text-ink">{isMe ? "You" : name}</span>
                  <motion.span
                    key={score}
                    initial={{ scale: 1.3, color: "var(--good)" }}
                    animate={{ scale: 1, color: "var(--ink)" }}
                    transition={{ duration: 0.4 }}
                    className="text-sm font-extrabold tabular-nums"
                  >
                    {score}
                  </motion.span>
                  {respondedUsers.has(name)
                    ? <Check size={14} strokeWidth={3} className="text-good shrink-0" aria-label="answered" />
                    : <span className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-line-soft" aria-label="thinking" />}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </div>
    </aside>
  );
}

/** Host's dialog on the results screen to start another round in this room. */
function NewRoundDialog({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (params: { tags: string[]; count: number; questionDifficulty: QuestionDifficulty }) => Promise<void>;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [qd, setQd] = useState<QuestionDifficulty>("medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleStart() {
    if (tags.length === 0) { setErr("Add at least one topic."); return; }
    setErr("");
    setBusy(true);
    try {
      await onStart({ tags, count, questionDifficulty: qd });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start the round.");
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} locked={busy} title="New round" subtitle="Same room, fresh questions" icon={<RotateCcw size={20} />}>
      <div className="space-y-6">
        <TopicInput tags={tags} onChange={setTags} suggestions={false} />
        <CountSlider value={count} onChange={setCount} />
        <ChoiceGrid label="Question difficulty" options={QUESTION_DIFFICULTY_CHOICES} value={qd} onChange={setQd} columns="grid-cols-2" />
        <Notice>{err}</Notice>
        <button onClick={handleStart} disabled={busy} className="w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Writing questions…</> : <>Start the round <ArrowRight size={18} /></>}
        </button>
      </div>
    </Modal>
  );
}

// Keyed by name too, so two tabs playing as different people don't clobber each other.
const REJOIN_KEY = (room: string, name: string) => `qrio_rejoin_${room}_${name.toLowerCase()}`;

function readRejoinToken(room: string, name: string): string | null {
  try { return localStorage.getItem(REJOIN_KEY(room, name)); } catch { return null; }
}
function saveRejoinToken(room: string, name: string, token: string) {
  try { localStorage.setItem(REJOIN_KEY(room, name), token); } catch { /* storage unavailable */ }
}
function clearRejoinToken(room: string, name: string) {
  try { localStorage.removeItem(REJOIN_KEY(room, name)); } catch { /* storage unavailable */ }
}

// navigator.clipboard only exists on https/localhost pages, and it can still
// refuse (permissions, embedded browsers), so fall back to the textarea trick.
async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* fall through */ }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Copy failed");
}

// Close codes after which retrying can't help.
const FATAL_CLOSE: Record<number, string> = {
  4000: "This room is open in another tab or window. Keep playing there.",
  4400: "That name can't be used in a room. Pick a different one.",
  4404: "This room no longer exists. Ask the host for a fresh code.",
  4409: "That name is already taken in this room. Pick a different one.",
  4413: "This room is full.",
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.code as string).toUpperCase();
  // Read once on the client; the name can't change while the page is open.
  const [myUsername] = useState(() => getUsername());
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!hasUser()) { router.replace("/"); return; }
    if (guestMustRegister()) router.replace("/login?reason=trial_used");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [phase, setPhase] = useState<GamePhase>("connecting");
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [players, setPlayers] = useState<string[]>([]);
  const [scores, setScores] = useState<PlayerScores>({});
  const [correctCounts, setCorrectCounts] = useState<PlayerCounts>({});
  const [questions, setQuestions] = useState<RoomQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [myResult, setMyResult] = useState<boolean | null>(null);
  // The right option for the current question, once the server reveals it to us.
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [isHost, setIsHost] = useState(false);
  const [hostUsername, setHostUsername] = useState("");
  const [myVoteSeconds, setMyVoteSeconds] = useState(15);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [questionAnswers, setQuestionAnswers] = useState<AnswerBreakdown>({});
  const [copied, setCopied] = useState(false);

  const [respondedUsers, setRespondedUsers] = useState<Set<string>>(new Set());
  const [inTransition, setInTransition] = useState(false);
  // The marking for the current question: its commentary, once we may see it,
  // and whether the question has closed for everyone.
  const [reveal, setReveal] = useState<Commentary | null>(null);
  const [closed, setClosed] = useState(false);
  const [stamp, setStamp] = useState<Callout | null>(null);
  const [myStreak, setMyStreak] = useState(0);
  const [lostStreak, setLostStreak] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  const reconnectCount = useRef(0);
  const intentionalClose = useRef(false);
  const phaseRef = useRef<GamePhase>("connecting");
  const currentQRef = useRef(0);
  const timerSecondsRef = useRef(15);
  const myVoteRef = useRef(15);
  const inTransitionRef = useRef(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the current question closes, in local clock time. Drives the countdown. */
  const deadlineRef = useRef(0);
  const statsSaved = useRef(false);
  // Read from the socket handler, which only sees refs.
  const answeredRef = useRef<number | null>(null);
  const streakRef = useRef(0);
  const missRunRef = useRef(0);
  const questionStart = useRef(0);
  const pickedEl = useRef<HTMLElement | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const lastTick = useRef(0);
  const pendingNewRound = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  const [roomTags, setRoomTags] = useState<string[]>([]);
  const [roomQDiff, setRoomQDiff] = useState<QuestionDifficulty>("medium");

  // Canonical leaderboard from the server (sent on game_finished). Authoritative
  // — every client sorts the same way using this exact list.
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  // New-round dialog state (host-only on results)
  const [showNewRound, setShowNewRound] = useState(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);
  useEffect(() => { answeredRef.current = answered; }, [answered]);

  function sendWS(data: object): boolean {
    if (ws.current?.readyState !== WebSocket.OPEN) return false;
    ws.current.send(JSON.stringify(data));
    return true;
  }

  function startCountdown(ms: number) {
    deadlineRef.current = Date.now() + ms;
    setTimeLeft(Math.ceil(ms / 1000));
  }

  function cancelTransition() {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
    inTransitionRef.current = false;
    setInTransition(false);
  }

  function resetQuestionState() {
    setAnswered(null);
    setMyResult(null);
    setCorrectIndex(null);
    setRespondedUsers(new Set());
    setReveal(null);
    setClosed(false);
    setStamp(null);
    setLostStreak(0);
    pickedEl.current = null;
    questionStart.current = Date.now();
  }

  function resetStreak() {
    streakRef.current = 0;
    missRunRef.current = 0;
    setMyStreak(0);
  }

  /** The current question went by without a right answer from us. */
  function breakStreak() {
    setLostStreak(streakRef.current);
    streakRef.current = 0;
    missRunRef.current += 1;
    setMyStreak(0);
  }

  /** Our answer came back marked: streak, stamp, sound, a ripple from the option we tapped. */
  function markMine(correct: boolean) {
    const el = pickedEl.current;
    if (!correct) {
      breakStreak();
      play("wrong");
      buzz([40, 30, 40]);
      pulseFrom(el, { tone: "bad", shake: true });
      return;
    }
    const streakNow = streakRef.current + 1;
    streakRef.current = streakNow;
    setMyStreak(streakNow);
    const callout = calloutFor({
      streak: streakNow,
      elapsed: (Date.now() - questionStart.current) / 1000,
      secondsLeft: (deadlineRef.current - Date.now()) / 1000,
      missesBefore: missRunRef.current,
      timerSeconds: timerSecondsRef.current,
    });
    missRunRef.current = 0;
    setStamp(callout);
    play("correct");
    pulseFrom(el, { tone: "good", strength: 0.9 });
    if (callout) {
      window.setTimeout(() => {
        play(callout.tone === "hl" ? "streak" : "stamp");
        pulseFrom(el, { tone: "hl", strength: 0.7 });
      }, STAMP_DELAY * 1000);
    }
  }

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "room_state": {
        // Authoritative snapshot. Fires on every (re)connect.
        const m = msg as WSRoomState;
        saveRejoinToken(roomCode, myUsername, m.rejoin_token);
        cancelTransition();
        setPlayers(m.players);
        setScores(m.scores);
        setCorrectCounts(m.correct_counts);
        setVotes(m.votes ?? {});
        setIsHost(m.you_are_host);
        setHostUsername(m.host_username);
        setTimerSeconds(m.timer_seconds);
        setRoomQDiff(m.question_difficulty);
        setRoomTags(m.tags ?? []);
        if (m.questions) setQuestions(m.questions);

        if (m.phase === "lobby") {
          setFinalLeaderboard(null);
          setQuestionAnswers({});
          setPhase("lobby");
          // The server forgets votes from dropped connections, so re-send ours.
          sendWS({ type: "vote_difficulty", seconds: myVoteRef.current });
          if (pendingNewRound.current) {
            pendingNewRound.current.resolve();
            pendingNewRound.current = null;
            setShowNewRound(false);
          }
        } else if (m.phase === "playing") {
          // Mid-game (re)join: pick up the server's clock and our own answer, if any.
          setCurrentQ(m.current_question);
          const mine = m.my_current_answer;
          setRespondedUsers(new Set());
          if (mine) {
            setAnswered(mine.selected);
            setMyResult(mine.is_correct);
            setCorrectIndex(mine.correct_index);
            setRespondedUsers(new Set([myUsername]));
          } else if (m.my_skipped.includes(m.current_question)) {
            setAnswered(-1);
            setMyResult(null);
            setCorrectIndex(null);
            setRespondedUsers(new Set([myUsername]));
          } else {
            resetQuestionState();
          }
          if (mine?.reveal) setReveal(mine.reveal);
          // Rejoined while the marked question is on screen.
          const shut = m.closed_question;
          if (shut) {
            setClosed(true);
            setCorrectIndex(shut.correct_index);
            setReveal(shut.reveal ?? null);
          }
          startCountdown(m.time_left_ms ?? m.timer_seconds * 1000);
          setPhase("playing");
        } else {
          // Rejoined after the game ended: show the same results everyone else sees.
          setFinalLeaderboard(m.leaderboard ?? null);
          setQuestionAnswers(m.answers ?? {});
          setPhase("results");
        }
        break;
      }
      case "player_joined": {
        const m = msg as WSPlayerJoined;
        setPlayers((p) => [...new Set([...p, m.username])]);
        setScores((s) => ({ ...s, [m.username]: m.score ?? s[m.username] ?? 0 }));
        if (typeof m.correct_count === "number") {
          setCorrectCounts((c) => ({ ...c, [m.username]: m.correct_count! }));
        }
        break;
      }
      case "player_left": {
        const m = msg as WSPlayerLeft;
        setPlayers((p) => p.filter((u) => u !== m.username));
        setVotes((v) => {
          const next = { ...v };
          delete next[m.username];
          return next;
        });
        break;
      }
      case "host_changed": {
        const m = msg as WSHostChanged;
        setHostUsername(m.host_username);
        setIsHost(m.host_username === myUsername);
        break;
      }
      case "player_answered": {
        const m = msg as WSPlayerAnswered;
        setScores((s) => ({ ...s, [m.username]: m.new_score }));
        setCorrectCounts((c) => ({ ...c, [m.username]: m.correct_count }));
        setRespondedUsers((prev) => new Set([...prev, m.username]));
        setQuestionAnswers((qa) => ({
          ...qa,
          [m.question_index]: { ...(qa[m.question_index] ?? {}), [m.username]: m.is_correct },
        }));
        break;
      }
      case "answer_result": {
        const m = msg as WSAnswerResult;
        if (m.question_index !== currentQRef.current) break;
        setAnswered(m.selected);
        setMyResult(m.is_correct);
        setCorrectIndex(m.correct_index);
        setReveal(m.reveal ?? null);
        markMine(m.is_correct);
        break;
      }
      case "question_closed": {
        // Everyone answered or time ran out: the answer is marked for all.
        const m = msg as WSQuestionClosed;
        if (m.question_index !== currentQRef.current) break;
        setClosed(true);
        setCorrectIndex(m.correct_index);
        setReveal(m.reveal ?? null);
        if (answeredRef.current === null) {
          breakStreak();
          play("wrong");
          pulseDots({ tone: "bad", strength: 0.8 });
        }
        break;
      }
      case "player_skipped": {
        const m = msg as WSPlayerSkipped;
        setScores((s) => ({ ...s, [m.username]: m.new_score }));
        setCorrectCounts((c) => ({ ...c, [m.username]: m.correct_count }));
        setRespondedUsers((prev) => new Set([...prev, m.username]));
        break;
      }
      case "start_game": {
        const m = msg as WSStartGame;
        cancelTransition();
        setQuestions(m.questions);
        setTimerSeconds(m.timer_seconds);
        setScores(m.scores);
        setCorrectCounts(m.correct_counts);
        setCurrentQ(0);
        resetQuestionState();
        resetStreak();
        startCountdown(m.timer_seconds * 1000);
        setFinalLeaderboard(null);
        setQuestionAnswers({});
        statsSaved.current = false;
        setPhase("playing");
        break;
      }
      case "vote_difficulty": {
        const m = msg as WSVoteDifficulty;
        setVotes((v) => ({ ...v, [m.username]: m.seconds }));
        break;
      }
      case "next_question": {
        // The server closed this question (time up, or everyone answered).
        const m = msg as WSNextQuestion;
        if (phaseRef.current !== "playing" || m.question_index !== currentQRef.current || inTransitionRef.current) break;
        inTransitionRef.current = true;
        setInTransition(true);
        transitionTimer.current = setTimeout(() => {
          transitionTimer.current = null;
          setCurrentQ(m.question_index + 1);
          resetQuestionState();
          startCountdown(timerSecondsRef.current * 1000);
          inTransitionRef.current = false;
          setInTransition(false);
        }, TRANSITION_MS);
        break;
      }
      case "game_finished": {
        const m = msg as WSGameFinished;
        cancelTransition();
        setFinalLeaderboard(m.leaderboard);
        setRoomQDiff(m.question_difficulty);
        setRoomTags(m.tags);
        setQuestions(m.questions);
        setQuestionAnswers(m.answers);
        // Reflect canonical scores/counts.
        const finalScores: PlayerScores = {};
        const finalCounts: PlayerCounts = {};
        for (const entry of m.leaderboard) {
          finalScores[entry.username] = entry.score;
          finalCounts[entry.username] = entry.correct_count;
        }
        setScores(finalScores);
        setCorrectCounts(finalCounts);
        setPhase("results");

        // Record stats once, from the server's numbers so they match the leaderboard.
        const me = m.leaderboard.find((e) => e.username === myUsername);
        if (me && !statsSaved.current) {
          statsSaved.current = true;
          saveMultiplayerGame({
            topics: m.tags,
            correct: me.correct_count,
            total: m.total_questions,
            rank: me.rank,
            totalPlayers: m.leaderboard.length,
            score: me.score,
            questionDifficulty: m.question_difficulty,
          });
          if (!isLoggedIn()) incrementGuestGamesPlayed();
        }
        break;
      }
      case "new_game_ready": {
        const m = msg as WSNewGameReady;
        if (pendingNewRound.current) {
          pendingNewRound.current.resolve();
          pendingNewRound.current = null;
        }
        // A guest who has used up the free trial can't join the next round.
        if (guestMustRegister()) {
          sendWS({ type: "leave_room" });
          intentionalClose.current = true;
          clearRejoinToken(roomCode, myUsername);
          router.replace("/login?reason=trial_used");
          return;
        }
        setQuestions(m.questions);
        setRoomTags(m.tags);
        setRoomQDiff(m.question_difficulty);
        setTimerSeconds(m.timer_seconds);
        setCurrentQ(0);
        resetQuestionState();
        resetStreak();
        setShareOpen(false);
        setQuestionAnswers({});
        setFinalLeaderboard(null);
        setScores((s) => {
          const next: PlayerScores = {};
          for (const p of Object.keys(s)) next[p] = 0;
          return next;
        });
        setCorrectCounts((c) => {
          const next: PlayerCounts = {};
          for (const p of Object.keys(c)) next[p] = 0;
          return next;
        });
        statsSaved.current = false;
        setShowNewRound(false);
        setPhase("lobby");
        sendWS({ type: "vote_difficulty", seconds: myVoteRef.current });
        break;
      }
      case "error": {
        const m = msg as WSError;
        if (m.context === "new_game" && pendingNewRound.current) {
          pendingNewRound.current.reject(new Error(m.message));
          pendingNewRound.current = null;
        } else {
          console.warn("[room]", m.message);
        }
        break;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!myUsername || !hasUser() || guestMustRegister()) return;

    // React dev mode runs effects twice; reset so the second run can reconnect.
    intentionalClose.current = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const socket = createWebSocket(roomCode, myUsername, readRejoinToken(roomCode, myUsername));
      ws.current = socket;

      socket.onopen = () => {
        if (ws.current !== socket) return;
        reconnectCount.current = 0;
        setReconnectAttempt(0);
        setReconnecting(false);
        // The server answers with room_state, which sets the phase.
      };

      socket.onclose = (ev) => {
        // Ignore sockets we've already replaced.
        if (ws.current !== socket) return;
        ws.current = null;
        if (intentionalClose.current) return;

        const fatal = FATAL_CLOSE[ev.code];
        if (fatal) {
          setReconnecting(false);
          setPhase("error");
          setError(fatal);
          return;
        }

        reconnectCount.current += 1;
        setReconnectAttempt(reconnectCount.current);
        const delay = Math.min(1000 * Math.pow(2, reconnectCount.current - 1), 8000);
        setReconnecting(true);
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => { /* let onclose drive */ };

      socket.onmessage = (e) => {
        if (ws.current !== socket) return;
        try { handleMessage(JSON.parse(e.data as string) as WSMessage); } catch { /* ignore */ }
      };
    }

    function wakeReconnect() {
      if (intentionalClose.current) return;
      if (phaseRef.current === "error") return;
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

    // Open on the next tick: React dev mode mounts, unmounts and remounts
    // immediately, and a socket opened in between would join and leave at once.
    retryTimer = setTimeout(connect, 0);
    return () => {
      intentionalClose.current = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", wakeReconnect);
      window.removeEventListener("online", wakeReconnect);
      const sock = ws.current;
      ws.current = null;
      sock?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Display-only countdown; the server decides when a question ends.
  // Display-only countdown; it stops once the question closes.
  useEffect(() => {
    if (phase !== "playing" || inTransition || closed) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left !== lastTick.current && left > 0 && left <= 5 && answeredRef.current === null) play("tick");
      lastTick.current = left;
    }, 250);
    return () => clearInterval(interval);
  }, [phase, inTransition, closed]);

  useKeepAboveFeedback(optionsRef, phase === "playing" && (answered !== null || closed) && !inTransition);

  // Results: a cheer for the winner (everyone else gets a smaller one).
  useEffect(() => {
    if (phase !== "results") return;
    const won = finalLeaderboard?.find((e) => e.username === myUsername)?.rank === 1;
    const t = window.setTimeout(() => {
      if (won) { play("fanfare"); pulseDots({ tone: "hl", strength: 1.4 }); }
      else play("streak");
    }, 700);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function vote(seconds: number) {
    setMyVoteSeconds(seconds);
    myVoteRef.current = seconds;
    sendWS({ type: "vote_difficulty", seconds });
  }

  function startGame() {
    sendWS({ type: "start_game" });
  }

  function submitAnswer(i: number, el?: HTMLElement) {
    if (answered !== null || closed) return;
    pickedEl.current = el ?? null;
    if (sendWS({ type: "submit_answer", data: { question_index: currentQ, answer_index: i } })) setAnswered(i);
  }

  function submitSkip() {
    if (answered !== null || closed) return;
    if (sendWS({ type: "skip_question", data: { question_index: currentQ } })) {
      setAnswered(-1);
      breakStreak();
      play("tap");
    }
  }

  async function copyCode() {
    try {
      await copyText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the code stays on screen to copy by hand */ }
  }

  function leaveRoom(to: string) {
    sendWS({ type: "leave_room" });
    intentionalClose.current = true;
    clearRejoinToken(roomCode, myUsername);
    router.push(to);
  }

  /** Host asks the server for a new round; settles when the server answers. */
  function startNewRound(params: {
    tags: string[];
    count: number;
    questionDifficulty: QuestionDifficulty;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const sent = sendWS({
        type: "request_new_game",
        data: { tags: params.tags, count: params.count, question_difficulty: params.questionDifficulty },
      });
      if (!sent) {
        reject(new Error("You're not connected to the room right now. Try again in a moment."));
        return;
      }
      const timer = setTimeout(() => {
        pendingNewRound.current = null;
        reject(new Error("The server took too long to make the new round. Try again."));
      }, 90_000);
      pendingNewRound.current = {
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      };
    });
  }

  function openNewRound() {
    if (guestMustRegister()) {
      leaveRoom("/login?reason=trial_used");
      return;
    }
    setShowNewRound(true);
  }

  // Sorted scores for in-game scoreboard. Stable order on ties (alphabetical)
  // matches the server's tie-break so ranks don't flicker.
  const sortedScores = Object.entries(scores).sort(([an, a], [bn, b]) => {
    if (b !== a) return b - a;
    const ac = correctCounts[an] ?? 0;
    const bc = correctCounts[bn] ?? 0;
    if (bc !== ac) return bc - ac;
    return an.localeCompare(bn);
  });
  const q = questions[currentQ];

  const [copiedLink, setCopiedLink] = useState(false);
  async function copyLink() {
    try {
      await copyText(`${window.location.origin}/room/${roomCode}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch { /* the code is on screen to share by hand */ }
  }

  const ReconnectingBanner = (
    <AnimatePresence>
      {reconnecting && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2.5 border-b-2 border-ink bg-hl text-hl-ink py-2.5 px-4 font-extrabold text-sm"
          role="status"
        >
          <Wifi size={16} className="animate-pulse" />
          Reconnecting… (attempt {reconnectAttempt})
        </motion.div>
      )}
    </AnimatePresence>
  );

  /** Slim bar for room screens that aren't mid-question. */
  const RoomBar = (
    <nav className="sticky top-0 z-30 h-16 border-b-2 border-ink bg-card">
      <div className="h-full max-w-5xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[28px]"><Logo /></span>
          <span aria-hidden="true" className="h-6 w-0.5 rounded-full" style={{ background: "var(--line-soft)" }} />
          <span className="font-mono text-base sm:text-lg font-black tracking-[0.2em] text-ink">{roomCode}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => leaveRoom(phase === "lobby" ? "/multiplayer" : getHomePath())}
            className="sketch-btn-light gap-1.5 px-3 h-10 text-sm focus-ring"
          >
            <LogOut size={15} /> <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>
    </nav>
  );

  // ── CONNECTING ──────────────────────────────────────────────────────────
  if (phase === "connecting") {
    return (
      <div className="min-h-svh flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="text-center"
          role="status"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl border-2 border-ink bg-hl text-hl-ink shadow-[4px_4px_0_var(--shadow)] flex items-center justify-center">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <p className="mt-6 font-heading text-2xl text-ink">Joining room</p>
          <p className="mt-1 font-mono text-xl font-black tracking-[0.25em] text-ink-soft">{roomCode}</p>
          {reconnecting && (
            <p className="mt-3 text-sm font-semibold text-ink-muted">
              Can&apos;t reach the server yet (attempt {reconnectAttempt}). Retrying…
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── ERROR ───────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-svh flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="w-full max-w-sm sketch-card p-6 sm:p-8 text-center"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl border-2 border-bad bg-bad-tint flex items-center justify-center">
            <AlertTriangle size={26} className="text-bad" />
          </div>
          <h1 className="mt-5 font-heading text-3xl text-ink">Couldn&apos;t join</h1>
          <p className="mt-2 text-base font-semibold text-ink-soft">{error || "Room not found or the server is unreachable."}</p>
          <button onClick={() => router.push("/multiplayer")} className="mt-6 w-full sketch-btn-accent gap-2 h-12 text-base focus-ring">
            Back to multiplayer <ArrowRight size={17} />
          </button>
        </motion.div>
      </div>
    );
  }

  // ── LOBBY ───────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    const calculatedTimer = calcTimer(votes);
    const votedCount = Object.keys(votes).length;
    const voteTally: Record<number, number> = {};
    for (const sec of Object.values(votes)) voteTally[sec] = (voteTally[sec] ?? 0) + 1;
    const voteChoices = MULTI_DIFFICULTIES.map((d) => ({
      value: DIFFICULTY_CONFIG[d].seconds,
      label: `${DIFFICULTY_CONFIG[d].seconds}s`,
      sub: d === "easy" ? "Relaxed" : d === "medium" ? "Steady" : "Frantic",
      icon: timerIcon(DIFFICULTY_CONFIG[d].seconds),
    }));

    return (
      <div className="min-h-svh flex flex-col">
        {ReconnectingBanner}
        {RoomBar}
        <motion.main
          variants={stagger(0.07)}
          initial="hidden"
          animate="show"
          className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-8 items-start"
        >
          <div className="space-y-6">
            {/* The ticket: code to read out, buttons to share it */}
            <motion.section variants={fadeUp} className="sketch-card overflow-clip">
              <div className="p-5 sm:p-7">
                <h1 className="font-heading text-3xl sm:text-4xl text-ink leading-none">Get your friends in</h1>
                <p className="mt-2 text-sm font-bold text-ink-muted">They join from Multiplayer with this code.</p>
                <div className="mt-5 flex gap-1.5 sm:gap-2" aria-label={`Room code ${roomCode.split("").join(" ")}`}>
                  {roomCode.split("").map((ch, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className="flex-1 max-w-16 h-14 sm:h-16 rounded-xl border-2 border-ink bg-paper flex items-center justify-center font-mono text-3xl sm:text-4xl font-black text-ink"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <button onClick={copyCode} className="sketch-btn-light gap-2 h-11 text-sm focus-ring">
                    {copied ? <><Check size={16} className="text-good" /> Copied</> : <><Copy size={16} /> Copy code</>}
                  </button>
                  <button onClick={copyLink} className="sketch-btn-light gap-2 h-11 text-sm focus-ring">
                    {copiedLink ? <><Check size={16} className="text-good" /> Copied</> : <><Link2 size={16} /> Copy link</>}
                  </button>
                </div>
              </div>
              {roomTags.length > 0 && (
                <div className="border-t-2 border-dashed border-ink bg-hl-soft px-5 sm:px-7 py-4 flex flex-wrap items-center gap-1.5">
                  {roomTags.map((t) => (
                    <span key={t} className="rounded-full border-2 border-ink bg-hl px-2.5 py-0.5 text-xs font-extrabold text-hl-ink">{t}</span>
                  ))}
                  <span className="ml-1 text-sm font-bold text-ink-soft">
                    · {questions.length > 0 ? `${questions.length} questions · ` : ""}{QUESTION_DIFFICULTY_CONFIG[roomQDiff].label}
                  </span>
                </div>
              )}
            </motion.section>

            {/* Who's here */}
            <motion.section variants={fadeUp} className="sketch-card p-5 sm:p-7">
              <h2 className="font-heading text-xl text-ink">
                Players <span className="text-ink-muted tabular-nums">{players.length}</span>
              </h2>
              {players.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-ink-muted">Waiting for players to join…</p>
              ) : (
                <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <AnimatePresence initial={false}>
                    {players.map((p) => (
                      <motion.li
                        key={p}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 ${p === myUsername ? "border-ink bg-hl-soft" : "border-line-soft bg-card"}`}
                      >
                        <Avatar name={p} size={30} />
                        <span className="flex-1 min-w-0 truncate text-sm font-extrabold text-ink">
                          {p}{p === myUsername && <span className="font-semibold text-ink-muted"> (you)</span>}
                        </span>
                        {p === hostUsername && <Crown size={15} className="text-ink shrink-0" aria-label="Host" />}
                        {votes[p] !== undefined && (
                          <span className="flex items-center gap-1 text-xs font-extrabold text-ink-soft tabular-nums shrink-0" aria-label={`voted ${votes[p]} seconds`}>
                            {timerIcon(votes[p], 13)}{votes[p]}s
                          </span>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </motion.section>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24">
            {/* Timer vote */}
            <motion.section variants={fadeUp} className="sketch-card p-5 sm:p-7">
              <ChoiceGrid
                label="How long per question?"
                hint="Everyone votes. The timer is the average."
                options={voteChoices}
                value={myVoteSeconds}
                onChange={vote}
                columns="grid-cols-3"
                badge={(v) => (voteTally[v] ?? 0) > 0 ? (
                  <span className="absolute top-1.5 right-2 text-xs font-extrabold tabular-nums">{voteTally[v]}</span>
                ) : null}
              />
              <p className="mt-4 text-sm font-bold text-ink-muted">
                {votedCount > 0
                  ? <>{votedCount} voted · timer will be <span className="text-ink">{calculatedTimer}s</span></>
                  : "Nobody has voted yet."}
              </p>
            </motion.section>

            {isHost ? (
              <motion.div variants={fadeUp}>
                <button onClick={startGame} disabled={players.length === 0} className="w-full sketch-btn-accent gap-2 h-16 text-xl focus-ring">
                  <Play size={22} /> Start the game
                </button>
                <p className="mt-3 text-center text-sm font-bold text-ink-muted">You&apos;re the host. Start whenever everyone&apos;s in.</p>
              </motion.div>
            ) : (
              <motion.div variants={fadeUp} className="sketch-card p-5 flex items-center gap-3" role="status">
                <Loader2 size={20} className="animate-spin text-ink-muted shrink-0" />
                <p className="text-sm font-extrabold text-ink">
                  Waiting for {hostUsername || "the host"} to start…
                </p>
              </motion.div>
            )}
          </div>
        </motion.main>
      </div>
    );
  }

  // ── TRANSITION ──────────────────────────────────────────────────────────
  if (phase === "playing" && inTransition) {
    const nextNum = Math.min(currentQ + 2, questions.length);
    return (
      <div className="min-h-svh flex items-center justify-center p-6">
        {ReconnectingBanner}
        <QuestionTransition nextNum={nextNum} total={questions.length} />
      </div>
    );
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────
  if (phase === "playing" && q) {
    const isSkipped = answered === -1;
    const picked = answered !== null && answered >= 0;
    // Colours only appear once the server has told us the right option.
    const known = correctIndex !== null;
    const isCorrect = myResult === true;
    const showBar = answered !== null || closed;
    const respondedHere = players.filter((p) => respondedUsers.has(p)).length;
    const waitingOn = players.length - respondedHere;
    const last = currentQ + 1 >= questions.length;
    const points = Math.round(10 * qDiffMultiplier(roomQDiff));
    const seed = currentQ * 7 + roomCode.charCodeAt(0);

    const stateFor = (i: number): OptionState => {
      if (answered === null && !closed) return "idle";
      if (!known) return picked && i === answered ? "picked" : "dim";
      if (i === answered) return i === correctIndex ? "correct" : "wrong";
      if (i === correctIndex) return "missed";
      return "dim";
    };

    const title = isSkipped ? "Skipped"
      : !known ? "Locked in"
      : !picked ? "Time's up"
      : isCorrect ? pick(RIGHT_HEADLINES, seed)
      : pick(WRONG_HEADLINES, seed);
    const tone = !known || isSkipped ? "neutral" : isCorrect ? "good" : "bad";

    const footer = closed
      ? <>{last ? "Final results coming up…" : "Next question coming up…"}{lostStreak >= 3 && <> That ends your streak of {lostStreak}.</>}</>
      : waitingOn > 0
        ? <>Waiting for {waitingOn} more player{waitingOn === 1 ? "" : "s"}…</>
        : <>Everyone&apos;s in.</>;

    return (
      <div className="min-h-svh flex flex-col">
        {ReconnectingBanner}

        <header className="sticky top-0 z-20 border-b-2 border-ink bg-card">
          <div className="max-w-5xl mx-auto h-16 px-4 sm:px-6 flex items-center gap-3">
            <ProgressTicks total={questions.length} current={currentQ} />
            <span className="text-sm font-extrabold text-ink tabular-nums whitespace-nowrap">
              {currentQ + 1}<span className="text-ink-muted">/{questions.length}</span>
            </span>
            {myStreak >= 2 && (
              <motion.span
                key={myStreak}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1 rounded-full border-2 border-ink bg-hl px-2 py-0.5 text-sm font-extrabold text-hl-ink"
                aria-label={`${myStreak} in a row`}
              >
                <Flame size={14} /> {myStreak}
              </motion.span>
            )}
            <SoundToggle />
            <TimerRing seconds={closed ? 0 : timeLeft} total={timerSeconds} size={46} />
          </div>
        </header>

        <Scoreboard variant="strip" sortedScores={sortedScores} myUsername={myUsername} respondedUsers={respondedUsers} />

        <div
          className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-10 flex gap-8"
          style={showBar ? { paddingBottom: "calc(var(--feedback-h, 14rem) + 1.5rem)" } : undefined}
        >
          <main className="flex-1 min-w-0 max-w-2xl mx-auto">
            <QuestionSheet number={currentQ + 1} category={q.category} stamp={stamp}>{q.question}</QuestionSheet>
            <div ref={optionsRef} key={`opts-${currentQ}`} className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {q.options.map((opt, i) => {
                const state = stateFor(i);
                return (
                  <OptionButton
                    key={i}
                    index={i}
                    text={opt}
                    state={state}
                    onPick={(el) => submitAnswer(i, el)}
                    note={state === "correct" ? `+${points}` : state === "missed" ? "this one!" : undefined}
                    remark={state === "wrong" ? reveal?.option_notes?.[i] || undefined : undefined}
                  />
                );
              })}
            </div>
            {!showBar && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={submitSkip}
                  className="flex items-center gap-1.5 rounded-lg px-4 h-11 text-sm font-extrabold text-ink-muted hover:text-ink transition-colors focus-ring"
                >
                  <SkipForward size={16} /> Skip this one
                </button>
              </div>
            )}
          </main>
          <Scoreboard variant="column" sortedScores={sortedScores} myUsername={myUsername} respondedUsers={respondedUsers} />
        </div>

        <AnimatePresence>
          {showBar && (
            <FeedbackBar
              key={`fb-${currentQ}-${known}`}
              tone={tone}
              title={title}
              aside={known && isCorrect ? <>+{points} points{myStreak >= 2 && <> · {myStreak} in a row</>}</> : undefined}
              explanation={known && !isCorrect && correctIndex !== null
                ? reveal?.explanation || `The answer was ${q.options[correctIndex]}.`
                : undefined}
              quip={known && !isSkipped ? (isCorrect ? reveal?.quip_right : reveal?.quip_wrong) || undefined : undefined}
              fact={known ? reveal?.fact || undefined : undefined}
              footer={footer}
              drainMs={closed ? REVEAL_MS : undefined}
              action={
                <div className="flex -space-x-1.5 shrink-0" aria-label={`${respondedHere} of ${players.length} answered`}>
                  {players.map((p) => (
                    <span key={p} className={`rounded-full transition-opacity ${respondedUsers.has(p) ? "" : "opacity-30"}`} title={p}>
                      <Avatar name={p} size={30} />
                    </span>
                  ))}
                </div>
              }
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────
  // Prefer the authoritative leaderboard from the server when present.
  const resultsRows: LeaderboardEntry[] = finalLeaderboard
    ?? sortedScores.map(([name, score], i) => ({
      username: name,
      score,
      correct_count: correctCounts[name] ?? 0,
      rank: i + 1,
    }));
  const me = resultsRows.find((r) => r.username === myUsername);
  const podium = resultsRows.length >= 2 ? [resultsRows[1], resultsRows[0], resultsRows[2]].filter(Boolean) : [];
  const headline = !me ? "Game over" : me.rank === 1 ? "You won!" : `You came ${ORDINAL(me.rank)}`;
  const won = me?.rank === 1 && resultsRows.length > 1;
  const myPct = me && questions.length ? Math.round((me.correct_count / questions.length) * 100) : 0;

  const myMarks = questions.map((_, i): "good" | "bad" | "skip" => {
    const mine = questionAnswers[i]?.[myUsername];
    return mine === true ? "good" : mine === false ? "bad" : "skip";
  });
  const comment = teacherComment(myPct, (me?.score ?? 0) + currentQ);
  const standing = me ? `${ORDINAL(me.rank)} of ${resultsRows.length}` : "";
  const shareCaption = me ? [
    `Qrio room · ${roomTags.join(", ")}`,
    `${resultGrid(myMarks)} ${me.correct_count}/${questions.length} · ${me.score} pts`,
    won ? `Won against ${resultsRows.length - 1} other${resultsRows.length === 2 ? "" : "s"}` : standing,
    typeof window !== "undefined" ? window.location.origin : "",
  ].join("\n") : "";

  return (
    <div className="min-h-svh flex flex-col">
      {ReconnectingBanner}
      {RoomBar}
      {won && <Confetti />}
      <motion.main
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6"
      >
        <motion.header variants={fadeUp} className="text-center">
          <p className="font-hand text-3xl text-ink-muted">game over</p>
          <h1 className="font-heading text-5xl sm:text-6xl text-ink leading-none mt-1">{headline}</h1>
          <p className="mt-3 text-sm font-bold text-ink-muted">
            {resultsRows.length} player{resultsRows.length === 1 ? "" : "s"}
            {roomTags.length > 0 && <> · {roomTags.join(", ")} · {QUESTION_DIFFICULTY_CONFIG[roomQDiff].label}</>}
          </p>
          {me && (
            <motion.p
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 0.9, delay: 0.9, ease: EASE }}
              className="mt-4 font-hand text-2xl sm:text-[28px] leading-tight text-bad -rotate-1 text-balance"
            >
              {comment}
            </motion.p>
          )}
        </motion.header>

        {/* Podium: 2nd, 1st, 3rd */}
        {podium.length > 0 && (
          <motion.section
            variants={fadeUp}
            className="grid gap-2 sm:gap-4 items-end pt-4 mx-auto w-full border-b-2 border-ink"
            style={{ gridTemplateColumns: `repeat(${podium.length}, minmax(0, 1fr))`, maxWidth: podium.length === 2 ? "22rem" : undefined }}
            aria-label="Podium"
          >
            {podium.map((e) => {
              const first = e.rank === 1;
              const h = e.rank === 1 ? "h-32 sm:h-36" : e.rank === 2 ? "h-24 sm:h-28" : "h-16 sm:h-20";
              return (
                <div key={e.username} className="flex flex-col items-center min-w-0">
                  {first && <Crown size={22} className="text-ink mb-1" aria-label="Winner" />}
                  <Avatar name={e.username} size={first ? 52 : 42} />
                  <p className={`mt-2 w-full truncate text-center text-sm sm:text-base font-extrabold ${e.username === myUsername ? "text-ink" : "text-ink-soft"}`}>
                    {e.username === myUsername ? "You" : e.username}
                  </p>
                  <p className="text-sm font-bold text-ink-muted tabular-nums">{e.score} pts</p>
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 + (3 - e.rank) * 0.12, ease: EASE }}
                    className={`mt-2 w-full origin-bottom rounded-t-xl border-2 border-b-0 border-ink flex items-start justify-center pt-2 ${h} ${first ? "bg-hl text-hl-ink" : "bg-card text-ink"}`}
                  >
                    <span className="font-heading text-3xl sm:text-4xl">{e.rank}</span>
                  </motion.div>
                </div>
              );
            })}
          </motion.section>
        )}

        <motion.section variants={fadeUp} className="sketch-card overflow-clip -mt-px">
          <h2 className="px-5 sm:px-6 py-4 border-b-2 border-ink font-heading text-xl text-ink">Leaderboard</h2>
          <ol>
            {resultsRows.map((entry, i) => {
              const pct = questions.length > 0 ? Math.round((entry.correct_count / questions.length) * 100) : 0;
              const isMe = entry.username === myUsername;
              return (
                <li
                  key={entry.username}
                  className={`flex items-center gap-3 px-5 sm:px-6 py-3.5 ${i < resultsRows.length - 1 ? "border-b-2 border-line-faint" : ""} ${isMe ? "bg-hl-soft" : ""}`}
                >
                  <span className="w-7 text-center font-heading text-xl text-ink shrink-0 tabular-nums">{entry.rank}</span>
                  <Avatar name={entry.username} size={32} />
                  <span className="flex-1 min-w-0 truncate font-extrabold text-ink">
                    {entry.username}{isMe && <span className="font-semibold text-ink-muted"> (you)</span>}
                  </span>
                  <div className="text-right shrink-0">
                    <p className="font-heading text-xl text-ink tabular-nums leading-none">{entry.score}</p>
                    <p className="mt-1 text-xs font-bold text-ink-muted tabular-nums">{entry.correct_count}/{questions.length} · {pct}%</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </motion.section>

        {questions.length > 0 && (
          <motion.section variants={fadeUp} className="sketch-card overflow-clip">
            <h2 className="px-5 sm:px-6 py-4 border-b-2 border-ink font-heading text-xl text-ink">Question by question</h2>
            <ol className="divide-y-2 divide-line-faint">
              {questions.map((question, i) => {
                const qa = questionAnswers[i] ?? {};
                const correctNames = Object.entries(qa).filter(([, c]) => c).map(([u]) => u);
                const wrongNames = Object.entries(qa).filter(([, c]) => !c).map(([u]) => u);
                const mine = qa[myUsername];
                return (
                  <li key={i}>
                    <details className="group">
                      <summary className="flex items-center gap-3 px-5 sm:px-6 py-4 hover:bg-card-soft transition-colors">
                        <span className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center ${mine === true ? "border-good text-good" : mine === false ? "border-bad text-bad" : "border-line-soft text-ink-faint"}`}>
                          {mine === true ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                        </span>
                        <span className="flex-1 min-w-0 text-sm sm:text-base font-bold text-ink line-clamp-2">{question.question}</span>
                        <span className="shrink-0 text-xs font-extrabold text-ink-muted tabular-nums">{correctNames.length}/{correctNames.length + wrongNames.length}</span>
                        <ChevronDown size={16} className="chevron text-ink-muted shrink-0" />
                      </summary>
                      <div className="px-5 sm:px-6 pb-4 pl-16 sm:pl-[4.25rem] space-y-1.5 text-sm font-semibold text-ink-soft">
                        {question.answer !== undefined && (
                          <p>Answer: <span className="font-extrabold text-good">{question.options[question.answer]}</span></p>
                        )}
                        {correctNames.length > 0 && <p>Got it: <span className="text-ink">{correctNames.join(", ")}</span></p>}
                        {wrongNames.length > 0 && <p>Missed: <span className="text-ink">{wrongNames.join(", ")}</span></p>}
                        {correctNames.length === 0 && wrongNames.length === 0 && <p className="text-ink-muted">Nobody answered this one.</p>}
                        {question.fact && (
                          <p className="flex gap-1.5 pt-1 text-ink-muted">
                            <Lightbulb size={14} className="shrink-0 mt-0.5" aria-hidden="true" /> {question.fact}
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </motion.section>
        )}

        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 pb-4">
          {isHost ? (
            <button onClick={openNewRound} className="flex-1 sketch-btn-accent gap-2 h-14 text-base focus-ring">
              <RotateCcw size={18} /> New round here
            </button>
          ) : (
            <div className="flex-1 sketch-card h-14 px-4 flex items-center justify-center gap-2.5 text-sm font-extrabold text-ink-soft" role="status">
              <Loader2 size={16} className="animate-spin shrink-0" /> Waiting for {hostUsername || "the host"} to start another round
            </div>
          )}
          {me && (
            <button onClick={() => setShareOpen(true)} className="flex-1 sketch-btn-light gap-2 h-14 text-base focus-ring">
              <Share2 size={18} /> Share result
            </button>
          )}
          <button onClick={() => leaveRoom(getHomePath())} className="flex-1 sketch-btn-light gap-2 h-14 text-base focus-ring">
            <Home size={18} /> Leave room
          </button>
        </motion.div>
      </motion.main>

      <NewRoundDialog open={showNewRound} onClose={() => setShowNewRound(false)} onStart={startNewRound} />
      {me && (
        <ShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          text={shareCaption}
          card={{
            mode: "Multiplayer",
            topics: roomTags,
            difficulty: QUESTION_DIFFICULTY_CONFIG[roomQDiff].label,
            correct: me.correct_count,
            total: questions.length,
            score: me.score,
            verdict: headline,
            title: standing,
            titleLabel: "Final standing",
            grid: myMarks,
            comment,
            stamps: won ? ["Room champion"] : [],
          }}
        />
      )}
    </div>
  );
}
