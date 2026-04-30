"use client";

import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/theme";

interface Props {
  /** Compact icon-only style (used in nav). Default true. */
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = true, className = "" }: Props) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.92, rotate: isDark ? -15 : 15 }}
      whileHover={{ y: -1 }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`relative inline-flex items-center justify-center rounded-xl border-2 border-ink bg-card text-ink shadow-[3px_3px_0_var(--shadow)] hover:shadow-[4px_4px_0_var(--shadow)] active:translate-y-[1px] transition-shadow focus-ring ${
        compact ? "w-10 h-10" : "px-4 py-2 gap-2"
      } ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25 }}
            className="inline-flex"
          >
            <Moon size={18} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25 }}
            className="inline-flex"
          >
            <Sun size={18} />
          </motion.span>
        )}
      </AnimatePresence>
      {!compact && <span className="text-sm font-bold">{isDark ? "Dark" : "Light"}</span>}
    </motion.button>
  );
}
