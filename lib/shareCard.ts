/**
 * Draws a result as a shareable picture: the marked paper from the results
 * screen (circled score, red-pen verdict, earned title, one square per
 * question, the teacher's comment and any stamps) on dotted paper, 1080×1350.
 * It uses the app's own fonts and the current theme's colours.
 */

export interface ResultCard {
  /** "Lone Wolf" or "Multiplayer" */
  mode: string;
  topics: string[];
  difficulty: string;
  correct: number;
  total: number;
  score: number;
  /** Red-pen word beside the score: "Brilliant!", "You won!" */
  verdict: string;
  /** Big line under the score: "Space Expert", "1st of 4" */
  title: string;
  titleLabel: string;
  grid: Array<"good" | "bad" | "skip">;
  comment: string;
  stamps: string[];
}

const W = 1080;
const H = 1350;
// The same loose loop the app draws around a score (a 100×100 box).
const LOOP = "M 14 34 C 22 12, 66 4, 88 18 C 106 30, 102 70, 78 86 C 58 98, 20 96, 9 76 C 0 58, 6 30, 34 14";

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Shrink text until it fits, then cut it with an ellipsis if it still doesn't. */
function fitText(c: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, size: number, min: number) {
  let s = size;
  c.font = font(s);
  while (c.measureText(text).width > maxWidth && s > min) {
    s -= 2;
    c.font = font(s);
  }
  let t = text;
  while (c.measureText(t).width > maxWidth && t.length > 1) t = t.slice(0, -2) + "…";
  return t;
}

