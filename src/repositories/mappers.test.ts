import { describe, expect, it } from "vitest";
import type { Tables } from "../lib/database.types";
import { mapLibrarySnapshot } from "./mappers";

const mediaRow: Tables<"media"> = {
  id: "00000000-0000-4000-8000-000000000001",
  format: "series",
  tmdb_id: null,
  title: "Severance",
  original_title: null,
  release_year: 2022,
  runtime_minutes: 52,
  poster_path: null,
  backdrop_path: null,
  metadata: { localId: "severance" },
  metadata_updated_at: null,
  created_at: "2026-07-17T00:00:00.000Z",
};

const queuedPlannedMedia: Tables<"media"> = {
  ...mediaRow,
  id: "00000000-0000-4000-8000-000000000002",
  format: "movie",
  title: "Perfect Days",
  metadata: { localId: "perfect-days" },
};

const completedMedia: Tables<"media"> = {
  ...mediaRow,
  id: "00000000-0000-4000-8000-000000000003",
  format: "movie",
  title: "Past Lives",
  metadata: { localId: "past-lives" },
};

describe("database mappers", () => {
  it("hydrates local domain IDs, queue order, progress, events, and Verdicts", () => {
    const snapshot = mapLibrarySnapshot(
      [mediaRow],
      [
        {
          id: "state-1",
          user_id: "user-1",
          media_id: mediaRow.id,
          status: "up-next",
          progress_season: 2,
          progress_episode: 3,
          intent: {
            queuePosition: 0,
            reason: "Finish before Friday",
            priority: "high",
            watchDates: ["2026-07-12T00:00:00.000Z"],
          },
          saved_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-17T00:00:00.000Z",
        },
      ],
      [
        {
          id: "verdict-1",
          user_id: "user-1",
          media_id: mediaRow.id,
          season_id: null,
          episode_id: null,
          kind: "loved",
          normalized: 0.88,
          qualities: ["Story", "Atmosphere", "Unknown quality"],
          tags: ["Slow burn"],
          personal_rank: 4,
          recorded_at: "2026-07-17T00:00:00.000Z",
          updated_at: "2026-07-17T00:00:00.000Z",
        },
      ],
      [
        {
          id: "event-1",
          user_id: "user-1",
          media_id: mediaRow.id,
          season_id: null,
          episode_id: null,
          event_type: "episode",
          watched_at: "2026-07-16T00:00:00.000Z",
          rewatch_number: null,
          metadata: { season: 2, episode: 3 },
          created_at: "2026-07-16T00:00:00.000Z",
        },
      ],
    );

    expect(snapshot.queue).toEqual(["severance"]);
    expect(snapshot.userMedia.severance?.watchedDates).toEqual([
      "2026-07-12T00:00:00.000Z",
      "2026-07-16T00:00:00.000Z",
    ]);
    expect(snapshot.events).toEqual([
      expect.objectContaining({
        mediaId: "severance",
        season: 2,
        episode: 3,
      }),
    ]);
    expect(snapshot.userMedia.severance).toEqual(
      expect.objectContaining({
        mediaId: "severance",
        status: "up-next",
        progress: { season: 2, episode: 3 },
        intent: expect.objectContaining({ priority: "high" }),
        verdict: expect.objectContaining({
          kind: "loved",
          qualities: ["Story", "Atmosphere"],
          rank: 4,
        }),
      }),
    );
  });

  it("ignores rows whose catalog mapping or event type is unknown", () => {
    const snapshot = mapLibrarySnapshot(
      [mediaRow],
      [],
      [],
      [
        {
          id: "event-unknown",
          user_id: "user-1",
          media_id: mediaRow.id,
          season_id: null,
          episode_id: null,
          event_type: "future-event",
          watched_at: "2026-07-16T00:00:00.000Z",
          rewatch_number: null,
          metadata: {},
          created_at: "2026-07-16T00:00:00.000Z",
        },
      ],
    );

    expect(snapshot).toEqual({ userMedia: {}, events: [], queue: [] });
  });

  it("restores deliberate queue positions regardless of active status", () => {
    const baseState: Tables<"user_media_states"> = {
      id: "state-queued",
      user_id: "user-1",
      media_id: queuedPlannedMedia.id,
      status: "planned",
      progress_season: null,
      progress_episode: null,
      intent: { queuePosition: 1 },
      saved_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-17T00:00:00.000Z",
    };
    const snapshot = mapLibrarySnapshot(
      [queuedPlannedMedia, completedMedia],
      [
        baseState,
        {
          ...baseState,
          id: "state-completed",
          media_id: completedMedia.id,
          status: "completed",
          intent: { queuePosition: 0 },
        },
      ],
      [],
      [],
    );

    expect(snapshot.queue).toEqual(["perfect-days"]);
  });
});
