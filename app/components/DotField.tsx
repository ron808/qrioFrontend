"use client";

import { useEffect, useRef } from "react";
import { PAGE_CHANGE_EVENT } from "@/lib/navigation";
import { PULSE_EVENT, type Pulse, type PulseTone } from "@/lib/pulse";

/**
 * The dotted paper behind every page, drawn on a canvas so it can react:
 *  - the grid drifts slowly and scrolls at a slower pace than the page;
 *  - scrolling glitches it like a signal dropping out: the dots shake hard,
 *    bands tear sideways, a red/cyan split flickers and dots blink out, all
 *    scaling with how fast you scroll (a wrong answer does the same);
 *  - page changes leave it alone (<PageTransition> handles those), and it
 *    stays calm while a new page loads underneath;
 *  - tapping the bare background (or a pulseDots() call) sends a shockwave:
 *    a slightly lumpy ring that swells, shoves and rattles the dots as it
 *    passes, with a fainter echo behind it, tinted for right and wrong;
 *  - on a mouse, the dots under the pointer grow a little.
 *
 * Until it mounts, and for anyone who prefers reduced motion, the plain CSS
 * dot grid on <body> is shown instead.
 */

const GAP = 22; // same spacing as the CSS grid in globals.css
const DRIFT = { x: 4, y: 2.5 }; // px per second
const PARALLAX = 0.3; // the grid scrolls at 30% of the page's speed
// px/ms, px, ms; then at full strength: px pushed outwards, px of rattle, px the ring's edge wobbles
const RIPPLE = { speed: 1.25, width: 60, life: 1300, push: 7, rattle: 3.5, wobble: 9 };
const ECHO = { delay: 150, strength: 0.45 }; // the fainter second ring
const CALM_MS = 1500; // ignore scroll movement this long after a page change
const SHAKE = 7; // px of jitter at full glitch
const SPLIT = ["#ff3158", "#16d9ff"]; // the red / cyan of a broken signal
const HOVER_RADIUS = 90;
// Tapping these isn't tapping the paper.
const INTERACTIVE = "a,button,input,textarea,select,label,summary,[role='button'],[contenteditable='true']";

interface Ripple {
  x: number;
  y: number;
  t0: number;
  tone: PulseTone;
  strength: number;
  /** Shapes this ring's lumps so no two look the same. */
  seed: number;
}

interface Band {
  top: number;
  bottom: number;
  dx: number;
}

type Colors = Record<"dot" | PulseTone, string>;

/** True when the tap landed on the dotted paper itself, not on a card, field or control. */
function onBarePaper(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest(INTERACTIVE)) return false;
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage !== "none") return false;
    const bg = cs.backgroundColor;
    const clear = bg === "transparent" || /,\s*0\)$/.test(bg) || /\/\s*0\)$/.test(bg);
    if (!clear) return false;
  }
  return true;
}

