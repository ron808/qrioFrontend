"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";

/**
 * Hand-drawn marks: the marker loop that circles a right answer, the
 * highlighter behind a word, the scribbled underline and arrow. They're the
 * app's signature, so they're used where something is being *marked* (an
 * answer, a score, the one word that matters), never as decoration.
 */

/** A loose marker loop that overshoots its start, drawn in over `duration`. */
export function MarkerLoop({
  color = "var(--good-mark)",
  delay = 0,
  duration = 0.45,
  progress,
  className = "",
  strokeWidth = 3,
  stretch = false,
}: {
  color?: string;
  delay?: number;
  duration?: number;
  /** Drive the stroke yourself (0–1) instead of animating it once. */
  progress?: number;
  className?: string;
  strokeWidth?: number;
  /** Fill a non-square box (an oval around a wide score). */
  stretch?: boolean;
}) {
  const reduce = useReducedMotion();
  const d = "M 14 34 C 22 12, 66 4, 88 18 C 106 30, 102 70, 78 86 C 58 98, 20 96, 9 76 C 0 58, 6 30, 34 14";
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio={stretch ? "none" : undefined}
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-visible ${className}`}
    >
      {progress !== undefined ? (
        <path
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - progress}
        />
      ) : (
        <motion.path
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration, delay, ease: EASE }}
        />
      )}
    </svg>
  );
}

/** A quick scribbled underline, drawn when it scrolls into view. */
export function Scribble({
  color = "var(--hl)",
  delay = 0.4,
  className = "",
}: { color?: string; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 200 16"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none block overflow-visible ${className}`}
    >
      <motion.path
        d="M 3 10 C 40 4, 90 6, 130 7 C 160 8, 182 5, 197 3 M 30 13 C 80 9, 140 11, 185 9"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        inherit={false}
        initial={{ pathLength: reduce ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        // A stretched path's box never reads as fully on screen, so half is enough.
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay, ease: EASE }}
      />
    </svg>
  );
}

/** A curly hand-drawn arrow, pointing right by default. */
export function DoodleArrow({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 120 60" fill="none" aria-hidden="true" className={`pointer-events-none ${className}`}>
      <motion.path
        d="M 6 40 C 28 8, 70 6, 104 30 M 104 30 L 88 28 M 104 30 L 98 16"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        inherit={false}
        initial={{ pathLength: reduce ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.7, delay, ease: EASE }}
      />
    </svg>
  );
}

/** A highlighter block behind a short word or two (kept on one line). */
export function Highlight({
  children,
  className = "",
  delay = 0.35,
}: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <span
      className={`relative inline-block whitespace-nowrap isolate hl-text ${className}`}
      style={{ animationDelay: `${reduce ? 0 : delay + 0.2}s` }}
    >
      <motion.span
        aria-hidden="true"
        className="absolute -inset-x-[0.14em] top-[0.08em] bottom-[-0.02em] -z-10 bg-hl"
        style={{
          borderRadius: "0.18em 0.5em 0.28em 0.6em / 0.55em 0.3em 0.5em 0.2em",
          transformOrigin: "left center",
          rotate: -1.5,
        }}
        initial={{ scaleX: reduce ? 1 : 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay, ease: EASE }}
      />
      {children}
    </span>
  );
}
