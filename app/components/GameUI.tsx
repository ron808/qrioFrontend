"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lightbulb, Volume2, VolumeX, X } from "lucide-react";
import { EASE } from "@/lib/motion";
import { GET_READY, pick, type Callout } from "@/lib/fun";
import { play, setSoundOn, useSoundOn } from "@/lib/sound";
import { MarkerLoop } from "./Marks";

/** Pieces of the in-game screen shared by solo and multiplayer rooms. */

/** Pause between questions (matches the server's transition in rooms). */
export const TRANSITION_MS = 1500;
/** How long a room shows the marked question before moving on (matches the server's revealMs). */
export const REVEAL_MS = 4500;
/** A stamp lands just after the answer is marked; play its sound after this many seconds. */
export const STAMP_DELAY = 0.3;

const LETTERS = ["A", "B", "C", "D"];

/**
 * idle     — can still be picked
 * picked   — chosen, waiting for the verdict (rooms)
 * correct  — chosen and right: the letter gets circled
 * wrong    — chosen and wrong: the text gets struck through
 * missed   — the right answer you didn't pick: circled after your strike
 * dim      — out of play
 */
export type OptionState = "idle" | "picked" | "correct" | "wrong" | "missed" | "dim";

const OPTION_STYLE: Record<OptionState, string> = {
  idle:    "bg-card border-ink text-ink shadow-[3px_3px_0_var(--shadow)] pressable pressable-flat cursor-pointer",
  picked:  "bg-hl border-ink text-hl-ink shadow-[3px_3px_0_var(--shadow)]",
  correct: "bg-good-tint border-good text-ink shadow-[3px_3px_0_var(--good-mark)] animate-pop",
  wrong:   "bg-bad-tint border-bad text-ink shadow-[3px_3px_0_var(--bad-mark)] animate-shake",
  missed:  "bg-card border-good text-ink",
  dim:     "bg-card border-line-soft text-ink-faint opacity-55",
};

const BADGE_STYLE: Record<OptionState, string> = {
  idle:    "bg-card border-ink text-ink",
  picked:  "bg-ink border-ink text-on-ink",
  correct: "bg-card border-good text-good",
  wrong:   "bg-card border-bad text-bad",
  missed:  "bg-card border-good text-good",
  dim:     "bg-card-soft border-line-soft text-ink-faint",
};

export function OptionButton({
  index,
  text,
  state,
  onPick,
  note,
  remark,
}: {
  index: number;
  text: string;
  state: OptionState;
  onPick: (el: HTMLElement) => void;
  /** Handwritten note at the end of the row, e.g. "+24" or "this one!". */
  note?: React.ReactNode;
  /** Handwritten remark under the text, e.g. why this answer is wrong. */
  remark?: string;
}) {
  const circled = state === "correct" || state === "missed";
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 + index * 0.05, ease: EASE }}
      onClick={(e) => onPick(e.currentTarget)}
      disabled={state !== "idle"}
      aria-label={`${LETTERS[index]}: ${text}`}
      className={`relative w-full flex items-center gap-3 rounded-xl border-2 px-3 py-3 sm:px-4 sm:py-3.5 text-left disabled:cursor-default focus-ring ${OPTION_STYLE[state]}`}
    >
      <span className={`relative w-9 h-9 shrink-0 self-start rounded-lg border-2 flex items-center justify-center font-heading text-base ${BADGE_STYLE[state]}`}>
        {state === "wrong" ? <X size={18} strokeWidth={3} /> : circled ? <Check size={18} strokeWidth={3} /> : LETTERS[index]}
        {circled && (
          <MarkerLoop
            className="-inset-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)]"
            delay={state === "missed" ? 0.35 : 0.05}
          />
        )}
      </span>
      <span className="flex-1 min-w-0 self-center text-[15px] sm:text-base font-bold leading-snug">
        <span className={state === "wrong" ? "strike-mark" : ""}>{text}</span>
        {remark && (
          // Written in after the strike lands, left to right like a pen.
          <motion.span
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
            className="block mt-1 font-hand text-[19px] leading-tight text-bad"
          >
            {remark}
          </motion.span>
        )}
      </span>
      {note && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: state === "missed" ? 0.6 : 0.25, ease: EASE }}
          className="shrink-0 font-hand text-2xl leading-none text-good -rotate-6"
        >
          {note}
        </motion.span>
      )}
    </motion.button>
  );
}