export async function drawResultCard(card: ResultCard): Promise<Blob> {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const col = {
    paper: v("--paper", "#f1eee6"),
    dot: v("--paper-dot", "#d6d1c5"),
    card: v("--card", "#fffdf8"),
    ink: v("--ink", "#1b1a17"),
    muted: v("--ink-muted", "#6b675f"),
    line: v("--line", "#1b1a17"),
    shadow: v("--shadow", "#1b1a17"),
    soft: v("--line-soft", "#d9d4c8"),
    hl: v("--hl", "#ffd43b"),
    hlInk: v("--hl-ink", "#1b1a17"),
    good: v("--good-mark", "#16a34a"),
    bad: v("--bad-mark", "#dc2626"),
  };
  const fBody = v("--font-body", "sans-serif");
  const fHand = v("--font-heading", "cursive");
  const fMarker = v("--font-marker", "cursive");
  const body = (weight: number) => (size: number) => `${weight} ${size}px ${fBody}`;
  const hand = (size: number) => `700 ${size}px ${fHand}`;
  await Promise.all([
    document.fonts.load(body(900)(100)),
    document.fonts.load(body(800)(40)),
    document.fonts.load(hand(60)),
    document.fonts.load(`64px ${fMarker}`),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  c.textBaseline = "alphabetic";

  // Dotted paper.
  c.fillStyle = col.paper;
  c.fillRect(0, 0, W, H);
  c.fillStyle = col.dot;
  for (let x = 20; x < W; x += 36) {
    for (let y = 20; y < H; y += 36) {
      c.beginPath();
      c.arc(x, y, 2.4, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Logo on its tilted highlighter label, and the mode on the right.
  c.save();
  c.translate(72, 72);
  c.rotate((-2 * Math.PI) / 180);
  c.fillStyle = col.hl;
  roundRect(c, 0, 0, 196, 86, 16);
  c.fill();
  c.fillStyle = col.hlInk;
  c.font = `60px ${fMarker}`;
  c.textAlign = "center";
  c.fillText("Qrio", 98, 64);
  c.restore();
  c.textAlign = "right";
  c.fillStyle = col.ink;
  c.font = body(900)(36);
  c.fillText(card.mode, W - 72, 112);
  c.fillStyle = col.muted;
  c.font = body(700)(26);
  c.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), W - 72, 150);

  // The paper: a card with an ink outline and a hard shadow.
  const cx = 60, cy = 210, cw = 960, ch = 900;
  c.fillStyle = col.shadow;
  roundRect(c, cx + 12, cy + 12, cw, ch, 40);
  c.fill();
  c.fillStyle = col.card;
  roundRect(c, cx, cy, cw, ch, 40);
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = col.line;
  c.stroke();

  const mid = W / 2;
  c.textAlign = "center";

  // Topics and difficulty.
  c.fillStyle = col.muted;
  const topicLine = `${card.topics.join(" · ")} · ${card.difficulty}`.toUpperCase();
  c.fillText(fitText(c, topicLine, cw - 120, body(800), 28, 20), mid, cy + 78);

  // The score, circled in red pen.
  c.font = body(900)(210);
  const big = String(card.correct);
  const bigW = c.measureText(big).width;
  c.font = body(900)(100);
  const small = `/${card.total}`;
  const smallW = c.measureText(small).width;
  const scoreW = bigW + smallW;
  const scoreX = mid - scoreW / 2;
  const scoreBase = cy + 340;
  c.textAlign = "left";
  c.fillStyle = col.ink;
  c.font = body(900)(210);
  c.fillText(big, scoreX, scoreBase);
  c.fillStyle = col.muted;
  c.font = body(900)(100);
  c.fillText(small, scoreX + bigW, scoreBase);
  const loopW = scoreW + 170;
  const loopH = 280;
  const loop = new Path2D();
  loop.addPath(new Path2D(LOOP), new DOMMatrix().translate(mid - loopW / 2, scoreBase - 220).scale(loopW / 100, loopH / 100));
  c.strokeStyle = col.bad;
  c.lineWidth = 9;
  c.lineCap = "round";
  c.stroke(loop);

  // Red-pen verdict and the points.
  c.textAlign = "center";
  c.save();
  c.translate(mid, cy + 455);
  c.rotate((-4 * Math.PI) / 180);
  c.fillStyle = col.bad;
  c.font = hand(88);
  c.fillText(card.verdict, 0, 0);
  c.restore();
  c.fillStyle = col.ink;
  c.font = body(900)(60);
  c.fillText(`${card.score} points`, mid, cy + 545);

  // The title, on a highlighter block.
  c.fillStyle = col.muted;
  c.font = body(800)(24);
  c.fillText(card.titleLabel.toUpperCase(), mid, cy + 615);
  const title = fitText(c, card.title, cw - 160, body(900), 58, 34);
  const titleW = c.measureText(title).width;
  c.save();
  c.translate(mid, cy + 668);
  c.rotate((-1.5 * Math.PI) / 180);
  c.fillStyle = col.hl;
  roundRect(c, -titleW / 2 - 18, -50, titleW + 36, 68, 14);
  c.fill();
  c.restore();
  c.fillStyle = col.hlInk;
  c.fillText(title, mid, cy + 680);

  // One square per question.
  const n = card.grid.length;
  const gap = 10;
  const size = Math.min(52, (cw - 140 - gap * (n - 1)) / Math.max(1, n));
  let gx = mid - (n * size + (n - 1) * gap) / 2;
  const gy = cy + 730;
  for (const r of card.grid) {
    c.fillStyle = r === "good" ? col.good : r === "bad" ? col.bad : col.soft;
    roundRect(c, gx, gy, size, size, Math.min(12, size / 4));
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = col.line;
    c.stroke();
    gx += size + gap;
  }

  // The teacher's comment.
  c.save();
  c.translate(mid, cy + 850);
  c.rotate((-1.5 * Math.PI) / 180);
  c.fillStyle = col.bad;
  c.fillText(fitText(c, card.comment, cw - 120, hand, 52, 34), 0, 0);
  c.restore();

  // Stamps under the paper.
  let sx = 80;
  card.stamps.slice(0, 3).forEach((label, i) => {
    c.font = body(900)(28);
    const text = label.toUpperCase();
    const tw = c.measureText(text).width + 44;
    c.save();
    c.translate(sx + tw / 2, 1188);
    c.rotate(((i % 2 ? 4 : -6) * Math.PI) / 180);
    const tone = i === 0 ? col.hl : col.good;
    c.strokeStyle = tone;
    c.lineWidth = 6;
    roundRect(c, -tw / 2, -32, tw, 64, 12);
    c.stroke();
    c.lineWidth = 2;
    roundRect(c, -tw / 2 + 8, -24, tw - 16, 48, 8);
    c.stroke();
    c.fillStyle = tone;
    c.textAlign = "center";
    c.fillText(text, 0, 10);
    c.restore();
    sx += tw + 28;
  });

  // Footer: the dare and where to play.
  c.textAlign = "left";
  c.fillStyle = col.ink;
  c.font = hand(52);
  c.fillText("can you beat that?", 72, 1290);
  c.textAlign = "right";
  c.fillStyle = col.muted;
  c.font = body(800)(28);
  c.fillText(window.location.host, W - 72, 1286);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the image."))), "image/png");
  });
}
