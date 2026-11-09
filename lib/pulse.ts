/**
 * Lets any screen make the dot-grid background react: a ripple of swelling
 * dots from a point, optionally with a shake. <DotField> listens for these.
 */

export type PulseTone = "hl" | "good" | "bad";

export interface Pulse {
  /** Viewport coordinates of the ripple's centre; defaults to the middle of the screen. */
  x?: number;
  y?: number;
  tone?: PulseTone;
  /** 0–1.5; how much the dots swell. */
  strength?: number;
  /** Make the whole grid jitter for a moment, like a buzz. */
  shake?: boolean;
}

export const PULSE_EVENT = "qrio:pulse";

export function pulseDots(pulse: Pulse = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Pulse>(PULSE_EVENT, { detail: pulse }));
}

/** Ripple out from the centre of an element (a tapped answer, a stamp). */
export function pulseFrom(el: Element | null | undefined, pulse: Omit<Pulse, "x" | "y"> = {}) {
  const r = el?.getBoundingClientRect();
  pulseDots({ ...pulse, x: r ? r.left + r.width / 2 : undefined, y: r ? r.top + r.height / 2 : undefined });
}
