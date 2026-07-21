import { describe, expect, it } from "vitest";
import { initialState, media } from "./data";
import {
  aggregateVerdicts,
  canTransition,
  candidateEligible,
  completeSeason,
  isSpoilerVisible,
  markNextEpisode,
  matchRoomCandidates,
  moveShelfItem,
  mutualMatches,
  nextEpisode,
  normalizeVerdict,
  placeByPairwise,
  progressPercent,
  scoreTonightCandidate,
  startRewatch,
  undoLastTracking,
  weeklyWatchSummary,
} from "./domain";
import { reducer } from "./store";
import type { Media, UserMediaState, WatchEvent } from "./types";

const severance = media.find((item) => item.id === "severance")!;
const duneTwo = media.find((item) => item.id === "dune-part-two")!;

describe("episode tracking", () => {
  it("marks the exact next episode and updates progress immediately", () => {
    const current: UserMediaState = {
      mediaId: severance.id,
      status: "paused",
      progress: { season: 1, episode: 8 },
      watchedDates: [],
      savedAt: "2026-01-01",
    };
    const result = markNextEpisode(
      current,
      severance,
      "2026-07-16T20:00:00.000Z",
    );
    expect(result.state.progress).toEqual({ season: 1, episode: 9 });
    expect(result.state.status).toBe("watching");
    expect(result.event?.previousState).toEqual(current);
  });

  it("moves cleanly to the first episode of a later season", () => {
    expect(nextEpisode(severance, { season: 1, episode: 9 })).toMatchObject({
      season: { number: 2 },
      episode: { number: 1 },
    });
  });

  it("batch-completes a season and records a reversible event", () => {
    const current: UserMediaState = {
      mediaId: severance.id,
      status: "watching",
      progress: { season: 1, episode: 2 },
      watchedDates: [],
      savedAt: "2026-01-01",
    };
    const result = completeSeason(
      current,
      severance,
      1,
      "2026-07-16T20:00:00.000Z",
    );
    expect(result.state.progress).toEqual({ season: 1, episode: 9 });
    expect(result.state.status).toBe("watching");
    expect(result.event.type).toBe("season");
  });

  it("undoes the latest tracking action without disturbing earlier history", () => {
    const base = structuredClone(initialState);
    const current = base.userMedia.severance!;
    const result = markNextEpisode(
      current,
      severance,
      "2026-07-16T20:00:00.000Z",
    );
    const changed = {
      ...base,
      userMedia: { ...base.userMedia, severance: result.state },
      events: [...base.events, result.event!],
    };
    const undone = undoLastTracking(changed);
    expect(undone.userMedia.severance?.progress).toEqual(current.progress);
    expect(undone.events).toHaveLength(base.events.length);
  });

  it("calculates progress across seasons", () => {
    expect(progressPercent(severance, { season: 1, episode: 9 })).toBe(47);
  });
});

describe("rewatches and verdicts", () => {
  it("starts a rewatch while preserving prior watch dates", () => {
    const current = initialState.userMedia.arrival!;
    const next = startRewatch(current, "2026-07-16T20:00:00.000Z");
    expect(next.status).toBe("rewatching");
    expect(next.watchedDates).toHaveLength(current.watchedDates.length + 1);
    expect(
      current.watchedDates.every((date) => next.watchedDates.includes(date)),
    ).toBe(true);
  });

  it("records a rewatch event through the application reducer", () => {
    const next = reducer(structuredClone(initialState), {
      type: "rewatch",
      mediaId: "arrival",
    });
    expect(next.events.at(-1)?.type).toBe("rewatch");
    expect(next.events.at(-1)?.previousState?.status).toBe("completed");
  });

  it("normalizes human verdicts without collapsing their labels", () => {
    expect(normalizeVerdict("all-timer")).toBeGreaterThan(
      normalizeVerdict("loved"),
    );
    expect(normalizeVerdict("not-for-me")).toBeGreaterThan(
      normalizeVerdict("dropped"),
    );
  });

  it("uses a single pairwise choice to place a title locally", () => {
    expect(
      placeByPairwise(
        ["arrival", "dune-part-two", "dark"],
        "past-lives",
        "dune-part-two",
        true,
      ),
    ).toEqual(["arrival", "past-lives", "dune-part-two", "dark"]);
  });
});

describe("recommendations and watch together", () => {
  it("filters Tonight candidates by runtime, format, services, and intensity", () => {
    const filters = {
      ...initialState.filters,
      maxRuntime: 110,
      format: "movie" as const,
      services: ["MUBI"],
      intensity: "balanced" as const,
    };
    const pastLives = media.find((item) => item.id === "past-lives")!;
    expect(candidateEligible(pastLives, filters)).toBe(true);
    expect(candidateEligible(severance, filters)).toBe(false);
    expect(
      scoreTonightCandidate(
        pastLives,
        filters,
        initialState.userMedia["past-lives"],
      ),
    ).toBeGreaterThan(40);
  });

  it("builds a focused candidate set from room constraints", () => {
    const candidates = matchRoomCandidates(initialState.room, media);
    expect(
      candidates.every((candidate) => {
        const item = media.find((entry) => entry.id === candidate.mediaId)!;
        return (
          item.format === "movie" &&
          item.runtime <= 150 &&
          item.services.some((service) =>
            initialState.room.constraints.services.includes(service),
          )
        );
      }),
    ).toBe(true);
  });

  it("reveals only candidates without a participant no vote", () => {
    const room = structuredClone(initialState.room);
    room.candidates[0]!.votes.You = "yes";
    room.candidates[1]!.votes.You = "no";
    expect(
      mutualMatches(room).some(
        (candidate) => candidate.mediaId === room.candidates[1]!.mediaId,
      ),
    ).toBe(false);
  });
});

