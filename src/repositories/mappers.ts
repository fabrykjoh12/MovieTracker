import type { Json, Tables } from "../lib/database.types";
import type { Quality, UserMediaState, Verdict, WatchEvent } from "../types";
import { verdictQualities } from "./contracts";
import type { LibrarySnapshot } from "./contracts";

type MediaRow = Tables<"media">;
type StateRow = Tables<"user_media_states">;
type VerdictRow = Tables<"verdicts">;
type WatchEventRow = Tables<"watch_events">;

const watchEventTypes = new Set<WatchEvent["type"]>([
  "episode",
  "movie",
  "season",
  "rewatch",
]);
const qualitySet = new Set<string>(verdictQualities);
const queueFinalStatuses = new Set(["completed", "dropped", "archived"]);

function jsonObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function optionalString(value: Json | undefined) {
  return typeof value === "string" && value.length ? value : undefined;
}

function isMedia(value: unknown): value is import("../types").Media {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<import("../types").Media>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    (item.format === "movie" || item.format === "series") &&
    typeof item.poster === "string" &&
    typeof item.backdrop === "string" &&
    typeof item.runtime === "number" &&
    Array.isArray(item.genres) &&
    Array.isArray(item.moods) &&
    typeof item.synopsis === "string"
  );
}

export function mapCatalogRows(
  mediaRows: MediaRow[],
  fallbackCatalog: import("../types").Media[],
) {
  const merged = new Map(fallbackCatalog.map((item) => [item.id, item]));
  mediaRows.forEach((row) => {
    const metadata = jsonObject(row.metadata);
    const domain = metadata.domain;
    if (isMedia(domain)) merged.set(domain.id, domain);
  });
  return Array.from(merged.values());
}

function queuePosition(intent: Json) {
  const value = jsonObject(intent).queuePosition;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function watchDates(intent: Json) {
  const value = jsonObject(intent).watchDates;
  return Array.isArray(value)
    ? value.filter((date): date is string => typeof date === "string")
    : [];
}

function mapVerdict(row: VerdictRow | undefined): Verdict | undefined {
  if (!row) return undefined;
  return {
    kind: row.kind,
    normalized: row.normalized,
    qualities: row.qualities.filter((quality): quality is Quality =>
      qualitySet.has(quality),
    ),
    tags: row.tags,
    recordedAt: row.recorded_at,
    ...(row.personal_rank === null ? {} : { rank: row.personal_rank }),
  };
}

function mapWatchEvent(
  row: WatchEventRow,
  localMediaId: string,
): WatchEvent | undefined {
  if (!watchEventTypes.has(row.event_type as WatchEvent["type"])) {
    return undefined;
  }
  const metadata = jsonObject(row.metadata);
  const season = metadata.season;
  const episode = metadata.episode;
  const previousQueueIndex = metadata.previousQueueIndex;
  const previousState = metadata.previousState;
  return {
    id: row.id,
    mediaId: localMediaId,
    type: row.event_type as WatchEvent["type"],
    watchedAt: row.watched_at,
    ...(typeof season === "number" ? { season } : {}),
    ...(typeof episode === "number" ? { episode } : {}),
    ...(typeof previousQueueIndex === "number" ? { previousQueueIndex } : {}),
    ...(previousState &&
    typeof previousState === "object" &&
    !Array.isArray(previousState) &&
    typeof previousState.mediaId === "string" &&
    typeof previousState.status === "string"
      ? { previousState: previousState as unknown as UserMediaState }
      : {}),
  };
}

export function buildCatalogIdMaps(mediaRows: MediaRow[]) {
  const databaseToLocal = new Map<string, string>();
  const localToDatabase = new Map<string, string>();

  mediaRows.forEach((row) => {
    const localId = optionalString(jsonObject(row.metadata).localId);
    if (!localId) return;
    databaseToLocal.set(row.id, localId);
    localToDatabase.set(localId, row.id);
  });

  return { databaseToLocal, localToDatabase };
}

export function mapLibrarySnapshot(
  mediaRows: MediaRow[],
  stateRows: StateRow[],
  verdictRows: VerdictRow[],
  eventRows: WatchEventRow[],
): LibrarySnapshot {
  const { databaseToLocal } = buildCatalogIdMaps(mediaRows);
  const events = eventRows.flatMap((row) => {
    const localId = databaseToLocal.get(row.media_id);
    if (!localId) return [];
    const event = mapWatchEvent(row, localId);
    return event ? [event] : [];
  });
  const verdictByMedia = new Map(
    verdictRows
      .filter((row) => row.season_id === null && row.episode_id === null)
      .map((row) => [row.media_id, row]),
  );
  const statesWithQueue = stateRows.flatMap((row) => {
    const localId = databaseToLocal.get(row.media_id);
    if (!localId) return [];
    const intent = jsonObject(row.intent);
    const mediaEvents = events.filter((event) => event.mediaId === localId);
    const recordedDates = Array.from(
      new Set([
        ...watchDates(row.intent),
        ...mediaEvents.map((event) => event.watchedAt),
      ]),
    ).sort();
    const state: UserMediaState = {
      mediaId: localId,
      status: row.status,
      watchedDates: recordedDates,
      savedAt: row.saved_at,
      ...(row.progress_season === null || row.progress_episode === null
        ? {}
        : {
            progress: {
              season: row.progress_season,
              episode: row.progress_episode,
            },
          }),
      ...(mapVerdict(verdictByMedia.get(row.media_id))
        ? { verdict: mapVerdict(verdictByMedia.get(row.media_id)) }
        : {}),
      ...(Object.keys(intent).length
        ? {
            intent: {
              ...(optionalString(intent.reason)
                ? { reason: optionalString(intent.reason) }
                : {}),
              ...(optionalString(intent.recommendedBy)
                ? { recommendedBy: optionalString(intent.recommendedBy) }
                : {}),
              ...(optionalString(intent.withWhom)
                ? { withWhom: optionalString(intent.withWhom) }
                : {}),
              ...(optionalString(intent.mood)
                ? { mood: optionalString(intent.mood) }
                : {}),
              ...(intent.priority === "low" ||
              intent.priority === "medium" ||
              intent.priority === "high"
                ? { priority: intent.priority }
                : {}),
              ...(optionalString(intent.note)
                ? { note: optionalString(intent.note) }
                : {}),
            },
          }
        : {}),
    };
    return [{ state, queuePosition: queuePosition(row.intent) }];
  });
  const userMedia = Object.fromEntries(
    statesWithQueue.map(({ state }) => [state.mediaId, state]),
  );
  const queue = statesWithQueue
    .filter(
      (entry) =>
        !queueFinalStatuses.has(entry.state.status) &&
        entry.queuePosition !== undefined,
    )
    .sort((left, right) => left.queuePosition! - right.queuePosition!)
    .map((entry) => entry.state.mediaId);
  const unorderedUpNext = statesWithQueue
    .filter(
      (entry) =>
        entry.state.status === "up-next" && entry.queuePosition === undefined,
    )
    .map((entry) => entry.state.mediaId);

  return { userMedia, events, queue: [...queue, ...unorderedUpNext] };
}
