import { describe, expect, it } from "vitest";
import { initialState, media } from "./data";
import {
  aggregateVerdicts,
  canTransition,
  candidateEligible,
  completeSeason,
  continueWatchingCandidate,
  isSpoilerVisible,
  libraryOverview,
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
  tasteCloud,
  topFavourites,
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

describe("continue watching candidate", () => {
  const watching = (
    mediaId: string,
    overrides: Partial<UserMediaState> = {},
  ): UserMediaState => ({
    mediaId,
    status: "watching",
    progress: { season: 1, episode: 1 },
    watchedDates: ["2026-07-10T00:00:00.000Z"],
    savedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  });

  it("returns undefined for a brand-new account with nothing in progress", () => {
    expect(continueWatchingCandidate({}, media)).toBeUndefined();
  });

  it("returns the real in-progress series, not a fixed title", () => {
    const result = continueWatchingCandidate({ dark: watching("dark") }, media);
    expect(result?.id).toBe("dark");
  });

  it("picks the most recently active title among several in progress", () => {
    const result = continueWatchingCandidate(
      {
        severance: watching("severance", {
          watchedDates: ["2020-01-01T00:00:00.000Z"],
        }),
        dark: watching("dark", {
          watchedDates: ["2026-07-20T00:00:00.000Z"],
        }),
      },
      media,
    );
    expect(result?.id).toBe("dark");
  });

  it("excludes a movie marked watching, since it has no next episode to show", () => {
    const result = continueWatchingCandidate(
      { "dune-part-two": watching("dune-part-two") },
      media,
    );
    expect(result).toBeUndefined();
  });

  it("excludes a series that has already finished airing what it has", () => {
    const result = continueWatchingCandidate(
      {
        severance: watching("severance", {
          progress: { season: 2, episode: 10 },
        }),
      },
      media,
    );
    expect(result).toBeUndefined();
  });

  it("excludes titles that are not actively being watched", () => {
    const result = continueWatchingCandidate(
      { dark: watching("dark", { status: "planned" }) },
      media,
    );
    expect(result).toBeUndefined();
  });
});

describe("library overview", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  it("returns honest zeros for a brand-new account", () => {
    expect(libraryOverview({}, [], media, now)).toEqual({
      totalWatched: 0,
      watchedThisYear: 0,
      filmsThisYear: 0,
      seriesThisYear: 0,
      totalHours: 0,
      hoursThisYear: 0,
      totalRewatches: 0,
      rewatchesThisYear: 0,
      favouritesThisYear: 0,
    });
  });

  it("counts real completions and hours, not fabricated statistics", () => {
    const userMedia: Record<string, UserMediaState> = {
      "dune-part-two": {
        mediaId: "dune-part-two",
        status: "completed",
        watchedDates: ["2026-06-01T00:00:00.000Z"],
        savedAt: "2026-05-01T00:00:00.000Z",
        verdict: {
          kind: "all-timer",
          normalized: normalizeVerdict("all-timer"),
          qualities: [],
          tags: [],
          recordedAt: "2026-06-01T00:00:00.000Z",
        },
      },
      dark: {
        mediaId: "dark",
        status: "planned",
        watchedDates: [],
        savedAt: "2020-01-01T00:00:00.000Z",
      },
    };
    const events: WatchEvent[] = [
      {
        id: "e1",
        mediaId: "dune-part-two",
        type: "movie",
        watchedAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    const overview = libraryOverview(userMedia, events, media, now);
    expect(overview.totalWatched).toBe(1);
    expect(overview.watchedThisYear).toBe(1);
    expect(overview.filmsThisYear).toBe(1);
    expect(overview.seriesThisYear).toBe(0);
    expect(overview.totalHours).toBe(Math.round(duneTwo.runtime / 60));
    expect(overview.hoursThisYear).toBe(Math.round(duneTwo.runtime / 60));
    expect(overview.favouritesThisYear).toBe(1);
  });

  it("excludes activity from an earlier year from the this-year counts", () => {
    const userMedia: Record<string, UserMediaState> = {
      "dune-part-two": {
        mediaId: "dune-part-two",
        status: "completed",
        watchedDates: ["2020-01-01T00:00:00.000Z"],
        savedAt: "2020-01-01T00:00:00.000Z",
      },
    };
    const overview = libraryOverview(userMedia, [], media, now);
    expect(overview.totalWatched).toBe(1);
    expect(overview.watchedThisYear).toBe(0);
  });

  it("counts rewatch events overall and within the current year", () => {
    const events: WatchEvent[] = [
      {
        id: "e1",
        mediaId: "dark",
        type: "rewatch",
        watchedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        mediaId: "dark",
        type: "rewatch",
        watchedAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    const overview = libraryOverview({}, events, media, now);
    expect(overview.totalRewatches).toBe(2);
    expect(overview.rewatchesThisYear).toBe(1);
  });
});

describe("top favourites", () => {
  it("returns an empty personal canon for a brand-new account", () => {
    expect(topFavourites({}, media, 4)).toEqual([]);
  });

  it("ranks an explicit rank ahead of an unranked stronger verdict", () => {
    const userMedia: Record<string, UserMediaState> = {
      dark: {
        mediaId: "dark",
        status: "completed",
        watchedDates: [],
        savedAt: "2026-01-01",
        verdict: {
          kind: "liked",
          normalized: normalizeVerdict("liked"),
          qualities: [],
          tags: [],
          recordedAt: "2026-01-01",
          rank: 1,
        },
      },
      "dune-part-two": {
        mediaId: "dune-part-two",
        status: "completed",
        watchedDates: [],
        savedAt: "2026-01-01",
        verdict: {
          kind: "all-timer",
          normalized: normalizeVerdict("all-timer"),
          qualities: [],
          tags: [],
          recordedAt: "2026-01-01",
        },
      },
    };
    const result = topFavourites(userMedia, media, 4);
    expect(result[0]?.id).toBe("dark");
  });

  it("excludes titles with no recorded verdict", () => {
    const userMedia: Record<string, UserMediaState> = {
      dark: {
        mediaId: "dark",
        status: "planned",
        watchedDates: [],
        savedAt: "2026-01-01",
      },
    };
    expect(topFavourites(userMedia, media, 4)).toEqual([]);
  });
});

describe("taste cloud", () => {
  it("returns nothing for a brand-new account instead of a fixed editorial list", () => {
    expect(tasteCloud({}, media)).toEqual([]);
  });

  it("builds real genre and mood tags from the account's own library", () => {
    const userMedia: Record<string, UserMediaState> = {
      dark: {
        mediaId: "dark",
        status: "completed",
        watchedDates: [],
        savedAt: "2026-01-01",
      },
    };
    const result = tasteCloud(userMedia, media);
    const labels = result.map((tag) => tag.label);
    expect(labels).toEqual(expect.arrayContaining(["Mystery", "Dark"]));
  });

  it("excludes dropped titles from the taste cloud", () => {
    const userMedia: Record<string, UserMediaState> = {
      dark: {
        mediaId: "dark",
        status: "dropped",
        watchedDates: [],
        savedAt: "2026-01-01",
      },
    };
    expect(tasteCloud(userMedia, media)).toEqual([]);
  });
});