describe("spoilers, library, shelves, and ratings", () => {
  it("never exposes reactions ahead of recorded progress", () => {
    expect(
      isSpoilerVisible(
        { mediaId: "severance", level: "episode", season: 2, episode: 3 },
        { season: 2, episode: 2 },
      ),
    ).toBe(false);
    expect(
      isSpoilerVisible(
        { mediaId: "severance", level: "episode", season: 2, episode: 2 },
        { season: 2, episode: 2 },
      ),
    ).toBe(true);
    expect(
      isSpoilerVisible(
        { mediaId: "severance", level: "season", season: 1 },
        { season: 2, episode: 1 },
      ),
    ).toBe(true);
  });

  it("guards meaningful library status transitions", () => {
    expect(canTransition("planned", "up-next")).toBe(true);
    expect(canTransition("completed", "watching")).toBe(false);
    expect(canTransition("completed", "rewatching")).toBe(true);
  });

  it("reorders shelf items without losing identity", () => {
    expect(moveShelfItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveShelfItem(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
  });

  it("uses Bayesian weighting and exposes low-sample uncertainty", () => {
    const small = aggregateVerdicts(["all-timer"]);
    const large = aggregateVerdicts(
      Array.from({ length: 60 }, () => "loved" as const),
    );
    expect(small.mean).toBeLessThan(normalizeVerdict("all-timer"));
    expect(small.confidence).toBe("low");
    expect(large.confidence).toBe("strong");
  });

  it("handles incomplete series metadata without throwing", () => {
    const incomplete: Media = {
      ...severance,
      id: "incomplete",
      seasons: [],
      services: [],
      genres: [],
      moods: [],
    };
    expect(nextEpisode(incomplete)).toBeUndefined();
    expect(progressPercent(incomplete)).toBe(0);
  });
});

describe("weekly watch summary", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");
  const isoDaysAgo = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  it("sums real event durations from the catalog, not a fixed number", () => {
    const events: WatchEvent[] = [
      {
        id: "e1",
        mediaId: duneTwo.id,
        type: "movie",
        watchedAt: isoDaysAgo(0),
      },
      {
        id: "e2",
        mediaId: severance.id,
        type: "episode",
        season: 1,
        episode: 1,
        watchedAt: isoDaysAgo(1),
      },
    ];
    const summary = weeklyWatchSummary(events, media, now);
    const episodeOneRuntime = severance.seasons![0]!.episodes[0]!.runtime;

    expect(summary.totalMinutes).toBe(duneTwo.runtime + episodeOneRuntime);
    expect(summary.dailyMinutes).toHaveLength(7);
    expect(summary.dailyMinutes.at(-1)).toBe(duneTwo.runtime);
    expect(summary.dailyMinutes.at(-2)).toBe(episodeOneRuntime);
  });

  it("sums every episode when a whole season is marked complete", () => {
    const events: WatchEvent[] = [
      {
        id: "e1",
        mediaId: severance.id,
        type: "season",
        season: 1,
        watchedAt: isoDaysAgo(0),
      },
    ];
    const seasonTotal = severance.seasons![0]!.episodes.reduce(
      (sum, episode) => sum + episode.runtime,
      0,
    );

    expect(weeklyWatchSummary(events, media, now).totalMinutes).toBe(
      seasonTotal,
    );
  });

  it("excludes events older than seven days", () => {
    const events: WatchEvent[] = [
      {
        id: "e1",
        mediaId: duneTwo.id,
        type: "movie",
        watchedAt: isoDaysAgo(8),
      },
    ];

    expect(weeklyWatchSummary(events, media, now).totalMinutes).toBe(0);
  });

  it("does not count a rewatch marker as watched time on its own", () => {
    const events: WatchEvent[] = [
      {
        id: "e1",
        mediaId: severance.id,
        type: "rewatch",
        watchedAt: isoDaysAgo(0),
      },
    ];

    expect(weeklyWatchSummary(events, media, now).totalMinutes).toBe(0);
  });

  it("ignores events for media no longer in the catalog instead of throwing", () => {
    const events: WatchEvent[] = [
      {
        id: "e1",
        mediaId: "not-in-catalog",
        type: "movie",
        watchedAt: isoDaysAgo(0),
      },
    ];

    expect(() => weeklyWatchSummary(events, media, now)).not.toThrow();
    expect(weeklyWatchSummary(events, media, now).totalMinutes).toBe(0);
  });

  it("returns an honest zero for a brand-new account with no events", () => {
    const summary = weeklyWatchSummary([], media, now);

    expect(summary.totalMinutes).toBe(0);
    expect(summary.dailyMinutes).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
