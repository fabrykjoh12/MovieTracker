import type { getNeonClient } from "../lib/neon";
import type { Json, Tables, TablesInsert } from "../lib/database.types";
import type { AppState, UserMediaState, Verdict, WatchEvent } from "../types";
import type {
  CloudLibrarySnapshot,
  LibrarySnapshot,
  LibrarySyncRepository,
} from "./contracts";
import { buildCatalogIdMaps, mapLibrarySnapshot } from "./mappers";

type NeonClient = NonNullable<Awaited<ReturnType<typeof getNeonClient>>>;
type MediaRow = Tables<"media">;

export class LibraryConflictError extends Error {
  constructor(mediaId: string) {
    super(
      `${mediaId} changed on another device. The latest cloud version was loaded.`,
    );
    this.name = "LibraryConflictError";
  }
}

function resultError(error: unknown, action: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return new Error(`${action}: ${error.message}`);
  }
  return new Error(`${action} failed.`);
}

function isUniqueViolation(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  );
}

function snapshot(state: AppState): LibrarySnapshot {
  return {
    userMedia: state.userMedia,
    events: state.events,
    queue: state.queue,
  };
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function intentJson(state: UserMediaState, queuePosition?: number): Json {
  return {
    ...(state.intent ?? {}),
    watchDates: state.watchedDates,
    ...(queuePosition === undefined ? {} : { queuePosition }),
  } as Json;
}

export function createNeonLibraryRepository(
  client: NeonClient,
  userId: string,
): LibrarySyncRepository {
  let catalogPromise: Promise<MediaRow[]> | null = null;
  const stateVersions = new Map<string, string>();
  const verdictVersions = new Map<string, string>();

  const catalog = async () => {
    catalogPromise ??= (async () => {
      const result = await client.from("media").select("*");
      if (result.error) throw resultError(result.error, "Loading the catalog");
      return result.data ?? [];
    })();
    return catalogPromise;
  };

  const databaseMediaId = async (localMediaId: string) => {
    const { localToDatabase } = buildCatalogIdMaps(await catalog());
    const databaseId = localToDatabase.get(localMediaId);
    if (!databaseId) {
      throw new Error(
        `The catalog does not contain a database mapping for ${localMediaId}.`,
      );
    }
    return databaseId;
  };

  const saveVerdict = async (localMediaId: string, verdict: Verdict) => {
    const mediaId = await databaseMediaId(localMediaId);
    const expectedVersion = verdictVersions.get(localMediaId);
    const values = {
      kind: verdict.kind,
      normalized: verdict.normalized,
      qualities: verdict.qualities,
      tags: verdict.tags,
      personal_rank: verdict.rank ?? null,
      recorded_at: verdict.recordedAt,
    };
    const result = expectedVersion
      ? await client
          .from("verdicts")
          .update(values)
          .eq("user_id", userId)
          .eq("media_id", mediaId)
          .is("season_id", null)
          .is("episode_id", null)
          .eq("updated_at", expectedVersion)
          .select("updated_at")
          .maybeSingle()
      : await client
          .from("verdicts")
          .insert({
            user_id: userId,
            media_id: mediaId,
            ...values,
          })
          .select("updated_at")
          .single();
    if (result.error) {
      if (isUniqueViolation(result.error)) {
        throw new LibraryConflictError(localMediaId);
      }
      throw resultError(result.error, "Saving the Verdict");
    }
    if (!result.data) throw new LibraryConflictError(localMediaId);
    verdictVersions.set(localMediaId, result.data.updated_at);
  };

  const removeVerdict = async (localMediaId: string) => {
    const mediaId = await databaseMediaId(localMediaId);
    const expectedVersion = verdictVersions.get(localMediaId);
    if (!expectedVersion) return;
    const result = await client
      .from("verdicts")
      .delete()
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .is("season_id", null)
      .is("episode_id", null)
      .eq("updated_at", expectedVersion)
      .select("id");
    if (result.error) throw resultError(result.error, "Removing the Verdict");
    if (!result.data?.length) throw new LibraryConflictError(localMediaId);
    verdictVersions.delete(localMediaId);
  };

  const recordEvent = async (event: WatchEvent) => {
    const mediaId = await databaseMediaId(event.mediaId);
    const existing = await client
      .from("watch_events")
      .select("id")
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .contains("metadata", { clientEventId: event.id });
    if (existing.error) {
      throw resultError(existing.error, "Checking the viewing history");
    }
    if (existing.data?.length) return;

    const values: TablesInsert<"watch_events"> = {
      user_id: userId,
      media_id: mediaId,
      event_type: event.type,
      watched_at: event.watchedAt,
      metadata: {
        clientEventId: event.id,
        ...(event.season === undefined ? {} : { season: event.season }),
        ...(event.episode === undefined ? {} : { episode: event.episode }),
        ...(event.previousQueueIndex === undefined
          ? {}
          : { previousQueueIndex: event.previousQueueIndex }),
        ...(event.previousState === undefined
          ? {}
          : { previousState: event.previousState as unknown as Json }),
      },
    };
    const result = await client.from("watch_events").insert(values);
    if (result.error) {
      throw resultError(result.error, "Recording the viewing history");
    }
  };

  const removeEvent = async (event: WatchEvent) => {
    const mediaId = await databaseMediaId(event.mediaId);
    const matching = await client
      .from("watch_events")
      .select("id")
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .contains("metadata", { clientEventId: event.id });
    if (matching.error) {
      throw resultError(matching.error, "Finding the viewing history entry");
    }
    if (!matching.data?.length) {
      const byId = await client
        .from("watch_events")
        .delete()
        .eq("user_id", userId)
        .eq("id", event.id);
      if (byId.error) {
        throw resultError(byId.error, "Undoing the viewing history entry");
      }
      return;
    }
    const result = await client
      .from("watch_events")
      .delete()
      .eq("user_id", userId)
      .in(
        "id",
        matching.data.map((row) => row.id),
      );
    if (result.error) {
      throw resultError(result.error, "Undoing the viewing history entry");
    }
  };

  const repository: LibrarySyncRepository = {
    async load(): Promise<CloudLibrarySnapshot> {
      const [mediaRows, profile, states, verdicts, events] = await Promise.all([
        catalog(),
        client
          .from("profiles")
          .select("library_initialized_at")
          .eq("id", userId)
          .single(),
        client.from("user_media_states").select("*").eq("user_id", userId),
        client.from("verdicts").select("*").eq("user_id", userId),
        client
          .from("watch_events")
          .select("*")
          .eq("user_id", userId)
          .order("watched_at", { ascending: true }),
      ]);
      if (profile.error) {
        throw resultError(profile.error, "Loading the profile sync state");
      }
      if (states.error) {
        throw resultError(states.error, "Loading the library");
      }
      if (verdicts.error) {
        throw resultError(verdicts.error, "Loading Verdicts");
      }
      if (events.error) {
        throw resultError(events.error, "Loading viewing history");
      }
      const { databaseToLocal } = buildCatalogIdMaps(mediaRows);
      stateVersions.clear();
      verdictVersions.clear();
      states.data?.forEach((row) => {
        const localId = databaseToLocal.get(row.media_id);
        if (localId) stateVersions.set(localId, row.updated_at);
      });
      verdicts.data
        ?.filter((row) => row.season_id === null && row.episode_id === null)
        .forEach((row) => {
          const localId = databaseToLocal.get(row.media_id);
          if (localId) verdictVersions.set(localId, row.updated_at);
        });
      return {
        ...mapLibrarySnapshot(
          mediaRows,
          states.data ?? [],
          verdicts.data ?? [],
          events.data ?? [],
        ),
        initialized: profile.data.library_initialized_at !== null,
      };
    },

    async saveState(state, queuePosition) {
      const mediaId = await databaseMediaId(state.mediaId);
      const expectedVersion = stateVersions.get(state.mediaId);
      const values: TablesInsert<"user_media_states"> = {
        user_id: userId,
        media_id: mediaId,
        status: state.status,
        progress_season: state.progress?.season ?? null,
        progress_episode: state.progress?.episode ?? null,
        intent: intentJson(state, queuePosition),
        saved_at: state.savedAt,
      };
      const result = expectedVersion
        ? await client
            .from("user_media_states")
            .update(values)
            .eq("user_id", userId)
            .eq("media_id", mediaId)
            .eq("updated_at", expectedVersion)
            .select("updated_at")
            .maybeSingle()
        : await client
            .from("user_media_states")
            .insert(values)
            .select("updated_at")
            .single();
      if (result.error) {
        if (isUniqueViolation(result.error)) {
          throw new LibraryConflictError(state.mediaId);
        }
        throw resultError(result.error, "Saving the library state");
      }
      if (!result.data) throw new LibraryConflictError(state.mediaId);
      stateVersions.set(state.mediaId, result.data.updated_at);
    },

    async removeState(localMediaId) {
      const mediaId = await databaseMediaId(localMediaId);
      const expectedVersion = stateVersions.get(localMediaId);
      if (!expectedVersion) return;
      const result = await client
        .from("user_media_states")
        .delete()
        .eq("user_id", userId)
        .eq("media_id", mediaId)
        .eq("updated_at", expectedVersion)
        .select("id");
      if (result.error) {
        throw resultError(result.error, "Removing the library state");
      }
      if (!result.data?.length) throw new LibraryConflictError(localMediaId);
      stateVersions.delete(localMediaId);
    },

    async reorderQueue(mediaIds) {
      await Promise.all(
        mediaIds.map(async (localMediaId, index) => {
          const mediaId = await databaseMediaId(localMediaId);
          const current = await client
            .from("user_media_states")
            .select("intent")
            .eq("user_id", userId)
            .eq("media_id", mediaId)
            .single();
          if (current.error) {
            throw resultError(current.error, "Loading the queue item");
          }
          const currentIntent =
            current.data.intent &&
            typeof current.data.intent === "object" &&
            !Array.isArray(current.data.intent)
              ? current.data.intent
              : {};
          const result = await client
            .from("user_media_states")
            .update({ intent: { ...currentIntent, queuePosition: index } })
            .eq("user_id", userId)
            .eq("media_id", mediaId)
            .eq("updated_at", stateVersions.get(localMediaId) ?? "")
            .select("updated_at")
            .maybeSingle();
          if (result.error) {
            throw resultError(result.error, "Reordering the queue");
          }
          if (!result.data) throw new LibraryConflictError(localMediaId);
          stateVersions.set(localMediaId, result.data.updated_at);
        }),
      );
    },

    async import(library) {
      for (const state of Object.values(library.userMedia)) {
        const position = library.queue.indexOf(state.mediaId);
        await repository.saveState(state, position < 0 ? undefined : position);
        if (state.verdict) await saveVerdict(state.mediaId, state.verdict);
      }
      for (const event of library.events) await recordEvent(event);
      const completed = await client
        .from("profiles")
        .update({ library_initialized_at: new Date().toISOString() })
        .eq("id", userId);
      if (completed.error) {
        throw resultError(completed.error, "Completing cloud library setup");
      }
      return repository.load();
    },

    async persistChanges(previous, next) {
      const previousSnapshot = snapshot(previous);
      const nextSnapshot = snapshot(next);
      const mediaIds = new Set([
        ...Object.keys(previousSnapshot.userMedia),
        ...Object.keys(nextSnapshot.userMedia),
      ]);
      for (const mediaId of mediaIds) {
        const before = previousSnapshot.userMedia[mediaId];
        const after = nextSnapshot.userMedia[mediaId];
        if (!after && before) {
          await repository.removeState(mediaId);
          continue;
        }
        if (!after) continue;
        const position = nextSnapshot.queue.indexOf(mediaId);
        const previousPosition = previousSnapshot.queue.indexOf(mediaId);
        if (!same(before, after) || previousPosition !== position) {
          await repository.saveState(
            after,
            position < 0 ? undefined : position,
          );
        }
        if (!same(before?.verdict, after.verdict)) {
          if (after.verdict) await saveVerdict(mediaId, after.verdict);
          else if (before?.verdict) await removeVerdict(mediaId);
        }
      }

      const previousEvents = new Map(
        previousSnapshot.events.map((event) => [event.id, event]),
      );
      const nextEvents = new Map(
        nextSnapshot.events.map((event) => [event.id, event]),
      );
      for (const event of nextSnapshot.events) {
        if (!previousEvents.has(event.id)) await recordEvent(event);
      }
      for (const event of previousSnapshot.events) {
        if (!nextEvents.has(event.id)) await removeEvent(event);
      }
    },
  };

  return repository;
}
