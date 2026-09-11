/**
 * helpers.ts — shared orchestrator helpers:
 *   - ListenerTracker: tracks every addEventListener call for cleanup
 *   - guard(): try/catch wrapper that logs to console.error
 *   - perfMark(): returns an end-function that warns if >16ms elapsed
 *
 * Extracted from CardCraftApp.ts section 2 (helpers) + section 21
 * (addEl/addDoc + tracked-listener arrays).
 *
 * ListenerTracker is shared by all controllers via ctx.listeners.
 * Each bind* function in events.ts calls ctx.listeners.addEl / addDoc
 * to register listeners; cleanupEvents() calls ctx.listeners.destroy()
 * to remove them all in one shot.
 */

type TrackedElementListener = {
  el: EventTarget;
  type: string;
  fn: EventListener;
  opts?: boolean | AddEventListenerOptions;
};

type TrackedDocListener = {
  type: string;
  fn: EventListener;
};

export class ListenerTracker {
  private docListeners: TrackedDocListener[] = [];
  private elementListeners: TrackedElementListener[] = [];

  /** Add a tracked element listener (null-safe — no-op if el is null) */
  addEl<K extends keyof HTMLElementEventMap>(
    el: EventTarget | null | undefined,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    opts?: boolean | AddEventListenerOptions,
  ): void {
    if (!el) return;
    const listener = fn as EventListener;
    el.addEventListener(type, listener, opts);
    this.elementListeners.push({ el, type: type as string, fn: listener, opts });
  }

  /** Add a tracked document-level listener */
  addDoc<K extends keyof DocumentEventMap>(
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
  ): void {
    const listener = fn as EventListener;
    document.addEventListener(type, listener);
    this.docListeners.push({ type: type as string, fn: listener });
  }

  /** Remove ALL tracked listeners + reset arrays */
  destroy(): void {
    for (const { type, fn } of this.docListeners) {
      document.removeEventListener(type, fn);
    }
    this.docListeners.length = 0;
    for (const { el, type, fn, opts } of this.elementListeners) {
      el.removeEventListener(type, fn, opts);
    }
    this.elementListeners.length = 0;
  }
}

/**
 * try/catch wrapper — logs errors with a label prefix, returns undefined on failure.
 * Used by the init sequence so a single failing step doesn't break boot.
 */
export function guard<T>(label: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (err) {
    console.error('[Cardcraft] Error in ' + label + ':', err);
    return undefined;
  }
}

const perfEnabled = typeof performance !== 'undefined' && !!performance.now;

/**
 * Returns an end-function. When called, logs a warning if the elapsed
 * time exceeds 16ms (one frame @60fps). No-op when performance.now is
 * unavailable.
 */
export function perfMark(label: string): () => void {
  if (!perfEnabled) return () => {};
  const start = performance.now();
  return () => {
    const dur = performance.now() - start;
    if (dur > 16) {
      console.warn('[Cardcraft:perf] Slow ' + label + ': ' + dur.toFixed(1) + 'ms');
    }
  };
}
