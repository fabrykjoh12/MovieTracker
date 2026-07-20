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
import {
  emptyLibraryState,
  initialState,
  media as fallbackCatalog,
} from "./data";
import {
  completeSeason,
  markNextEpisode,
  moveQueueItem,
  normalizeVerdict,
  startRewatch,
  undoLastTracking,
} from "./domain";
import { buildAccountExport } from "./lib/accountExport";
import type { AccountExportHeader } from "./lib/accountExport";
import { createLocalStateRepository } from "./repositories/localStateRepository";
import {
  createLocalCatalogRepository,
  mergeCatalogs,
} from "./repositories/localCatalogRepository";
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
  Media,
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
const localCatalogRepository = createLocalCatalogRepository();

export const reducer = (
  state: AppState,
  action: Action,
  catalog: Media[] = fallbackCatalog,
): AppState => {
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
      const item = catalog.find((entry) => entry.id === action.mediaId);
      const current = state.userMedia[action.mediaId];
      if (!item || !current) return state;
      if (item.format === "movie") {
        const previousState = structuredClone(current);
        const previousQueueIndex = state.queue.indexOf(item.id);
        return {
          ...state,
          queue: state.queue.filter((id) => id !== item.id),
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
              ...(previousQueueIndex < 0 ? {} : { previousQueueIndex }),
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
      const item = catalog.find((entry) => entry.id === action.mediaId);
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
  catalog: Media[];
  dispatch: Dispatch<Action>;
  librarySync: LibrarySyncState;
  startCloudSync: () => Promise<void>;
  retryCloudSync: () => Promise<void>;
  registerCatalogItem: (item: Media) => Promise<void>;
  downloadExport: () => void;
  deleteAllData: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);
const baseReducer = (state: AppState, action: Action) =>
  reducer(state, action, fallbackCatalog);

export function StoreProvider({ children }: PropsWithChildren) {
  const { status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [state, baseDispatch] = useReducer(
    baseReducer,
    initialState,
    localStateRepository.load,
  );
  const [catalog, setCatalog] = useState(() =>
    mergeCatalogs(fallbackCatalog, localCatalogRepository.load()),
  );
  const catalogRef = useRef(catalog);
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

  const replaceCatalog = useCallback((next: Media[]) => {
    catalogRef.current = next;
    setCatalog(next);
    localCatalogRepository.save(next);
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
        replaceCatalog(mergeCatalogs(fallbackCatalog, snapshot.catalog));
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
    [hydrateLibrary, replaceCatalog, setLibrarySync],
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
      const next = reducer(previous, action, catalogRef.current);
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

  const registerCatalogItem = useCallback(
    async (item: Media) => {
      replaceCatalog(mergeCatalogs(catalogRef.current, [item]));
      const repository = cloudRepositoryRef.current;
      if (!repository) return;
      const refreshed = await repository.refreshCatalog();
      replaceCatalog(mergeCatalogs(fallbackCatalog, refreshed, [item]));
    },
    [replaceCatalog],
  );

  const downloadExport = useCallback(() => {
    const account: AccountExportHeader = userId
      ? { mode: "cloud", identity: { email: user?.email ?? "" } }
      : { mode: "demo", identity: null };
    const doc = buildAccountExport(
      stateRef.current,
      catalogRef.current,
      account,
      new Date().toISOString(),
    );
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `movietracker-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [user, userId]);

  const deleteAllData = useCallback(async () => {
    const empty = emptyLibraryState(initialState);
    const repository = cloudRepositoryRef.current;
    // A signed-in account with any initialized/attempted cloud state may hold
    // cloud rows; only an uninitialized cloud (needs-import) or a signed-out
    // browser session has nothing in Neon to delete.
    const useCloud = !!repository && syncStatusRef.current !== "needs-import";

    if (repository && useCloud) {
      setLibrarySync({ status: "saving" });
      // Invalidate any in-flight mutation so its completion cannot flip status.
      mutationVersionRef.current += 1;
      // NOTE: a library mutation dispatched during this in-flight cloud
      // delete is not guarded against interleaving; the Account page exposes
      // no such mutation today, so this is low-reachability. Revisit if
      // delete ever becomes reachable alongside library edits.
      try {
        await mutationChainRef.current.catch(() => undefined);
        await repository.deleteAllData();
        replaceState(empty);
        setLibrarySync({ status: "needs-import" });
      } catch (error) {
        try {
          await loadCloudLibrary(repository);
        } catch {
          // Keep going; we still surface the error below.
        }
        setLibrarySync({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Your data could not be deleted.",
        });
      }
      return;
    }

    // Demo / signed-out / uninitialized-cloud: durable empty write so reload
    // does not reseed demo data.
    localStateRepository.save(empty);
    replaceState(empty);
  }, [loadCloudLibrary, replaceState, setLibrarySync]);

  const value = useMemo(
    () => ({
      state,
      catalog,
      dispatch,
      librarySync,
      startCloudSync,
      retryCloudSync,
      registerCatalogItem,
      downloadExport,
      deleteAllData,
    }),
    [
      catalog,
      deleteAllData,
      dispatch,
      downloadExport,
      librarySync,
      registerCatalogItem,
      retryCloudSync,
      startCloudSync,
      state,
    ],
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