export default function DotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fx = useRef<{ ripple(p: Pulse): void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let w = 0;
    let h = 0;
    let colors: Colors = { dot: "#d6d1c5", hl: "#ffd43b", good: "#16a34a", bad: "#dc2626" };
    const ripples: Ripple[] = [];
    let shake = 0; // from wrong answers
    let calmUntil = 0;
    let scrollEnergy = 0;
    let lastScroll = window.scrollY;
    let bands: Band[] = [];
    let frameNo = 0;
    let pointer: { x: number; y: number } | null = null;
    let drift = { x: 0, y: 0 };
    let last = performance.now();
    let raf = 0;

    function readColors() {
      const cs = getComputedStyle(root);
      const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
      colors = {
        dot: v("--paper-dot", colors.dot),
        hl: v("--hl", colors.hl),
        good: v("--good-mark", colors.good),
        bad: v("--bad-mark", colors.bad),
      };
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** A few horizontal strips that slide sideways, re-rolled every few frames. */
    function rollBands(g: number): Band[] {
      if (Math.random() > 0.35 + g * 0.55) return [];
      const count = 1 + Math.floor(Math.random() * (1 + g * 4));
      return Array.from({ length: count }, () => {
        const top = Math.random() * h;
        return {
          top,
          bottom: top + 10 + Math.random() * (30 + g * 60),
          dx: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 40 * g),
        };
      });
    }

    function draw(now: number) {
      const c = ctx!;
      c.clearRect(0, 0, w, h);
      const mod = (n: number) => ((n % GAP) + GAP) % GAP;
      const g = Math.min(1, Math.max(scrollEnergy, shake));
      // The whole sheet jolts a little too.
      const joltX = g > 0.01 ? (Math.random() - 0.5) * g * 6 : 0;
      const joltY = g > 0.01 ? (Math.random() - 0.5) * g * 4 : 0;
      const ox = mod(drift.x) + joltX;
      const oy = mod(drift.y - window.scrollY * PARALLAX) + joltY;

      const dots = new Path2D();
      const split = g > 0.15 ? [new Path2D(), new Path2D()] : null;
      const splitOff = 2 + g * 7;
      const tinted: Array<[number, number, number, number, PulseTone]> = [];

      for (let gx = ox - GAP; gx < w + GAP; gx += GAP) {
        for (let gy = oy - GAP; gy < h + GAP; gy += GAP) {
          if (g > 0.3 && Math.random() < g * 0.12) continue; // signal dropout
          let x = gx + 1;
          let y = gy + 1;
          let r = 1;

          if (g > 0.01) {
            x += (Math.random() - 0.5) * 2 * g * SHAKE;
            y += (Math.random() - 0.5) * 2 * g * SHAKE;
            r += g * 0.6;
            for (const b of bands) if (y >= b.top && y < b.bottom) { x += b.dx; break; }
          }

          let bump = 0;
          let tone: PulseTone = "hl";
          let shoveX = 0;
          let shoveY = 0;
          let rattle = 0;
          for (const rp of ripples) {
            const age = now - rp.t0;
            if (age < 0) continue; // an echo that hasn't set off yet
            const dx = x - rp.x;
            const dy = y - rp.y;
            const dist = Math.hypot(dx, dy) || 1;
            const front = age * RIPPLE.speed;
            if (Math.abs(dist - front) > RIPPLE.width * 3) continue;
            // A lumpy, shifting edge instead of a perfect circle.
            const angle = Math.atan2(dy, dx);
            const lump = (Math.sin(angle * 5 + rp.seed) + 0.5 * Math.sin(angle * 11 - rp.seed * 2 + age / 90)) * RIPPLE.wobble;
            const k = (dist - front - lump) / RIPPLE.width;
            const b = rp.strength * Math.exp(-k * k) * (1 - age / RIPPLE.life);
            if (b > 0.02) {
              shoveX += (dx / dist) * b * RIPPLE.push;
              shoveY += (dy / dist) * b * RIPPLE.push;
              rattle = Math.max(rattle, b);
            }
            if (b > bump) { bump = b; tone = rp.tone; }
          }
          if (rattle > 0.02) {
            x += shoveX + (Math.random() - 0.5) * 2 * rattle * RIPPLE.rattle;
            y += shoveY + (Math.random() - 0.5) * 2 * rattle * RIPPLE.rattle;
          }
          if (pointer) {
            const d = Math.hypot(x - pointer.x, y - pointer.y);
            if (d < HOVER_RADIUS) r += (1 - d / HOVER_RADIUS) * 1.1;
          }
          r += bump * 2.6;

          dots.moveTo(x + r, y);
          dots.arc(x, y, r, 0, Math.PI * 2);
          if (split) {
            split[0].moveTo(x - splitOff + r, y);
            split[0].arc(x - splitOff, y, r, 0, Math.PI * 2);
            split[1].moveTo(x + splitOff + r, y);
            split[1].arc(x + splitOff, y, r, 0, Math.PI * 2);
          }
          if (bump > 0.12) tinted.push([x, y, r, bump, tone]);
        }
      }

      if (split) {
        c.globalAlpha = Math.min(0.85, 0.25 + g * 0.6);
        c.fillStyle = SPLIT[0];
        c.fill(split[0]);
        c.fillStyle = SPLIT[1];
        c.fill(split[1]);
        c.globalAlpha = 1;
      }
      c.fillStyle = colors.dot;
      c.fill(dots);

      // Dots on a ripple's front pick up its colour.
      for (const [x, y, r, a, tone] of tinted) {
        c.globalAlpha = Math.min(1, a);
        c.fillStyle = colors[tone];
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }

    function frame(now: number) {
      const dt = Math.min(64, now - last);
      last = now;
      frameNo++;
      drift = { x: drift.x + (DRIFT.x * dt) / 1000, y: drift.y + (DRIFT.y * dt) / 1000 };

      // Any scroll kicks the glitch in hard; faster scrolling pushes it further.
      // A new page resets the scroll (and its layout settles) under the page
      // transition: that isn't the reader scrolling, and nor is a single huge jump.
      const sy = window.scrollY;
      const jumped = Math.abs(sy - lastScroll) > h * 0.6 || now < calmUntil;
      const moved = jumped ? 0 : Math.abs(sy - lastScroll);
      lastScroll = sy;
      const fade = dt / 16.7; // decay per 60fps frame, so it fades in the same time at any frame rate
      scrollEnergy = moved > 0.5
        ? Math.max(scrollEnergy, Math.min(1, 0.45 + moved / 35))
        : scrollEnergy * Math.pow(0.86, fade);
      shake *= Math.pow(0.9, fade);
      const g = Math.min(1, Math.max(scrollEnergy, shake));
      if (g < 0.05) bands = [];
      else if (frameNo % 3 === 0) bands = rollBands(g);

      for (let k = ripples.length - 1; k >= 0; k--) {
        if (now - ripples[k].t0 > RIPPLE.life) ripples.splice(k, 1);
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    fx.current = {
      ripple(p: Pulse) {
        const ring = {
          x: p.x ?? w / 2,
          y: p.y ?? h / 2,
          t0: performance.now(),
          tone: p.tone ?? "hl",
          strength: p.strength ?? 1,
          seed: Math.random() * 10,
        };
        ripples.push(ring, { ...ring, t0: ring.t0 + ECHO.delay, strength: ring.strength * ECHO.strength });
        while (ripples.length > 10) ripples.shift();
        if (p.shake) shake = 1;
      },
    };

    const onPulse = (e: Event) => fx.current?.ripple((e as CustomEvent<Pulse>).detail ?? {});
    const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") pointer = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { pointer = null; };
    const onDown = (e: PointerEvent) => {
      if (e.button === 0 && onBarePaper(e.target)) fx.current?.ripple({ x: e.clientX, y: e.clientY, strength: 1.1 });
    };
    const onPageChange = () => {
      calmUntil = performance.now() + CALM_MS;
      scrollEnergy = 0;
      shake = 0;
      bands = [];
    };
    const themeWatch = new MutationObserver(readColors);

    readColors();
    resize();
    themeWatch.observe(root, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", resize);
    window.addEventListener(PULSE_EVENT, onPulse);
    window.addEventListener(PAGE_CHANGE_EVENT, onPageChange);
    window.addEventListener("pointerdown", onDown, { passive: true });
    if (finePointer) {
      window.addEventListener("pointermove", onMove, { passive: true });
      root.addEventListener("pointerleave", onLeave);
    }
    root.dataset.dots = "live";
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      themeWatch.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener(PULSE_EVENT, onPulse);
      window.removeEventListener(PAGE_CHANGE_EVENT, onPageChange);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      delete root.dataset.dots;
      fx.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
