"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Info } from "lucide-react";
import { EASE } from "@/lib/motion";

type Tone = "error" | "success" | "info";

const TONE: Record<Tone, { box: string; icon: React.ReactNode }> = {
  error:   { box: "bg-bad-tint border-bad",     icon: <AlertTriangle size={16} className="text-bad shrink-0 mt-0.5" /> },
  success: { box: "bg-good-tint border-good",   icon: <Check size={16} className="text-good shrink-0 mt-0.5" /> },
  info:    { box: "bg-hl-soft border-ink",      icon: <Info size={16} className="text-ink shrink-0 mt-0.5" /> },
};

/** An inline message box. Renders nothing (and animates out) when empty. */
export default function Notice({
  tone = "error",
  children,
  className = "",
}: { tone?: Tone; children?: React.ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.div
          role={tone === "error" ? "alert" : "status"}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className={`flex items-start gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-semibold text-ink ${t.box} ${className}`}
        >
          {t.icon}
          <div className="min-w-0">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
