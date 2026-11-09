"use client";

import { useSyncExternalStore } from "react";

/**
 * Little synthesized sound effects, so there are no audio files to load.
 * Players can mute them; the choice is remembered on this device. The same
 * switch covers the short buzz on phones that support vibration.
 */

const KEY = "qrio_sound";
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    soundOn,
    () => true,
  );
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn() || document.hidden) return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Note {
  freq: number;
  start?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

/** One note with a quick attack and a soft decay. */
function note(ac: AudioContext, { freq, start = 0, dur = 0.12, type = "triangle", gain = 0.1, slideTo }: Note) {
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

const SOUNDS = {
  /** Two rising notes. */
  correct: (ac: AudioContext) => {
    note(ac, { freq: 659, dur: 0.11 });
    note(ac, { freq: 988, start: 0.08, dur: 0.22 });
  },
  /** A low, slightly comic "bwomp". */
  wrong: (ac: AudioContext) => {
    note(ac, { freq: 233, dur: 0.16, type: "square", gain: 0.04, slideTo: 196 });
    note(ac, { freq: 185, start: 0.14, dur: 0.3, type: "square", gain: 0.04, slideTo: 130 });
  },
  /** The clock's last seconds. */
  tick: (ac: AudioContext) => note(ac, { freq: 1400, dur: 0.035, type: "square", gain: 0.018 }),
  /** A rubber stamp landing. */
  stamp: (ac: AudioContext) => {
    note(ac, { freq: 150, dur: 0.14, type: "sine", gain: 0.25, slideTo: 55 });
    note(ac, { freq: 2200, dur: 0.03, type: "square", gain: 0.012 });
  },
  /** Streaks and new rounds: a quick arpeggio. */
  streak: (ac: AudioContext) => {
    [523, 659, 784, 1047].forEach((freq, i) => note(ac, { freq, start: i * 0.065, dur: 0.16, gain: 0.08 }));
  },
  /** End of a good game. */
  fanfare: (ac: AudioContext) => {
    [523, 659, 784].forEach((freq, i) => note(ac, { freq, start: i * 0.1, dur: 0.18, gain: 0.08 }));
    [1047, 1319].forEach((freq) => note(ac, { freq, start: 0.32, dur: 0.6, gain: 0.06 }));
  },
  /** A soft pencil tap for small things. */
  tap: (ac: AudioContext) => note(ac, { freq: 880, dur: 0.05, type: "sine", gain: 0.05 }),
};

export type SoundName = keyof typeof SOUNDS;

export function play(name: SoundName) {
  const ac = audio();
  if (!ac) return;
  try { SOUNDS[name](ac); } catch { /* audio is a nice-to-have */ }
}

/** A short vibration where the phone supports it (Android; iOS ignores it). */
export function buzz(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !soundOn()) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
