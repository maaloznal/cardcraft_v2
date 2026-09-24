/**
 * Unit tests for ToastQueue (src/orchestrator/toast.ts).
 *
 * Tests:
 *   - show/hide lifecycle
 *   - queue behavior (short toasts queue, long bypass)
 *   - priority toasts (bypass queue + clear queued)
 *   - destroyed flag (no toast after destroy)
 *   - timer cleanup
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToastQueue } from '@/orchestrator/toast';

describe('ToastQueue', () => {
  let el: HTMLElement;
  let queue: ToastQueue;

  beforeEach(() => {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
    queue = new ToastQueue(el);
  });

  afterEach(() => {
    queue.destroy();
    el.remove();
    vi.useRealTimers();
  });

  it('show adds .show class to element', () => {
    queue.show('Test message');
    expect(el.classList.contains('show')).toBe(true);
    expect(el.textContent).toBe('Test message');
  });

  it('default duration is 2500ms', () => {
    vi.useFakeTimers();
    queue.show('Test');
    expect(el.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2499);
    expect(el.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2);
    expect(el.classList.contains('show')).toBe(false);
  });

  it('long toast (≥10000ms) bypasses queue', () => {
    vi.useFakeTimers();
    queue.show('Long 1', 60000);
    queue.show('Long 2', 60000);
    // Long 2 should replace Long 1 immediately
    expect(el.textContent).toBe('Long 2');
  });

  it('short toast queues behind current', () => {
    vi.useFakeTimers();
    queue.show('First', 2500);
    queue.show('Second', 2500);
    // Second should be queued, First still showing
    expect(el.textContent).toBe('First');
    // Advance past First's duration
    vi.advanceTimersByTime(2500);
    // Gap between toasts (200ms)
    vi.advanceTimersByTime(200);
    expect(el.textContent).toBe('Second');
  });

  it('priority toast bypasses queue and clears queued', () => {
    vi.useFakeTimers();
    queue.show('First', 2500);
    queue.show('Queued', 2500);
    // First is showing, Queued is in queue
    expect(el.textContent).toBe('First');
    // Priority toast should clear queue and show immediately
    queue.show('Priority', 2500, { priority: true });
    expect(el.textContent).toBe('Priority');
    // Advance past Priority's duration
    vi.advanceTimersByTime(2500);
    vi.advanceTimersByTime(200);
    // Queued should NOT appear (cleared by priority)
    expect(el.textContent).toBe('Priority');
  });

  it('destroy prevents future toasts', () => {
    queue.destroy();
    queue.show('After destroy');
    expect(el.classList.contains('show')).toBe(false);
  });

  it('destroy clears pending timers', () => {
    vi.useFakeTimers();
    queue.show('Test', 2500);
    queue.destroy();
    // Advance time — should not throw or show toast
    vi.advanceTimersByTime(5000);
    expect(el.classList.contains('show')).toBe(false);
  });

  it('destroy clears queue', () => {
    vi.useFakeTimers();
    queue.show('First', 2500);
    queue.show('Queued', 2500);
    queue.destroy();
    // Advance past all timers
    vi.advanceTimersByTime(10000);
    // Element should not show
    expect(el.classList.contains('show')).toBe(false);
  });

  it('custom duration works', () => {
    vi.useFakeTimers();
    queue.show('Custom', 5000);
    vi.advanceTimersByTime(4999);
    expect(el.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2);
    expect(el.classList.contains('show')).toBe(false);
  });

  it('multiple short toasts queue sequentially', () => {
    vi.useFakeTimers();
    queue.show('A', 1000);
    queue.show('B', 1000);
    queue.show('C', 1000);
    expect(el.textContent).toBe('A');
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(200);
    expect(el.textContent).toBe('B');
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(200);
    expect(el.textContent).toBe('C');
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains('show')).toBe(false);
  });
});
