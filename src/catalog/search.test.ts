import { describe, expect, it, vi } from "vitest";
import { CatalogApiError, createCatalogSearchClient } from "./search";

const importedMedia = {
  id: "tmdb-movie-123",
  title: "A Real Film",
  year: 2026,
  format: "movie" as const,
  poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
  backdrop: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
  accent: "#7e8061",
  runtime: 112,
  genres: ["Drama"],
  moods: ["Drama"],
  pace: "balanced" as const,
  intensity: "balanced" as const,
  adventurous: 5,
  synopsis: "A complete synopsis.",
  creators: ["A Director"],
  cast: ["An Actor"],
  services: [],
  country: "Norway",
  language: "Norwegian",
  provider: { name: "tmdb" as const, id: 123, mediaType: "movie" as const },
};

describe("catalog search client", () => {
  it("normalizes query parameters and rejects malformed results", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          source: "edge-cache",
          results: [
            {
              provider: "tmdb",
              providerId: 123,
              mediaType: "movie",
              format: "movie",
              title: "A Real Film",
              synopsis: "A complete synopsis.",
            },
            { provider: "unknown", title: "Unsafe result" },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = createCatalogSearchClient({
      baseUrl: "https://catalog.example.test/",
      request,
    });

    const response = await client.search("  Real Film  ", "movie");

    expect(response).toEqual({
      source: "edge-cache",
      results: [expect.objectContaining({ providerId: 123 })],
    });
    const url = new URL(String(request.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v1/search");
    expect(url.searchParams.get("q")).toBe("Real Film");
    expect(url.searchParams.get("format")).toBe("movie");
  });

  it("imports a normalized title and surfaces safe API errors", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ media: importedMedia }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: "Wait before trying again." } }),
          { status: 429 },
        ),
      );
    const client = createCatalogSearchClient({
      baseUrl: "https://catalog.example.test",
      request,
    });
    const result = {
      provider: "tmdb" as const,
      providerId: 123,
      mediaType: "movie" as const,
      format: "movie" as const,
      title: "A Real Film",
      synopsis: "A complete synopsis.",
    };

    await expect(client.importTitle(result)).resolves.toEqual(importedMedia);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
      provider: "tmdb",
      providerId: 123,
      mediaType: "movie",
    });
    await expect(client.search("again")).rejects.toEqual(
      expect.objectContaining<CatalogApiError>({
        name: "CatalogApiError",
        status: 429,
        message: "Wait before trying again.",
      }),
    );
  });
});
