/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { Dispatch, PropsWithChildren } from "react";
import { initialState, media } from "./data";
import {
  completeSeason,
  markNextEpisode,
  moveQueueItem,
  normalizeVerdict,
  startRewatch,
  undoLastTracking,
} from "./domain";
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
  | { type: "reset" };

const key = "movietracker:v1";

const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return initialState;
    const parsed = JSON.parse(saved) as AppState;
    return parsed.version === initialState.version ? parsed : initialState;
  } catch {
    return initialState;
  }
};

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
    case "reset":
      return initialState;
  }
};

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
};
