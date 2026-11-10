"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { drawMark } from "@/lib/logo";
import { PAGE_CHANGE_EVENT, setTransitionRunner } from "@/lib/navigation";

/**
 * The page change: highlighter bubbles bloom out from where you tapped until
 * they cover the screen, the new page loads underneath, then the bubbles
 * shrink away from the same spot to reveal it. Drawn on one canvas so it
 * stays smooth. If loading takes a moment, the logo fades in on the cover.
 *
 * The browser's own back and forward buttons can't be held off while the
 * bubbles grow (the page has already changed when we hear about it), so for
 * those the cover appears at once, before the old page can paint, and the
 * bubbles clear from the left edge like turning back a page.
 *
 * People who prefer reduced motion just get the new page.
 */

const GROW_MS = 380; // one bubble growing
const SHRINK_MS = 420; // one bubble shrinking
const SPREAD_IN_MS = 260; // first bubble to last, on the way in
const SPREAD_OUT_MS = 300; // and on the way out
const MIN_HOLD_MS = 70; // keep the cover up at least this long
const MAX_HOLD_MS = 8000; // give up waiting for the new page
const POP_MAX_HOLD_MS = 600; // back/forward pages are cached, so they're quick
const LOGO_AFTER_MS = 300; // show the logo if loading takes longer than this

interface Bubble {
  x: number;
  y: number;
  r: number;
  inAt: number; // ms after start
  outAt: number; // ms after the reveal starts
}

type Phase = "idle" | "in" | "hold" | "out";

const easeOutBack = (t: number) => {
  const c = 1.35;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export default function PageTransition() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The page React has actually rendered, to know when a back/forward page is ready.
  const pathname = usePathname();
  const renderedPath = useRef(pathname);
  useEffect(() => { renderedPath.current = pathname; }, [pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let phase: Phase = "idle";
    let bubbles: Bubble[] = [];
    let w = 0;
    let h = 0;
    let started = 0;
    let holdStart = 0;
    let revealStart = 0;
    let fromHref = "";
    let waitPath: string | null = null; // set for browser back/forward
    let raf = 0;
    let tap: { x: number; y: number; t: number } | null = null;
    let go: (() => void) | null = null;
    let colors = { fill: "#ffd43b", line: "#1b1a17", text: "#1b1a17" };

    function setup(originX: number, originY: number) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cs = getComputedStyle(document.documentElement);
      colors = {
        fill: cs.getPropertyValue("--hl").trim() || colors.fill,
        line: cs.getPropertyValue("--line").trim() || colors.line,
        text: cs.getPropertyValue("--hl-ink").trim() || colors.text,
      };

      // A honeycomb of bubbles; at full size neighbours overlap, so the cover has no gaps.
      const gap = Math.max(64, Math.min(96, Math.hypot(w, h) / 16));
      const rowH = gap * 0.866;
      const far = Math.max(
        Math.hypot(originX, originY), Math.hypot(w - originX, originY),
        Math.hypot(originX, h - originY), Math.hypot(w - originX, h - originY),
      );
      bubbles = [];
      for (let row = -1; row * rowH < h + gap; row++) {
        for (let col = -1; col * gap < w + gap; col++) {
          const x = col * gap + (row % 2 ? gap / 2 : 0);
          const y = row * rowH;
          const d = Math.hypot(x - originX, y - originY) / far;
          bubbles.push({
            x,
            y,
            r: gap * (0.64 + Math.random() * 0.06),
            inAt: d * SPREAD_IN_MS + Math.random() * 40,
            outAt: d * SPREAD_OUT_MS + Math.random() * 50,
          });
        }
      }
    }

    function draw(now: number) {
      const c = ctx!;
      c.clearRect(0, 0, w, h);
      const fills = new Path2D();
      const rims = new Path2D();
      for (const b of bubbles) {
        let s: number;
        let lift = 0;
        if (phase === "in") s = easeOutBack(clamp01((now - started - b.inAt) / GROW_MS));
        else if (phase === "hold") s = 1;
        else {
          const p = clamp01((now - revealStart - b.outAt) / SHRINK_MS);
          s = 1 - easeInOut(p);
          lift = p * 14; // bubbles float up a little as they go
        }
        if (s <= 0.001) continue;
        const r = b.r * s;
        const y = b.y - lift;
        fills.moveTo(b.x + r, y);
        fills.arc(b.x, y, r, 0, Math.PI * 2);
        // An ink rim while a bubble is small, fading out as they merge into one sheet.
        if (s < 0.8) {
          rims.moveTo(b.x + r, y);
          rims.arc(b.x, y, r, 0, Math.PI * 2);
        }
      }
      c.fillStyle = colors.fill;
      c.fill(fills);
      c.strokeStyle = colors.line;
      c.lineWidth = 2.5;
      c.globalAlpha = phase === "hold" ? 0 : 0.85;
      c.stroke(rims);
      c.globalAlpha = 1;

      // Loading is taking a moment: show the logo on the cover.
      if (phase === "hold" && now - holdStart > LOGO_AFTER_MS) {
        c.globalAlpha = clamp01((now - holdStart - LOGO_AFTER_MS) / 250);
        const size = 112;
        drawMark(c, w / 2 - size / 2, h / 2 - size / 2, size, { label: colors.fill, ink: colors.text, shadow: colors.text });
        c.globalAlpha = 1;
      }
    }

    function frame(now: number) {
      if (phase === "in" && now - started > SPREAD_IN_MS + 40 + GROW_MS) {
        phase = "hold";
        holdStart = now;
        fromHref = window.location.href;
        window.dispatchEvent(new Event(PAGE_CHANGE_EVENT));
        const navigate = go;
        go = null;
        navigate?.();
      }
      if (phase === "hold") {
        const arrived = waitPath !== null ? renderedPath.current === waitPath : window.location.href !== fromHref;
        const held = now - holdStart;
        if ((arrived && held > MIN_HOLD_MS) || held > (waitPath !== null ? POP_MAX_HOLD_MS : MAX_HOLD_MS)) {
          // Give the new page a frame to paint under the cover before revealing it.
          phase = "out";
          revealStart = now + 34;
        }
      }
      if (phase === "out" && now - revealStart > SPREAD_OUT_MS + 50 + SHRINK_MS) {
        phase = "idle";
        waitPath = null;
        ctx!.clearRect(0, 0, w, h);
        canvas!.style.pointerEvents = "none";
        return;
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    const onDown = (e: PointerEvent) => { tap = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    // Browser back/forward: cover at once, wait for the page to render, then reveal.
    const onPop = () => {
      if (phase !== "idle") return; // an in-app Back button already covered the screen
      const now = performance.now();
      setup(0, window.innerHeight / 2);
      waitPath = window.location.pathname;
      phase = "hold";
      holdStart = now;
      canvas.style.pointerEvents = "auto";
      window.dispatchEvent(new Event(PAGE_CHANGE_EVENT));
      draw(now); // paint the cover now, so the old page never flashes up uncovered
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    window.addEventListener("popstate", onPop);

    setTransitionRunner((navigate) => {
      if (phase !== "idle") return; // already on its way somewhere
      const now = performance.now();
      const recent = tap && now - tap.t < 1500;
      setup(recent ? tap!.x : window.innerWidth / 2, recent ? tap!.y : window.innerHeight / 2);
      go = navigate;
      waitPath = null;
      phase = "in";
      started = now;
      canvas.style.pointerEvents = "auto"; // no double taps while it's covering
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      setTransitionRunner(null);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[200] h-full w-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
