import { describe, expect, it } from "vitest";
import seeds from "../../catalog/tmdb-seeds.json";
import { media } from "../data";
import { applyTmdbMetadata } from "./tmdb";

const arrival = media.find((item) => item.id === "arrival")!;

describe("TMDB catalog metadata", () => {
  it("maps every curated title to one provider identity of the right type", () => {
    expect(seeds).toHaveLength(media.length);
    expect(new Set(seeds.map((seed) => seed.localId)).size).toBe(media.length);
    for (const item of media) {
      const seed = seeds.find((entry) => entry.localId === item.id);
      expect(seed?.title).toBe(item.title);
      expect(seed?.mediaType).toBe(item.format === "series" ? "tv" : "movie");
    }
  });

  it("replaces editorial fallback artwork and records provider identity", () => {
    const enriched = applyTmdbMetadata(arrival, {
      providerId: 329865,
      mediaType: "movie",
      posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
      synopsis: "A real provider synopsis.",
      runtime: 116,
      year: 2016,
      genres: ["Drama", "Science Fiction"],
    });

    expect(enriched.poster).toContain("image.tmdb.org");
    expect(enriched.backdrop).toContain("image.tmdb.org");
    expect(enriched.provider).toEqual({
      name: "tmdb",
      id: 329865,
      mediaType: "movie",
    });
    expect(enriched.synopsis).toBe("A real provider synopsis.");
  });

  it("preserves useful fallback fields when provider metadata is incomplete", () => {
    const enriched = applyTmdbMetadata(arrival, {
      providerId: 329865,
      mediaType: "movie",
      posterUrl: null,
      backdropUrl: null,
      synopsis: null,
      runtime: null,
      year: null,
      genres: [],
    });

    expect(enriched.poster).toBe(arrival.poster);
    expect(enriched.backdrop).toBe(arrival.backdrop);
    expect(enriched.synopsis).toBe(arrival.synopsis);
    expect(enriched.runtime).toBe(arrival.runtime);
    expect(enriched.genres).toEqual(arrival.genres);
  });
});
