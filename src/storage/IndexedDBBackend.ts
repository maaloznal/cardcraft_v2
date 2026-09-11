/**
 * IndexedDBBackend — fallback storage when localStorage quota is exceeded.
 *
 * PRIORITY 8.4: localStorage has a 5-10MB limit. When exceeded, the app
 * previously showed a toast and lost data. This module provides the same
 * save/load/clear interface as StorageManager but uses IndexedDB (which
 * has ~50MB+ quota in most browsers).
 *
 * Usage: StorageManager.save() catches QuotaExceededError → calls
 * IndexedDBBackend.save() as fallback → load() checks both.
 *
 * Public API:
 *   save(state)   — Promise<void>
 *   load()        — Promise<Partial<SavedState>>
 *   clear()       — Promise<void>
 *   isAvailable() — boolean (checks if IndexedDB is supported)
 */

import type { SavedState } from './StorageManager';

const DB_NAME = 'cardcraft-fallback';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const STATE_KEY = 'main';

/** Check if IndexedDB is available (not in private mode, not unsupported). */
export function isAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Open (or create) the IndexedDB database. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/** Save state to IndexedDB. */
export async function save(state: Partial<SavedState>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(state, STATE_KEY);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

/** Load state from IndexedDB. */
export async function load(): Promise<Partial<SavedState>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as Partial<SavedState>) ?? {});
    };
  });
}

/** Clear all state from IndexedDB. */
export async function clear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}
