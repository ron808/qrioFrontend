"use client";

import { useEffect, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { EASE } from "@/lib/motion";

/**
 * A dialog that rises from the bottom edge on phones (thumb reach) and sits
 * centred on larger screens. Escape and a tap outside close it unless
 * `locked` is set (e.g. while a request is in flight).
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  locked = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !locked) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, locked, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 sm:p-4"
          onClick={() => !locked && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[92svh] overflow-y-auto bg-card border-2 border-ink rounded-t-3xl sm:rounded-2xl shadow-[0_-4px_0_var(--shadow)] sm:shadow-[5px_5px_0_var(--shadow)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6"
          >
            <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full sm:hidden" style={{ background: "var(--line-soft)" }} />
            <div className="flex items-start gap-3 mb-5">
              {icon && (
                <div className="w-11 h-11 shrink-0 rounded-xl border-2 border-ink bg-hl text-hl-ink flex items-center justify-center">
                  {icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 id={titleId} className="font-heading text-2xl text-ink leading-tight">{title}</h2>
                {subtitle && <p className="text-ink-muted text-sm font-semibold mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                disabled={locked}
                aria-label="Close"
                className="-mr-2 -mt-1 w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink disabled:opacity-40 focus-ring"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
