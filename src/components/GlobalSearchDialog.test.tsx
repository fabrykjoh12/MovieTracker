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

const result = {
  provider: "tmdb" as const,
  providerId: 1399,
  mediaType: "tv" as const,
  format: "series" as const,
  title: "Northern Kingdom",
  year: 2026,
  synopsis: "A family inherits a fragile northern realm.",
  poster: "https://image.tmdb.org/t/p/w500/kingdom.jpg",
};

const media = {
  id: "tmdb-tv-1399",
  title: result.title,
  year: result.year,
  format: result.format,
  poster: result.poster,
  backdrop: "https://image.tmdb.org/t/p/w1280/kingdom.jpg",
  accent: "#68715e",
  runtime: 55,
  genres: ["Drama"],
  moods: ["Tense"],
  pace: "balanced" as const,
  intensity: "demanding" as const,
  adventurous: 6,
  synopsis: result.synopsis,
  creators: ["Creator One"],
  cast: ["Actor One"],
  services: ["Max"],
  country: "Norway",
  language: "Norwegian",
  seasons: [{ season: 1, episodes: 8 }],
  provider: { name: "tmdb" as const, id: 1399, mediaType: "tv" as const },
};

describe("global catalog search", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "/";
    search.mockReset();
    importTitle.mockReset();
    search.mockResolvedValue({ results: [result], source: "tmdb" });
    importTitle.mockResolvedValue(media);
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value() {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value() {
        this.open = false;
      },
    });
  });

  it("searches from the header, saves a series, and opens its detail page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "Search MovieTracker" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Search the archive" }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", {
        name: "Search movies and series globally",
      }),
      result.title,
    );
    expect(
      await screen.findByRole("heading", { name: result.title }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: `Add ${result.title} to library`,
      }),
    );
    expect(importTitle).toHaveBeenCalledWith(result);
    expect(
      await screen.findByRole("button", {
        name: `${result.title} is in your library`,
      }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: `View ${result.title}` }),
    );
    expect(
      await screen.findByRole("heading", { name: result.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Library state" })).toHaveValue(
      "planned",
    );
  });

  it("opens with slash, focuses the query, and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("/");
    const input = screen.getByRole("searchbox", {
      name: "Search movies and series globally",
    });
    await waitFor(() => expect(input).toHaveFocus());
    expect(
      screen.getByRole("button", { name: "Perfect Days" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Search MovieTracker" }),
      ).toHaveAttribute("aria-expanded", "false"),
    );
  });
});
