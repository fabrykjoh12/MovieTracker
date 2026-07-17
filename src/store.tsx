/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { Dispatch, PropsWithChildren } from "react";
import { useAuth } from "./auth/AuthProvider";
import { initialState, media } from "./data";
import {
  completeSeason,
  markNextEpisode,
  moveQueueItem,
  normalizeVerdict,
  startRewatch,
  undoLastTracking,
} from "./domain";
import { createLocalStateRepository } from "./repositories/localStateRepository";
import {
  createNeonLibraryRepository,
  LibraryConflictError,
} from "./repositories/neonLibraryRepository";
import type {
  LibrarySnapshot,
  LibrarySyncRepository,
} from "./repositories/contracts";
import { getNeonClient } from "./lib/neon";
import type {
  AppState,
  LibraryStatus,
  Quality,
  TonightFilters,
  VerdictKind,
} from "./types";

type Action =
  | { type: "add"; mediaId: string; status?: LibraryStatus }
  | { type: "status"; mediaId: string; status: LibraryStatus }
  | { type: "mark-next"; mediaId: string }
  | { type: "complete-season"; mediaId: string; season: number }
  | { type: "undo" }
  | { type: "rewatch"; mediaId: string }
  | {
      type: "verdict";
      mediaId: string;
      kind: VerdictKind;
      qualities: Quality[];
      tags: string[];
      rank?: number;
    }
  | { type: "queue"; mediaId: string; direction: -1 | 1 }
  | { type: "filters"; filters: Partial<TonightFilters> }
  | { type: "vote"; mediaId: string; vote: "yes" | "maybe" | "no" }
  | { type: "hydrate-library"; snapshot: LibrarySnapshot }
  | { type: "replace-state"; state: AppState }
  | { type: "reset" };

const localStateRepository = createLocalStateRepository();

export const reducer = (state: AppState, action: Action): AppState => {
  const now = new Date().toISOString();
  switch (action.type) {
    case "add": {
      if (state.userMedia[action.mediaId]) return state;
      return {
        ...state,
        userMedia: {
          ...state.userMedia,
          [action.mediaId]: {
            mediaId: action.mediaId,
            status: action.status ?? "planned",
            watchedDates: [],
            savedAt: now,
          },
        },
      };
    }
    case "status": {
      const current = state.userMedia[action.mediaId] ?? {
        mediaId: action.mediaId,
        status: "planned" as const,
        watchedDates: [],
        savedAt: now,
      };
      const queue =
        action.status === "up-next" && !state.queue.includes(action.mediaId)
          ? [...state.queue, action.mediaId]
          : action.status !== "up-next"
            ? state.queue.filter((id) => id !== action.mediaId)
            : state.queue;
      return {
        ...state,
        queue,
        userMedia: {
          ...state.userMedia,
          [action.mediaId]: { ...current, status: action.status },
        },
      };
    }
    case "mark-next": {
      const item = media.find((entry) => entry.id === action.mediaId);
      const current = state.userMedia[action.mediaId];
      if (!item || !current) return state;
      if (item.format === "movie") {
        const previousState = structuredClone(current);
        return {
          ...state,
          userMedia: {
            ...state.userMedia,
            [item.id]: {
              ...current,
              status: "completed",
              watchedDates: [...current.watchedDates, now],
            },
          },
          events: [
            ...state.events,
            {
              id: `event-${now}-${item.id}`,
              mediaId: item.id,
              type: "movie",
              watchedAt: now,
              previousState,
            },
          ],
        };
      }
      const result = markNextEpisode(current, item, now);
      return result.event
        ? {
            ...state,
            userMedia: { ...state.userMedia, [item.id]: result.state },
            events: [...state.events, result.event],
          }
        : state;
    }
    case "complete-season": {
      const item = media.find((entry) => entry.id === action.mediaId);
      const current = state.userMedia[action.mediaId];
      if (!item || !current) return state;
      const result = completeSeason(current, item, action.season, now);
      return {
        ...state,
        userMedia: { ...state.userMedia, [item.id]: result.state },
        events: [...state.events, result.event],
      };
    }
    case "undo":
      return undoLastTracking(state);
    case "rewatch": {
      const current = state.userMedia[action.mediaId];
      if (!current) return state;
      return {
        ...state,
        userMedia: {
          ...state.userMedia,
          [action.mediaId]: startRewatch(current, now),
        },
        events: [
          ...state.events,
          {
            id: `event-${now}-${action.mediaId}-rewatch`,
            mediaId: action.mediaId,
            type: "rewatch",
            watchedAt: now,
            previousState: structuredClone(current),
          },
        ],
      };
    }
    case "verdict": {
      const current = state.userMedia[action.mediaId];
      if (!current) return state;
      return {
        ...state,
        userMedia: {
          ...state.userMedia,
          [action.mediaId]: {
            ...current,
            verdict: {
              kind: action.kind,
              normalized: normalizeVerdict(action.kind),
              qualities: action.qualities,
              tags: action.tags,
              rank: action.rank,
              recordedAt: now,
            },
          },
        },
      };
    }
    case "queue":
      return {
        ...state,
        queue: moveQueueItem(state.queue, action.mediaId, action.direction),
      };
    case "filters":
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case "vote":
      return {
        ...state,
        room: {
          ...state.room,
          candidates: state.room.candidates.map((candidate) =>
            candidate.mediaId === action.mediaId
              ? {
                  ...candidate,
                  votes: { ...candidate.votes, You: action.vote },
                }
              : candidate,
          ),
        },
      };
    case "hydrate-library":
      return {
        ...state,
        userMedia: action.snapshot.userMedia,
        events: action.snapshot.events,
        queue: action.snapshot.queue,
      };
    case "replace-state":
      return action.state;
    case "reset":
      return initialState;
  }
};

