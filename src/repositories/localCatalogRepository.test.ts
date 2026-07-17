import { describe, expect, it } from "vitest";
import type { Media } from "../types";
import {
  createLocalCatalogRepository,
  mergeCatalogs,
} from "./localCatalogRepository";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const title: Media = {
  id: "tmdb-movie-123",
  title: "A Real Film",
  year: 2026,
  format: "movie",
  poster: "poster",
  backdrop: "backdrop",
  accent: "#777",
  runtime: 112,
  genres: ["Drama"],
  moods: ["Drama"],
  pace: "balanced",
  intensity: "balanced",
  adventurous: 5,
  synopsis: "Synopsis",
  creators: [],
  cast: [],
  services: [],
  country: "Norway",
  language: "Norwegian",
  provider: { name: "tmdb", id: 123, mediaType: "movie" },
};

describe("local catalog repository", () => {
  it("persists valid imported titles and ignores invalid records", () => {
    const storage = memoryStorage();
    const repository = createLocalCatalogRepository(storage);
    repository.save([title]);
    expect(repository.load()).toEqual([title]);

    storage.setItem("movietracker:catalog:v1", JSON.stringify([{}, title]));
    expect(repository.load()).toEqual([title]);
  });

  it("uses the newest normalized title for a provider ID", () => {
    expect(
      mergeCatalogs([title], [{ ...title, title: "Updated Film" }]),
    ).toEqual([{ ...title, title: "Updated Film" }]);
  });
});
