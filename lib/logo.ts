/**
 * The Qrio mark: a bold marker Q on a tilted highlighter sticker with a hard
 * ink shadow. One set of numbers in a 100×100 box draws it everywhere: the
 * <Logo> in the app, the canvas pictures (share card, page transition) and
 * the generated icons. app/icon.svg is markSvg() written out; keep it in step.
 */

export const MARK = {
  tilt: -5,
  /** x, y, width, height, corner radius */
  shadow: [11, 11, 82, 82, 20],
  label: [5, 5, 82, 82, 20],
  border: 5,
  stroke: 12,
  ring: "M 46 22 C 28 22, 20 36, 20 47 C 20 62, 31 72, 46 72 C 61 72, 72 62, 72 47 C 72 33, 62 22, 46 22 Z",
  tail: "M 53 59 L 70 78",
} as const;

export interface MarkColors {
  label: string;
  ink: string;
  shadow: string;
}

/** The light theme's colours, for places that can't read CSS (icons, link previews). */
export const MARK_COLORS: MarkColors = { label: "#ffd43b", ink: "#1b1a17", shadow: "#1b1a17" };

export function markSvg(colors: MarkColors = MARK_COLORS): string {
  const rect = ([x, y, w, h, r]: readonly number[]) => `x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"`;
  const line = `fill="none" stroke="${colors.ink}" stroke-width="${MARK.stroke}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<g transform="rotate(${MARK.tilt} 50 50)">` +
    `<rect ${rect(MARK.shadow)} fill="${colors.shadow}"/>` +
    `<rect ${rect(MARK.label)} fill="${colors.label}" stroke="${colors.ink}" stroke-width="${MARK.border}"/>` +
    `<path d="${MARK.ring}" ${line}/>` +
    `<path d="${MARK.tail}" ${line} stroke-linecap="round"/>` +
    `</g></svg>`
  );
}

/** Draw the mark on a canvas with its top-left corner at (x, y). */
export function drawMark(c: CanvasRenderingContext2D, x: number, y: number, size: number, colors: MarkColors = MARK_COLORS) {
  c.save();
  c.translate(x, y);
  c.scale(size / 100, size / 100);
  c.translate(50, 50);
  c.rotate((MARK.tilt * Math.PI) / 180);
  c.translate(-50, -50);

  const [sx, sy, sw, sh, sr] = MARK.shadow;
  c.beginPath();
  c.roundRect(sx, sy, sw, sh, sr);
  c.fillStyle = colors.shadow;
  c.fill();

  const [lx, ly, lw, lh, lr] = MARK.label;
  c.beginPath();
  c.roundRect(lx, ly, lw, lh, lr);
  c.fillStyle = colors.label;
  c.fill();
  c.lineWidth = MARK.border;
  c.strokeStyle = colors.ink;
  c.stroke();

  c.lineWidth = MARK.stroke;
  c.lineCap = "round";
  c.stroke(new Path2D(MARK.ring));
  c.stroke(new Path2D(MARK.tail));
  c.restore();
}
