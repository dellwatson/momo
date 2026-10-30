import { useSyncExternalStore } from 'react'

// A small external store, saved to localStorage when it has a key. Async agent flows read
// `get()` for the latest state, so they never act on a stale closure.

export interface Store<T> {
  get: () => T
  set: (next: Partial<T> | ((s: T) => Partial<T>)) => void
  subscribe: (fn: () => void) => () => void
}

export function createStore<T extends object>(key: string | null, initial: T): Store<T> {
  let state = initial
  try {
    const raw = key && localStorage.getItem(key)
    if (raw) state = { ...initial, ...JSON.parse(raw) }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next) {
      state = { ...state, ...(typeof next === 'function' ? next(state) : next) }
      try {
        if (key) localStorage.setItem(key, JSON.stringify(state))
      } catch {
        // Not persisted; the session still works.
      }
      for (const fn of listeners) fn()
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()))
}
