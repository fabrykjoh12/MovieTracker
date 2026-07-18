import type {
  AppState,
  EpisodeProgress,
  LibraryStatus,
  Media,
  MediaFormat,
  Shelf,
  UserMediaState,
  Verdict,
  WatchEvent,
} from "../types";

export interface AccountExportIdentity {
  email: string;
  handle?: string;
}

export interface AccountExportHeader {
  mode: "cloud" | "demo";
  identity: AccountExportIdentity | null;
}

export interface AccountExportLibraryEntry {
  mediaId: string;
  title?: string;
  year?: number;
  type?: MediaFormat;
  status: LibraryStatus;
  progress?: EpisodeProgress;
  watchedDates: string[];
  verdict: Verdict | null;
  queuePosition: number | null;
  intent?: UserMediaState["intent"];
}

export interface AccountExportEvent {
  id: string;
  mediaId: string;
  title?: string;
  type: WatchEvent["type"];
  watchedAt: string;
  season?: number;
  episode?: number;
}

export interface AccountExportV1 {
  format: "movietracker.account-export";
  version: 1;
  exportedAt: string;
  account: AccountExportHeader;
  library: AccountExportLibraryEntry[];
  shelves: Shelf[];
  watchEvents: AccountExportEvent[];
}

export function buildAccountExport(
  state: AppState,
  catalog: Media[],
  account: AccountExportHeader,
  exportedAt: string,
): AccountExportV1 {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const titleFields = (mediaId: string) => {
    const item = byId.get(mediaId);
    return item
      ? { title: item.title, year: item.year, type: item.format }
      : {};
  };

  const library = Object.values(state.userMedia).map((entry) => {
    const index = state.queue.indexOf(entry.mediaId);
    return {
      mediaId: entry.mediaId,
      ...titleFields(entry.mediaId),
      status: entry.status,
      ...(entry.progress ? { progress: entry.progress } : {}),
      watchedDates: entry.watchedDates,
      verdict: entry.verdict ?? null,
      queuePosition: index < 0 ? null : index,
      ...(entry.intent ? { intent: entry.intent } : {}),
    };
  });

  const watchEvents = state.events.map((event) => ({
    id: event.id,
    mediaId: event.mediaId,
    ...titleFields(event.mediaId),
    type: event.type,
    watchedAt: event.watchedAt,
    ...(event.season === undefined ? {} : { season: event.season }),
    ...(event.episode === undefined ? {} : { episode: event.episode }),
  }));

  return {
    format: "movietracker.account-export",
    version: 1,
    exportedAt,
    account,
    library,
    shelves: state.shelves.map((shelf) => ({ ...shelf })),
    watchEvents,
  };
}
