import type { Variants, Transition } from "framer-motion";

/**
 * Shared Framer Motion variants. One easing curve for the whole app (it
 * matches `--ease` in globals.css), short durations, no idle loops.
 *
 * Use with <motion.div variants={fadeUp} initial="hidden" animate="show" />.
 */

export const EASE = [0.2, 0.8, 0.2, 1] as const;

const easeOut: Transition = { duration: 0.45, ease: EASE };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: easeOut },
};

/** Stagger children inside a container */
export const stagger = (gap = 0.07): Variants => ({
  hidden: {},
  show:   { transition: { staggerChildren: gap, delayChildren: 0.05 } },
});

/** Page transition — used by <PageShell> wrapper */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};
