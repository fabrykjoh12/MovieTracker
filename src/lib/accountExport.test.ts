import { describe, expect, it } from "vitest";
import type { AppState, Media } from "../types";
import { buildAccountExport } from "./accountExport";

const media: Media[] = [
  {
    id: "severance",
    title: "Severance",
    year: 2022,
    format: "series",
    poster: "",
    backdrop: "",
    accent: "#000",
    runtime: 52,
    genres: [],
    moods: [],
    pace: "measured",
    intensity: "balanced",
    adventurous: 0,
    synopsis: "",
    creators: [],
    cast: [],
    services: [],
    country: "United States",
    language: "English",
  },
];

const state: AppState = {
  version: 1,
  userMedia: {
    severance: {
      mediaId: "severance",
      status: "up-next",
      progress: { season: 2, episode: 3 },
      watchedDates: ["2026-07-01T00:00:00.000Z"],
      verdict: {
        kind: "loved",
        normalized: 4,
        qualities: ["Story"],
        tags: ["eerie"],
        recordedAt: "2026-07-02T00:00:00.000Z",
      },
      savedAt: "2026-06-01T00:00:00.000Z",
    },
    ghostwritten: {
      mediaId: "ghostwritten",
      status: "planned",
      watchedDates: [],
      savedAt: "2026-06-02T00:00:00.000Z",
    },
  },
  events: [
    {
      id: "e1",
      mediaId: "severance",
      type: "episode",
      season: 2,
      episode: 3,
      watchedAt: "2026-07-01T00:00:00.000Z",
    },
  ],
  shelves: [
    {
      id: "s1",
      title: "Weekend",
      description: "",
      mediaIds: ["severance"],
      featuredId: "severance",
      visibility: "private",
      atmosphere: "#111",
    },
  ],
  queue: ["severance"],
  filters: {} as AppState["filters"],
  room: {} as AppState["room"],
};

describe("buildAccountExport", () => {
  it("produces a versioned, self-describing document", () => {
    const doc = buildAccountExport(
      state,
      media,
      { mode: "cloud", identity: { email: "a@b.c" } },
      "2026-07-18T00:00:00.000Z",
    );

    expect(doc.format).toBe("movietracker.account-export");
    expect(doc.version).toBe(1);
    expect(doc.exportedAt).toBe("2026-07-18T00:00:00.000Z");
    expect(doc.account).toEqual({
      mode: "cloud",
      identity: { email: "a@b.c" },
    });

    const severance = doc.library.find((e) => e.mediaId === "severance")!;
    expect(severance.title).toBe("Severance");
    expect(severance.year).toBe(2022);
    expect(severance.type).toBe("series");
    expect(severance.queuePosition).toBe(0);
    expect(severance.verdict?.kind).toBe("loved");

    const planned = doc.library.find((e) => e.mediaId === "ghostwritten")!;
    expect(planned.queuePosition).toBeNull();
    expect(planned.verdict).toBeNull();
  });

  it("omits titles for media missing from the catalog", () => {
    const doc = buildAccountExport(
      state,
      [],
      { mode: "demo", identity: null },
      "2026-07-18T00:00:00.000Z",
    );
    const severance = doc.library.find((e) => e.mediaId === "severance")!;
    expect(severance.title).toBeUndefined();
    expect(severance.year).toBeUndefined();
    expect(severance.type).toBeUndefined();
    expect(doc.watchEvents[0]!.title).toBeUndefined();
    expect(doc.account).toEqual({ mode: "demo", identity: null });
  });
});
