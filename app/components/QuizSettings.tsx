"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dices, Flame, Infinity as InfinityIcon, Leaf, Skull, Swords, Target, Timer, X,
} from "lucide-react";
import { qDiffMultiplier } from "@/lib/stats";
import { EASE } from "@/lib/motion";
import { FUN_TOPICS, randomPick } from "@/lib/fun";
import { play } from "@/lib/sound";
import {
  DIFFICULTY_CONFIG,
  QUESTION_DIFFICULTY_CONFIG,
  type Difficulty,
  type QuestionDifficulty,
} from "@/lib/types";

/** Shared quiz set-up controls: solo, room creation and "new round" use them. */

const MAX_TOPICS = 10;
const SUGGESTIONS = ["World capitals", "90s movies", "Space", "Football", "Greek myths", "Chemistry"];

export function TopicInput({
  tags,
  onChange,
  autoFocus = false,
  suggestions = true,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  autoFocus?: boolean;
  suggestions?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const t = raw.trim().replace(/,+$/, "").slice(0, 50);
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()) && tags.length < MAX_TOPICS) {
      onChange([...tags, t]);
    }
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
  }

  const has = (s: string) => tags.some((t) => t.toLowerCase() === s.toLowerCase());
  const unused = SUGGESTIONS.filter((s) => !has(s)).slice(0, 4);
  const showSuggestions = tags.length < MAX_TOPICS;

  function surprise() {
    const fresh = FUN_TOPICS.filter((t) => !has(t));
    if (fresh.length === 0) return;
    add(randomPick(fresh));
    play("tap");
  }

  return (
    <div>
      <label htmlFor={id} className="field-label mb-2">
        Topics
        <span className="ml-auto text-xs font-bold text-ink-faint tabular-nums">{tags.length}/{MAX_TOPICS}</span>
      </label>
      <div
        className="flex flex-wrap items-center gap-2 p-2.5 sketch-inset min-h-[56px] cursor-text"
        onClick={() => document.getElementById(id)?.focus()}
      >
        <AnimatePresence initial={false}>
          {tags.map((tag) => (
            <motion.span
              key={tag}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-hl text-hl-ink pl-3 pr-1 py-0.5 text-sm font-extrabold max-w-full"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(tags.filter((t) => t !== tag)); }}
                className="tap-inline w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-black/10 focus-ring"
                aria-label={`Remove ${tag}`}
              >
                <X size={13} strokeWidth={3} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          id={id}
          autoFocus={autoFocus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          enterKeyHint="done"
          maxLength={50}
          disabled={tags.length >= MAX_TOPICS}
          placeholder={tags.length === 0 ? "Type a topic and press Enter" : tags.length >= MAX_TOPICS ? "That's the max" : "Add more…"}
          className="flex-1 min-w-[6rem] bg-transparent outline-none text-base text-ink placeholder-ink-ghost px-1.5 py-1"
        />
      </div>
      {/* One line that never wraps and never unmounts, so adding or removing a
          topic can't change its height and shove the rest of the form around.
          The padding leaves room for focus rings; the fade hints at more on phones. */}
      {suggestions && (
        <div
          className={`relative mt-1 -mx-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pl-1.5 pr-10 py-1.5 [mask-image:linear-gradient(to_right,#000_calc(100%_-_2.5rem),transparent)] ${showSuggestions ? "" : "invisible"}`}
        >
          <button
            type="button"
            onClick={surprise}
            className="tap-inline shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-ink bg-card px-2.5 py-1 text-xs font-extrabold text-ink hover:bg-hl hover:text-hl-ink hover:border-ink transition-colors focus-ring"
          >
            <Dices size={14} /> Surprise me
          </button>
          <span className="shrink-0 text-xs font-bold text-ink-muted mx-0.5">or try</span>
          <AnimatePresence initial={false} mode="popLayout">
            {unused.map((s) => (
              <motion.button
                key={s}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.2, ease: EASE }}
                type="button"
                onClick={() => add(s)}
                className="tap-inline shrink-0 whitespace-nowrap rounded-full border-2 border-dashed border-line-soft px-2.5 py-1 text-xs font-bold text-ink-soft hover:border-ink hover:text-ink transition-colors focus-ring"
              >
                + {s}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export interface Choice<T> {
  value: T;
  label: string;
  sub?: string;
  icon: React.ReactNode;
}

/** A row/grid of big tappable choices; the picked one is highlighted. */
export function ChoiceGrid<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange,
  columns = "grid-cols-2 sm:grid-cols-4",
  badge,
}: {
  label?: string;
  hint?: string;
  options: Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: string;
  /** Extra content pinned to a tile's corner (vote counts). */
  badge?: (v: T) => React.ReactNode;
}) {
  return (
    <fieldset>
      {label && <legend className="field-label mb-0.5">{label}</legend>}
      {hint && <p className="text-xs text-ink-muted font-semibold mb-2.5">{hint}</p>}
      <div role="radiogroup" className={`grid gap-2.5 ${columns} ${label && !hint ? "mt-2" : ""}`}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-[background-color,border-color,box-shadow,translate] duration-150 touch-manipulation focus-ring ${
                active
                  ? "bg-hl text-hl-ink border-ink shadow-[3px_3px_0_var(--shadow)] -translate-x-px -translate-y-px"
                  : "bg-card text-ink-soft border-line-soft hover:border-ink hover:text-ink"
              }`}
            >
              <span aria-hidden="true">{o.icon}</span>
              <span className="text-sm font-extrabold leading-none">{o.label}</span>
              {o.sub && <span className={`text-xs font-bold leading-tight ${active ? "opacity-80" : "text-ink-muted"}`}>{o.sub}</span>}
              {badge?.(o.value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function questionDifficultyIcon(d: QuestionDifficulty, size = 20) {
  if (d === "easy") return <Leaf size={size} />;
  if (d === "medium") return <Target size={size} />;
  if (d === "hard") return <Skull size={size} />;
  return <Swords size={size} />;
}

export function timerIcon(seconds: number, size = 20) {
  if (seconds === 0) return <InfinityIcon size={size} />;
  if (seconds >= 25) return <Leaf size={size} />;
  if (seconds >= 12) return <Timer size={size} />;
  return <Flame size={size} />;
}

export const QUESTION_DIFFICULTY_CHOICES: Choice<QuestionDifficulty>[] =
  (Object.keys(QUESTION_DIFFICULTY_CONFIG) as QuestionDifficulty[]).map((d) => ({
    value: d,
    label: QUESTION_DIFFICULTY_CONFIG[d].label,
    sub: `${qDiffMultiplier(d)}× points`,
    icon: questionDifficultyIcon(d),
  }));

export const TIMER_CHOICES: Choice<Difficulty>[] =
  (Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => ({
    value: d,
    label: d === "none" ? "No timer" : `${DIFFICULTY_CONFIG[d].seconds}s`,
    sub: d === "none" ? "Take your time" : DIFFICULTY_CONFIG[d].label,
    icon: timerIcon(DIFFICULTY_CONFIG[d].seconds),
  }));

/** Question-count slider with the value written large beside the label. */
export function CountSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const id = useId();
  const min = 3, max = 20;
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label htmlFor={id} className="field-label">Questions</label>
        <span className="font-heading text-2xl text-ink tabular-nums leading-none">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
      <div className="flex justify-between text-xs font-bold text-ink-muted">
        <span>Quick · {min}</span><span>Marathon · {max}</span>
      </div>
    </div>
  );
}
