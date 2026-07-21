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

  // The catalog import endpoint now requires an authenticated Neon Auth
  // caller (see worker/src/auth.ts), so a signed-out/demo session can never
  // complete a search-to-import-to-detail-page round trip through
  // `<App />` -- that would just be testing a 401. The authenticated happy
  // path is covered at the layers that actually exercise it:
  // worker/src/index.test.ts (real JWT verification) and
  // src/hooks/useCatalogSearch.test.tsx (client-side token attachment).
  // This test only needs to prove the signed-out header search is honest
  // about the block.
  it("blocks adding a new title from the header search while signed out", async () => {
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

    expect(
      await screen.findByText(
        "Sign in to add new titles from search to your library.",
      ),
    ).toBeInTheDocument();
    expect(importTitle).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", {
        name: `${result.title} is in your library`,
      }),
    ).not.toBeInTheDocument();
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