export type LibrarySyncStatus =
  | "browser"
  | "connecting"
  | "needs-import"
  | "import-error"
  | "saving"
  | "synced"
  | "error";

interface LibrarySyncState {
  status: LibrarySyncStatus;
  message?: string;
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  librarySync: LibrarySyncState;
  startCloudSync: () => Promise<void>;
  retryCloudSync: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: PropsWithChildren) {
  const { status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [state, baseDispatch] = useReducer(
    reducer,
    initialState,
    localStateRepository.load,
  );
  const stateRef = useRef(state);
  const cloudRepositoryRef = useRef<LibrarySyncRepository | null>(null);
  const mutationChainRef = useRef(Promise.resolve());
  const mutationVersionRef = useRef(0);
  const syncStatusRef = useRef<LibrarySyncStatus>("browser");
  const [librarySync, setLibrarySyncState] = useState<LibrarySyncState>({
    status: "browser",
  });

  const setLibrarySync = useCallback((next: LibrarySyncState) => {
    syncStatusRef.current = next.status;
    setLibrarySyncState(next);
  }, []);

  const replaceState = useCallback((next: AppState) => {
    stateRef.current = next;
    baseDispatch({ type: "replace-state", state: next });
  }, []);

  const hydrateLibrary = useCallback(
    (snapshot: LibrarySnapshot) => {
      replaceState(
        reducer(stateRef.current, { type: "hydrate-library", snapshot }),
      );
    },
    [replaceState],
  );

  const loadCloudLibrary = useCallback(
    async (repository: LibrarySyncRepository) => {
      setLibrarySync({ status: "connecting" });
      try {
        const snapshot = await repository.load();
        if (cloudRepositoryRef.current !== repository) return;
        if (!snapshot.initialized) {
          setLibrarySync({ status: "needs-import" });
          return;
        }
        hydrateLibrary(snapshot);
        setLibrarySync({ status: "synced" });
      } catch (error) {
        if (cloudRepositoryRef.current !== repository) return;
        setLibrarySync({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The cloud library could not be loaded.",
        });
      }
    },
    [hydrateLibrary, setLibrarySync],
  );

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      await Promise.resolve();
      if (cancelled) return;

      if (authStatus === "loading") {
        setLibrarySync({ status: "connecting" });
        return;
      }

      if (authStatus !== "authenticated" || !userId) {
        cloudRepositoryRef.current = null;
        mutationVersionRef.current += 1;
        setLibrarySync({ status: "browser" });
        replaceState(localStateRepository.load(initialState));
        return;
      }

      try {
        const client = await getNeonClient();
        if (!client) throw new Error("Neon is not configured.");
        if (cancelled) return;
        const repository = createNeonLibraryRepository(client, userId);
        cloudRepositoryRef.current = repository;
        await loadCloudLibrary(repository);
      } catch (error) {
        if (cancelled) return;
        setLibrarySync({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The cloud library could not be connected.",
        });
      }
    };

    void connect();

    return () => {
      cancelled = true;
    };
  }, [authStatus, loadCloudLibrary, replaceState, setLibrarySync, userId]);

  const dispatch = useCallback<Dispatch<Action>>(
    (action) => {
      const previous = stateRef.current;
      const next = reducer(previous, action);
      if (next === previous) return;
      replaceState(next);

      const repository = cloudRepositoryRef.current;
      if (
        !repository ||
        (syncStatusRef.current !== "synced" &&
          syncStatusRef.current !== "saving")
      ) {
        localStateRepository.save(next);
        return;
      }

      setLibrarySync({ status: "saving" });
      const mutationVersion = ++mutationVersionRef.current;
      mutationChainRef.current = mutationChainRef.current
        .catch(() => undefined)
        .then(() => repository.persistChanges(previous, next))
        .then(() => {
          if (
            mutationVersionRef.current === mutationVersion &&
            cloudRepositoryRef.current === repository
          ) {
            setLibrarySync({ status: "synced" });
          }
        })
        .catch(async (error: unknown) => {
          if (cloudRepositoryRef.current !== repository) return;
          if (error instanceof LibraryConflictError) {
            try {
              hydrateLibrary(await repository.load());
            } catch {
              // Preserve the current state if the conflict refresh also fails.
            }
          } else if (stateRef.current === next) {
            replaceState(previous);
          } else {
            try {
              hydrateLibrary(await repository.load());
            } catch {
              // Preserve the latest optimistic state while reporting the error.
            }
          }
          setLibrarySync({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "The change could not be saved and was rolled back.",
          });
        });
    },
    [hydrateLibrary, replaceState, setLibrarySync],
  );

  const startCloudSync = useCallback(async () => {
    const repository = cloudRepositoryRef.current;
    if (!repository) return;
    setLibrarySync({ status: "saving" });
    const current = stateRef.current;
    try {
      const imported = await repository.import({
        userMedia: current.userMedia,
        events: current.events,
        queue: current.queue,
      });
      hydrateLibrary(imported);
      setLibrarySync({ status: "synced" });
    } catch (error) {
      setLibrarySync({
        status: "import-error",
        message:
          error instanceof Error
            ? error.message
            : "The browser library could not be copied to Neon.",
      });
    }
  }, [hydrateLibrary, setLibrarySync]);

  const retryCloudSync = useCallback(async () => {
    const repository = cloudRepositoryRef.current;
    if (repository) await loadCloudLibrary(repository);
  }, [loadCloudLibrary]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      librarySync,
      startCloudSync,
      retryCloudSync,
    }),
    [dispatch, librarySync, retryCloudSync, startCloudSync, state],
  );
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
};
