/**
 * ToastQueue — toast notification queue with priority bypass.
 *
 * Long toasts (≥10000ms, e.g. batch download progress) bypass the queue
 * and replace the current toast immediately. Shorter toasts queue up
 * and play sequentially with a 200ms gap.
 *
 * Leak safety:
 *   - All pending setTimeout IDs are tracked in `timers` (Set) and cleared
 *     in destroy() — including the queue-spawn timer that previously leaked.
 *   - A `destroyed` flag blocks any toast scheduled AFTER cleanup, so a
 *     queued timer cannot resurrect a toast on a torn-down instance.
 *
 * Public API:
 *   new ToastQueue(element)        — bind to a toast DOM element
 *   show(msg, duration = 2500)     — display a toast (queued if short)
 *   destroy()                      — clear timers + block future shows
 */

export class ToastQueue {
  private el: HTMLElement;
  private queue: Array<{ msg: string; duration: number }> = [];
  private showing = false;
  /** All pending timers (hide timer + queue-spawn timer) — cleared in destroy(). */
  private timers: Set<ReturnType<typeof setTimeout>> = new Set();
  /** Once destroyed, show() becomes a no-op so late timers can't resurrect a toast. */
  private destroyed = false;

  constructor(element: HTMLElement) {
    this.el = element;
  }

  show(msg: string, duration = 2500): void {
    // Ignore any toast scheduled after teardown (e.g. a queued timer
    // that fired following a React StrictMode unmount).
    if (this.destroyed) return;

    // Long toasts bypass the queue
    if (this.showing && duration < 10000) {
      this.queue.push({ msg, duration });
      return;
    }
    this.el.textContent = msg;
    this.el.classList.add('show');
    this.showing = true;

    // Clear any prior hide timer (kept here for the bypass path that
    // replaces a long toast mid-flight).
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();

    const hideTimer = setTimeout(() => {
      this.timers.delete(hideTimer);
      this.el.classList.remove('show');
      this.showing = false;
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        const spawnTimer = setTimeout(() => this.show(next.msg, next.duration), 200);
        this.timers.add(spawnTimer);
      }
    }, duration);
    this.timers.add(hideTimer);
  }

  destroy(): void {
    // Cancel every pending timer (hide + queue-spawn) so no toast
    // can appear after cleanup.
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.queue.length = 0;
    this.showing = false;
    this.destroyed = true;
    // Hide the element immediately in case a toast was visible.
    this.el.classList.remove('show');
  }
}
