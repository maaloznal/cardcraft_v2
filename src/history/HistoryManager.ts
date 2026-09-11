/**
 * HistoryManager — generic undo/redo stack with debounced snapshots.
 * Not tied to any specific state shape.
 */

import { deepClone } from '../core/utils';
import { CONFIG } from '../core/constants';

export class HistoryManager<T> {
  private history: T[] = [];
  private histIndex = -1;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private maxHistory: number;

  constructor(maxHistory = CONFIG.MAX_HISTORY) {
    this.maxHistory = maxHistory;
  }

  /** Take an immediate snapshot. Cancels any pending debounced push. */
  push(snapshot: T): void {
    // Cancel pending schedulePush — an immediate push supersedes it.
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.history = this.history.slice(0, this.histIndex + 1);
    this.history.push(deepClone(snapshot));
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.histIndex--;
    }
    this.histIndex++;
    // Clamp histIndex to valid range
    this.histIndex = Math.max(0, Math.min(this.histIndex, this.history.length - 1));
  }

  /** Debounced push — merges rapid changes into one snapshot */
  schedulePush(snapshot: T, delay = CONFIG.HISTORY_DEBOUNCE_MS): void {
    if (this.historyTimer) clearTimeout(this.historyTimer);
    this.historyTimer = setTimeout(() => this.push(snapshot), delay);
  }

  /** Undo — returns previous snapshot or null. Cancels any pending debounced push. */
  undo(): T | null {
    if (this.histIndex <= 0) return null;
    // Cancel pending schedulePush — otherwise it would fire after undo
    // and push a pre-undo snapshot, corrupting the redo stack.
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.histIndex--;
    return deepClone(this.history[this.histIndex]);
  }

  /** Redo — returns next snapshot or null. Cancels any pending debounced push. */
  redo(): T | null {
    if (this.histIndex >= this.history.length - 1) return null;
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.histIndex++;
    return deepClone(this.history[this.histIndex]);
  }

  /** Initialize with starting snapshot */
  init(snapshot: T): void {
    this.history = [deepClone(snapshot)];
    this.histIndex = 0;
  }

  get canUndo(): boolean {
    return this.histIndex > 0;
  }

  get canRedo(): boolean {
    return this.histIndex < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.histIndex = -1;
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
  }
}
