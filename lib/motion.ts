import type { Variants, Transition } from "framer-motion";

/**
 * Shared Framer Motion variants — designed to feel "sketchy/cartoonish":
 * springy, slightly overshooty, never robotic.
 *
 * Use with <motion.div variants={fadeUp} initial="hidden" animate="show" />.
 */

const easeOut: Transition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] };
const spring:  Transition = { type: "spring", stiffness: 380, damping: 26 };
const bouncy:  Transition = { type: "spring", stiffness: 320, damping: 18 };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: easeOut },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: easeOut },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  show:   { opacity: 1, y: 0, transition: easeOut },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show:   { opacity: 1, scale: 1, transition: bouncy },
  exit:   { opacity: 0, scale: 0.9, transition: { duration: 0.18 } },
};

export const bounceIn: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show:   { opacity: 1, scale: 1, transition: bouncy },
};

export const pop: Variants = {
  rest: { scale: 1 },
  tap:  { scale: 0.96, transition: spring },
};

/** Stagger children inside a container */
export const stagger = (gap = 0.07): Variants => ({
  hidden: {},
  show:   { transition: { staggerChildren: gap, delayChildren: 0.05 } },
});

/** Page transition — used by <PageShell> wrapper */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

/** Tap micro-interaction shared across buttons */
export const tapScale = { scale: 0.96 };
export const hoverLift = { y: -2 };
