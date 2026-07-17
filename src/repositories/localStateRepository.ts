import type { AppState } from "../types";

export const localStateKey = "movietracker:v1";

type StateStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface LocalStateRepository {
  load(fallback: AppState): AppState;
  save(state: AppState): void;
  clear(): void;
}

function isCompatibleState(value: unknown, version: number): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppState>;
  return (
    candidate.version === version &&
    Boolean(candidate.userMedia && typeof candidate.userMedia === "object") &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.shelves) &&
    Array.isArray(candidate.queue) &&
    Boolean(candidate.filters && typeof candidate.filters === "object") &&
    Boolean(candidate.room && typeof candidate.room === "object")
  );
}

export function createLocalStateRepository(
  storage: StateStorage = window.localStorage,
  key = localStateKey,
): LocalStateRepository {
  return {
    load(fallback) {
      try {
        const saved = storage.getItem(key);
        if (!saved) return fallback;
        const parsed: unknown = JSON.parse(saved);
        return isCompatibleState(parsed, fallback.version) ? parsed : fallback;
      } catch {
        return fallback;
      }
    },
    save(state) {
      storage.setItem(key, JSON.stringify(state));
    },
    clear() {
      storage.removeItem(key);
    },
  };
}
