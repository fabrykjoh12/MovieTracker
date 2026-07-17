import type { getNeonClient } from "../lib/neon";
import type { Json, Tables, TablesInsert } from "../lib/database.types";
import type { AppState, UserMediaState, Verdict, WatchEvent } from "../types";
import type { LibrarySnapshot, LibrarySyncRepository } from "./contracts";
import { buildCatalogIdMaps, mapLibrarySnapshot } from "./mappers";

type NeonClient = NonNullable<Awaited<ReturnType<typeof getNeonClient>>>;
type MediaRow = Tables<"media">;

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
    const existing = await client
      .from("verdicts")
      .select("id")
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .is("season_id", null)
      .is("episode_id", null)
      .maybeSingle();
    if (existing.error) {
      throw resultError(existing.error, "Finding the existing Verdict");
    }
    const values = {
      kind: verdict.kind,
      normalized: verdict.normalized,
      qualities: verdict.qualities,
      tags: verdict.tags,
      personal_rank: verdict.rank ?? null,
      recorded_at: verdict.recordedAt,
    };
    const result = existing.data
      ? await client.from("verdicts").update(values).eq("id", existing.data.id)
      : await client.from("verdicts").insert({
          user_id: userId,
          media_id: mediaId,
          ...values,
        });
    if (result.error) throw resultError(result.error, "Saving the Verdict");
  };

  const removeVerdict = async (localMediaId: string) => {
    const mediaId = await databaseMediaId(localMediaId);
    const result = await client
      .from("verdicts")
      .delete()
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .is("season_id", null)
      .is("episode_id", null);
    if (result.error) throw resultError(result.error, "Removing the Verdict");
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
    async load() {
      const [mediaRows, states, verdicts, events] = await Promise.all([
        catalog(),
        client.from("user_media_states").select("*").eq("user_id", userId),
        client.from("verdicts").select("*").eq("user_id", userId),
        client
          .from("watch_events")
          .select("*")
          .eq("user_id", userId)
          .order("watched_at", { ascending: true }),
      ]);
      if (states.error) {
        throw resultError(states.error, "Loading the library");
      }
      if (verdicts.error) {
        throw resultError(verdicts.error, "Loading Verdicts");
      }
      if (events.error) {
        throw resultError(events.error, "Loading viewing history");
      }
      return mapLibrarySnapshot(
        mediaRows,
        states.data ?? [],
        verdicts.data ?? [],
        events.data ?? [],
      );
    },

    async saveState(state, queuePosition) {
      const mediaId = await databaseMediaId(state.mediaId);
      const values: TablesInsert<"user_media_states"> = {
        user_id: userId,
        media_id: mediaId,
        status: state.status,
        progress_season: state.progress?.season ?? null,
        progress_episode: state.progress?.episode ?? null,
        intent: intentJson(state, queuePosition),
        saved_at: state.savedAt,
      };
      const result = await client
        .from("user_media_states")
        .upsert(values, { onConflict: "user_id,media_id" });
      if (result.error) {
        throw resultError(result.error, "Saving the library state");
      }
    },

    async removeState(localMediaId) {
      const mediaId = await databaseMediaId(localMediaId);
      const result = await client
        .from("user_media_states")
        .delete()
        .eq("user_id", userId)
        .eq("media_id", mediaId);
      if (result.error) {
        throw resultError(result.error, "Removing the library state");
      }
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
            .eq("media_id", mediaId);
          if (result.error) {
            throw resultError(result.error, "Reordering the queue");
          }
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
        if (!same(before, after) || !same(previous.queue, next.queue)) {
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
