import { MARK } from "@/lib/logo";

/** The sticker Q on its own, 1em square. */
export function LogoMark({ className = "" }: { className?: string }) {
  const [sx, sy, sw, sh, sr] = MARK.shadow;
  const [lx, ly, lw, lh, lr] = MARK.label;
  return (
    <svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true" className={`overflow-visible ${className}`}>
      <g transform={`rotate(${MARK.tilt} 50 50)`}>
        <rect x={sx} y={sy} width={sw} height={sh} rx={sr} fill="var(--shadow)" />
        <g className="logo-sticker">
          <rect x={lx} y={ly} width={lw} height={lh} rx={lr} fill="var(--hl)" stroke="var(--hl-ink)" strokeWidth={MARK.border} />
          <path d={MARK.ring} fill="none" stroke="var(--hl-ink)" strokeWidth={MARK.stroke} />
          <path d={MARK.tail} fill="none" stroke="var(--hl-ink)" strokeWidth={MARK.stroke} strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

/** The Qrio logo: the sticker Q and the marker wordmark, sized by font-size. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo inline-flex items-center gap-[0.24em] font-marker leading-none text-ink ${className}`}>
      <LogoMark className="h-[1.25em] w-[1.25em] shrink-0" />
      Qrio
    </span>
  );
}
