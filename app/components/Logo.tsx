/** The Qrio wordmark: marker lettering on a tilted highlighter label. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-block isolate font-marker leading-none text-hl-ink px-[0.14em] ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-[0.08em] bottom-[-0.04em] -z-10 bg-hl"
        style={{ borderRadius: "0.12em 0.3em 0.16em 0.34em", transform: "rotate(-2deg)" }}
      />
      Qrio
    </span>
  );
}
