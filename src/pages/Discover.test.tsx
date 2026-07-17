import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

const search = vi.fn();
const importTitle = vi.fn();

vi.mock("../lib/neon", () => ({
  getNeonClient: () => Promise.resolve(null),
  isNeonConfigured: false,
}));

vi.mock("../catalog/search", () => ({
  isCatalogSearchConfigured: true,
  getCatalogSearchClient: () => ({ search, importTitle }),
}));

describe("Discover catalog search", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "/discover";
    search.mockReset();
    importTitle.mockReset();
  });

  it("searches TMDB, imports a complete title, and opens its detail page", async () => {
    const result = {
      provider: "tmdb" as const,
      providerId: 42,
      mediaType: "movie" as const,
      format: "movie" as const,
      title: "Northern Light",
      year: 2026,
      synopsis: "A patient journey north.",
      poster: "https://image.tmdb.org/t/p/w500/north.jpg",
    };
    const media = {
      id: "tmdb-movie-42",
      title: "Northern Light",
      year: 2026,
      format: "movie" as const,
      poster: result.poster,
      backdrop: "https://image.tmdb.org/t/p/w1280/north.jpg",
      accent: "#7e8061",
      runtime: 108,
      genres: ["Drama"],
      moods: ["Drama"],
      pace: "balanced" as const,
      intensity: "balanced" as const,
      adventurous: 5,
      synopsis: result.synopsis,
      creators: ["Director One"],
      cast: ["Actor One"],
      services: ["MUBI"],
      country: "Norway",
      language: "Norwegian",
      provider: { name: "tmdb" as const, id: 42, mediaType: "movie" as const },
    };
    search.mockResolvedValue({ results: [result], source: "tmdb" });
    importTitle.mockResolvedValue(media);
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByRole("searchbox", { name: "Search movies and series" }),
      "Northern Light",
    );
    await waitFor(() => expect(search).toHaveBeenCalled());
    expect(
      await screen.findByRole("heading", { name: "Northern Light" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(importTitle).toHaveBeenCalledWith(result);
    const libraryLink = await screen.findByRole("link", { name: "In library" });
    await user.click(libraryLink);

    expect(
      await screen.findByRole("heading", { name: "Northern Light" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Library state" })).toHaveValue(
      "planned",
    );
  });
});
