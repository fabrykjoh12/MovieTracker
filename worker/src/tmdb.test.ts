import { describe, expect, it, vi } from "vitest";
import { fetchTmdbCatalogEntry, searchTmdb } from "./tmdb";

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TMDB provider adapter", () => {
  it("filters people, adult results, and the wrong requested format", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: 1,
            media_type: "person",
            name: "A Performer",
          },
          {
            id: 2,
            media_type: "movie",
            title: "An Adult Film",
            adult: true,
          },
          {
            id: 3,
            media_type: "tv",
            name: "A Series",
            first_air_date: "2026-01-02",
            overview: "Series overview",
          },
          {
            id: 4,
            media_type: "movie",
            title: "A Film",
            release_date: "2025-04-05",
            overview: "Film overview",
            poster_path: "/poster.jpg",
          },
        ],
      }),
    );

    const results = await searchTmdb("secret", "a film", "movie", request);

    expect(results).toEqual([
      expect.objectContaining({
        providerId: 4,
        format: "movie",
        title: "A Film",
        year: 2025,
        poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
      }),
    ]);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/3/search/multi" }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
  });

  it("builds a complete movie with Norwegian availability", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: 42,
        title: "Northern Light",
        original_title: "Nordlys",
        release_date: "2026-02-12",
        overview: "A patient journey north.",
        runtime: 108,
        poster_path: "/north-poster.jpg",
        backdrop_path: "/north-backdrop.jpg",
        genres: [{ name: "Drama" }],
        credits: {
          cast: [{ name: "Actor One" }],
          crew: [{ name: "Director One", job: "Director" }],
        },
        production_countries: [{ name: "Norway" }],
        spoken_languages: [{ english_name: "Norwegian" }],
        "watch/providers": {
          results: { NO: { flatrate: [{ provider_name: "MUBI" }] } },
        },
      }),
    );

    const entry = await fetchTmdbCatalogEntry("secret", "movie", 42, request);

    expect(entry.media).toEqual(
      expect.objectContaining({
        id: "tmdb-movie-42",
        title: "Northern Light",
        year: 2026,
        runtime: 108,
        creators: ["Director One"],
        cast: ["Actor One"],
        services: ["MUBI"],
        country: "Norway",
        language: "Norwegian",
      }),
    );
  });

  it("hydrates real seasons and episodes for series tracking", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/season/1")
        ? jsonResponse({
            season_number: 1,
            name: "Season 1",
            air_date: "2024-01-01",
            episodes: [
              {
                id: 9001,
                episode_number: 1,
                name: "First Light",
                runtime: 51,
                overview: "The story begins.",
              },
            ],
          })
        : jsonResponse({
            id: 90,
            name: "Long Winter",
            first_air_date: "2024-01-01",
            overview: "A limited series.",
            episode_run_time: [51],
            genres: [{ name: "Mystery" }],
            created_by: [{ name: "Creator One" }],
            credits: { cast: [{ name: "Actor One" }] },
            seasons: [{ season_number: 1, name: "Season 1" }],
          });
    });

    const entry = await fetchTmdbCatalogEntry("secret", "tv", 90, request);

    expect(entry.media.seasons).toEqual([
      expect.objectContaining({
        number: 1,
        episodes: [
          expect.objectContaining({
            id: "tmdb-episode-9001",
            number: 1,
            title: "First Light",
          }),
        ],
      }),
    ]);
  });
});
