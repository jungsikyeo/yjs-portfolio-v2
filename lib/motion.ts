'use client';

import { flushSync } from 'react-dom';

let running: ViewTransition | undefined;

/** Keep updates immediate when motion is reduced or snapshots are unavailable. */
export function transitionView(update: () => void, theme = false) {
  if (typeof document === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !document.startViewTransition) {
    update();
    return;
  }

  running?.skipTransition();
  document.documentElement.dataset.transition = theme ? 'theme' : 'content';
  const transition = document.startViewTransition(() => flushSync(update));
  running = transition;
  // Rapid interactions can intentionally skip a snapshot; the update still runs.
  void transition.ready.catch(() => {});
  void transition.finished.finally(() => {
    if (running === transition) {
      running = undefined;
      delete document.documentElement.dataset.transition;
    }
  }).catch(() => {});
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