/** A rubber stamp that slams onto the paper: streaks, clutch answers, results. */
export function Stamp({ text, tone = "hl", className = "", delay = 0 }: {
  text: string;
  tone?: Callout["tone"] | "bad";
  className?: string;
  delay?: number;
}) {
  const color = tone === "good" ? "var(--good-mark)" : tone === "bad" ? "var(--bad-mark)" : "var(--hl)";
  return (
    <motion.span
      initial={{ scale: 2.2, opacity: 0, rotate: -16 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ duration: 0.3, delay, ease: [0.3, 1.35, 0.5, 1] }}
      className={`pointer-events-none inline-block rounded-lg border-[3px] px-3 py-1.5 font-heading text-base sm:text-lg uppercase tracking-[0.08em] leading-none whitespace-nowrap ${className}`}
      style={{
        color,
        borderColor: color,
        background: "color-mix(in srgb, var(--card) 88%, transparent)",
        // The thin inner line of a rubber stamp.
        boxShadow: `inset 0 0 0 2px var(--card), inset 0 0 0 3.5px ${color}`,
      }}
    >
      {text}
    </motion.span>
  );
}

/** Countdown ring; turns red for the last five seconds. */
export function TimerRing({ seconds, total, size = 56 }: { seconds: number; total: number; size?: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, seconds) / Math.max(1, total)) * circ;
  const danger = seconds <= 5;
  const stroke = danger ? "var(--bad-mark)" : "var(--ink)";
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r={r} fill="var(--card)" stroke="var(--line-soft)" strokeWidth="6" />
        <circle
          cx="30" cy="30" r={r} fill="none"
          stroke={stroke} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-heading tabular-nums ${danger ? "text-bad" : "text-ink"}`}
        style={{ fontSize: size * 0.36 }}
      >
        {seconds}
      </span>
    </div>
  );
}

export type TickState = "good" | "bad" | "skip" | "done" | null;

/** One segment per question: how each went, where you are, what's left. */
export function ProgressTicks({ total, current, results }: { total: number; current: number; results?: TickState[] }) {
  return (
    <div className="flex-1 flex items-center gap-1 min-w-0" aria-label={`Question ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const r = results?.[i] ?? (i < current ? "done" : null);
        const color =
          r === "good" ? "var(--good-mark)"
          : r === "bad" ? "var(--bad-mark)"
          : r === "skip" ? "var(--ink-ghost)"
          : r === "done" ? "var(--ink)"
          : i === current ? "var(--hl)"
          : "var(--line-soft)";
        return (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full transition-colors duration-300 ${i === current && !r ? "ring-2 ring-[var(--line)]" : ""}`}
            style={{ background: color }}
          />
        );
      })}
    </div>
  );
}

/** Mute / unmute the game's sound effects (remembered on this device). */
export function SoundToggle() {
  const on = useSoundOn();
  return (
    <button
      type="button"
      onClick={() => { setSoundOn(!on); if (!on) play("tap"); }}
      aria-pressed={on}
      aria-label={on ? "Mute sounds" : "Turn sounds on"}
      title={on ? "Mute sounds" : "Turn sounds on"}
      className="w-10 h-10 shrink-0 rounded-xl border-2 border-ink bg-card text-ink flex items-center justify-center focus-ring"
    >
      {on ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}

/** The question on a notebook sheet, with its number in the margin. */
export function QuestionSheet({ number, category, stamp, children }: {
  number: number;
  category?: string;
  /** Stamped onto the bottom corner after something special. */
  stamp?: Callout | null;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={number}
      initial={{ opacity: 0, y: 14, rotate: -0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="relative w-full sketch-card notebook pl-12 pr-5 sm:pl-16 sm:pr-7 py-8 sm:py-10 [--rule-h:2rem] sm:[--rule-h:2.5rem]"
    >
      {category && (
        <span className="absolute -top-3.5 right-4 max-w-[60%] truncate rotate-2 rounded-md border-2 border-ink bg-hl px-2.5 py-0.5 text-xs font-extrabold text-hl-ink shadow-[2px_2px_0_var(--shadow)]">
          {category}
        </span>
      )}
      <span aria-hidden="true" className="absolute left-1.5 sm:left-2 top-8 sm:top-10 w-7 sm:w-9 text-center font-hand text-2xl sm:text-3xl leading-8 sm:leading-10 text-ink-muted">
        {number}.
      </span>
      <h2 className="font-body font-extrabold text-ink text-[19px] leading-8 sm:text-2xl sm:leading-10 text-pretty">
        {children}
      </h2>
      {stamp && (
        <span className="absolute -bottom-4 right-3 sm:right-6 z-10" role="status">
          <Stamp key={stamp.text} text={stamp.text} tone={stamp.tone} delay={STAMP_DELAY} />
        </span>
      )}
    </motion.div>
  );
}

/** Between questions: the next number gets circled as the pause runs out. */
export function QuestionTransition({ nextNum, total }: { nextNum: number; total: number }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min((Date.now() - start) / TRANSITION_MS, 1);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center gap-6 text-center"
      role="status"
    >
      <div className="relative w-36 h-36 flex items-center justify-center">
        <MarkerLoop progress={progress} color="var(--ink)" strokeWidth={4} className="inset-0 w-full h-full" />
        <span className="font-heading text-6xl text-ink tabular-nums">{nextNum}</span>
      </div>
      <div>
        <p className="font-heading text-2xl text-ink">
          {nextNum === total ? "Last question" : `Question ${nextNum} of ${total}`}
        </p>
        <p className="font-hand text-2xl text-ink-muted mt-1">{pick(GET_READY, nextNum)}</p>
      </div>
    </motion.div>
  );
}

/**
 * The marking that rises from the bottom after an answer: the verdict, the
 * right answer explained, a joke in the margin and a fun fact, with the next
 * step in thumb reach. It publishes its height as --feedback-h so the page
 * can pad its bottom and nothing hides behind it.
 */
export function FeedbackBar({
  tone,
  title,
  aside,
  explanation,
  quip,
  fact,
  footer,
  action,
  drainMs,
}: {
  tone: "good" | "bad" | "neutral";
  title: string;
  /** Next to the title: points, streak. */
  aside?: React.ReactNode;
  /** The right answer in a sentence (after a miss). */
  explanation?: string;
  /** The joke, handwritten. */
  quip?: string;
  fact?: string;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  /** Show a bar that empties over this long (rooms move on by themselves). */
  drainMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const bg = tone === "good" ? "bg-good-tint" : tone === "bad" ? "bg-bad-tint" : "bg-card";
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--feedback-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--feedback-h"); };
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ y: "110%" }}
      animate={{ y: 0 }}
      exit={{ y: "110%" }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink ${bg}`}
      role="status"
      aria-live="polite"
    >
      {drainMs ? (
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 origin-left"
          style={{ background: "color-mix(in srgb, var(--ink) 30%, transparent)" }}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: drainMs / 1000, ease: "linear" }}
        />
      ) : null}
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className={`font-marker text-[28px] leading-none ${color}`}>{title}</p>
            {aside && <p className="text-sm font-extrabold text-ink-soft">{aside}</p>}
          </div>
          {explanation && (
            <p className="mt-2 text-[15px] font-bold leading-snug text-ink text-pretty">{explanation}</p>
          )}
          {quip && (
            <motion.p
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
              className={`mt-1.5 font-hand text-[22px] leading-tight ${color} text-pretty`}
            >
              {quip}
            </motion.p>
          )}
          {fact && (
            <p className="mt-2.5 flex gap-2 text-sm font-semibold leading-snug text-ink-soft text-pretty">
              <Lightbulb size={16} className="shrink-0 mt-px text-ink" aria-hidden="true" />
              <span><span className="font-extrabold text-ink">Fun fact:</span> {fact}</span>
            </p>
          )}
          {footer && <div className="mt-2 text-sm font-semibold text-ink-muted">{footer}</div>}
        </div>
        {action}
      </div>
    </motion.div>
  );
}

/**
 * After an answer, nudge the page so the marked options sit just above the
 * feedback bar instead of under it (mostly matters on phones).
 */
export function useKeepAboveFeedback(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--feedback-h")) || 0;
      const overlap = el.getBoundingClientRect().bottom - (window.innerHeight - bar - 16);
      if (overlap > 0) window.scrollBy({ top: overlap, behavior: "smooth" });
    }, 450);
    return () => window.clearTimeout(id);
  }, [ref, active]);
}
