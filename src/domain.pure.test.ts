import { describe, expect, it } from "vitest";
import { initialState, media } from "./data";
import {
  formatVerdict,
  recommendationReason,
  statusLabel,
  tonightCandidates,
  totalEpisodes,
  watchedEpisodes,
} from "./domain";
import type { UserMediaState } from "./types";

const series = media.find((item) => item.seasons && item.seasons.length)!;
const movie = media.find((item) => item.format === "movie")!;

describe("formatVerdict", () => {
  it("maps every verdict kind to a human label", () => {
    expect(formatVerdict("all-timer")).toBe("All-timer");
    expect(formatVerdict("loved")).toBe("Loved it");
    expect(formatVerdict("liked")).toBe("Liked it");
    expect(formatVerdict("mixed")).toBe("Mixed");
    expect(formatVerdict("not-for-me")).toBe("Not for me");
    expect(formatVerdict("dropped")).toBe("Dropped");
  });
});

describe("statusLabel", () => {
  it("maps every library status to a human label", () => {
    expect(statusLabel("watching")).toBe("Watching");
    expect(statusLabel("up-next")).toBe("Up Next");
    expect(statusLabel("planned")).toBe("Planned");
    expect(statusLabel("paused")).toBe("Paused");
    expect(statusLabel("completed")).toBe("Completed");
    expect(statusLabel("dropped")).toBe("Dropped");
    expect(statusLabel("rewatching")).toBe("Rewatching");
    expect(statusLabel("archived")).toBe("Archived");
  });
});

describe("totalEpisodes", () => {
  it("sums every season's episodes for a series", () => {
    const expected = series.seasons!.reduce(
      (sum, season) => sum + season.episodes.length,
      0,
    );
    expect(totalEpisodes(series)).toBe(expected);
    expect(totalEpisodes(series)).toBeGreaterThan(0);
  });

  it("returns 0 for a media without seasons", () => {
    expect(totalEpisodes(movie)).toBe(0);
  });
});

describe("watchedEpisodes", () => {
  it("returns 0 when there is no progress", () => {
    expect(watchedEpisodes(series)).toBe(0);
  });

  it("counts earlier full seasons plus the current episode", () => {
    const firstSeason = series.seasons!.find((season) => season.number === 1)!;
    const result = watchedEpisodes(series, { season: 2, episode: 3 });
    expect(result).toBe(firstSeason.episodes.length + 3);
  });
});

describe("tonightCandidates", () => {
  it("returns at most three non-completed titles", () => {
    const result = tonightCandidates(media, initialState);
    expect(result.length).toBeLessThanOrEqual(3);
    for (const item of result) {
      expect(initialState.userMedia[item.id]?.status).not.toBe("completed");
    }
  });

  it("excludes a title once it is marked completed", () => {
    const target = tonightCandidates(media, initialState)[0]!;
    const state = {
      ...initialState,
      userMedia: {
        ...initialState.userMedia,
        [target.id]: {
          mediaId: target.id,
          status: "completed" as const,
          watchedDates: [],
          savedAt: "2026-01-01",
        },
      },
    };
    const ids = tonightCandidates(media, state).map((item) => item.id);
    expect(ids).not.toContain(target.id);
  });
});

describe("recommendationReason", () => {
  it("calls out titles already queued as Up Next", () => {
    const upNext: UserMediaState = {
      mediaId: movie.id,
      status: "up-next",
      watchedDates: [],
      savedAt: "2026-01-01",
    };
    expect(recommendationReason(movie, upNext)).toMatch(/^Already in Up Next/);
  });

  it("falls back to a taste-based reason without state", () => {
    const gentle = media.find(
      (item) =>
        item.adventurous < 8 && !item.genres.includes("Science fiction"),
    )!;
    expect(recommendationReason(gentle)).toMatch(/^Matches your taste for/);
  });
});
