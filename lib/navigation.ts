"use client";

import { useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";

/**
 * Page changes play the bubble transition: <PageTransition> registers itself
 * here, covers the screen, runs the navigation underneath and then reveals
 * the new page. Import `useRouter` from this file instead of next/navigation;
 * `push` and `back` animate, `replace` (used for redirects) stays instant.
 */

type Runner = (go: () => void) => void;
let runner: Runner | null = null;

/** Fired when the page is about to change under the cover, so effects can calm down. */
export const PAGE_CHANGE_EVENT = "qrio:page-change";

export function setTransitionRunner(next: Runner | null) {
  runner = next;
}

/** Run a navigation under the transition. Going to the page you're already on just runs it. */
export function withTransition(go: () => void, href?: string) {
  const samePage = href !== undefined && new URL(href, window.location.href).href === window.location.href;
  if (runner && !samePage) runner(go);
  else go();
}

type Router = ReturnType<typeof useNextRouter>;

export function useRouter(): Router {
  const router = useNextRouter();
  return useMemo<Router>(() => ({
    push: (href, options) => withTransition(() => router.push(href, options), href),
    back: () => withTransition(() => router.back()),
    replace: router.replace,
    forward: router.forward,
    refresh: router.refresh,
    prefetch: router.prefetch,
  }), [router]);
}
