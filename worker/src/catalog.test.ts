import { describe, expect, it } from "vitest";
import type { Media } from "../../src/types";
import { preserveCatalogIdentity } from "./catalog";

const providerMedia: Media = {
  id: "tmdb-tv-95396",
  title: "Severance",
  format: "series",
  year: 2022,
  poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
  backdrop: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
  accent: "#6f8c99",
  runtime: 52,
  genres: ["Drama"],
  moods: ["Thoughtful"],
  pace: "balanced",
  intensity: "balanced",
  adventurous: 0.5,
  synopsis: "A workplace mystery.",
  creators: ["Dan Erickson"],
  cast: ["Adam Scott"],
  services: ["Apple TV+"],
  country: "US",
  language: "English",
  provider: { name: "tmdb", id: 95396, mediaType: "tv" },
};

describe("catalog identity preservation", () => {
  it("retains the canonical ID of an existing curated title", () => {
    const result = preserveCatalogIdentity(providerMedia, {
      localId: "severance",
      catalog: "development",
    });

    expect(result.catalog).toBe("development");
    expect(result.media.id).toBe("severance");
    expect(result.media.provider).toEqual(providerMedia.provider);
  });

  it("uses the provider ID for a newly discovered title", () => {
    const result = preserveCatalogIdentity(providerMedia, undefined);

    expect(result.catalog).toBe("tmdb");
    expect(result.media).toBe(providerMedia);
  });
});
