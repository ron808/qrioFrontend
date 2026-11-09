"use client";

import { useEffect, useRef } from "react";

/**
 * A one-off burst of paper confetti (strips and hole-punch dots) in the
 * app's colours. Mount it to fire it; it cleans up after itself. Nothing
 * happens for people who prefer reduced motion.
 */

const DURATION = 3200;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  round: boolean;
  color: string;
  sway: number;
}

export default function Confetti({ count = 140 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cs = getComputedStyle(document.documentElement);
    const palette = ["--hl", "--good-mark", "--ink", "--hl", "--margin", "--card"].map(
      (v) => cs.getPropertyValue(v).trim() || "#ffd43b",
    );
    const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
      // Two cannons from the top corners, aimed inwards.
      const left = i % 2 === 0;
      const round = Math.random() < 0.3;
      const size = 5 + Math.random() * 5;
      return {
        x: left ? -10 : w + 10,
        y: h * (0.15 + Math.random() * 0.25),
        vx: (left ? 1 : -1) * (4 + Math.random() * 7),
        vy: -(6 + Math.random() * 8),
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        w: round ? size : size * 0.7,
        h: round ? size : size * 1.8,
        round,
        color: palette[i % palette.length],
        sway: Math.random() * Math.PI * 2,
      };
    });

    const start = performance.now();
    let last = start;
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.7);
      last = now;
      const age = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = age > DURATION - 600 ? Math.max(0, (DURATION - age) / 600) : 1;
      for (const p of pieces) {
        p.vy += 0.28 * dt;
        p.vx *= 0.985;
        p.vy = Math.min(p.vy, 5);
        p.x += (p.vx + Math.sin(age / 220 + p.sway) * 0.8) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = cs.getPropertyValue("--line").trim() || "#1b1a17";
        ctx.lineWidth = 1;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          // Squash one axis as it "flips" in the air.
          const flip = Math.abs(Math.cos(age / 160 + p.sway));
          ctx.fillRect(-p.w / 2, (-p.h / 2) * flip, p.w, p.h * flip);
          ctx.strokeRect(-p.w / 2, (-p.h / 2) * flip, p.w, p.h * flip);
        }
        ctx.restore();
      }
      if (age < DURATION) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}
