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

// The catalog import endpoint now requires an authenticated Neon Auth
// caller (see worker/src/auth.ts), so a signed-out/demo session can never
// complete a full search-to-import-to-detail-page round trip through
// `<App />` -- that would just be testing a 401. The authenticated happy
// path is covered instead at the two layers that actually exercise it:
// worker/src/index.test.ts ("allows a valid authenticated import end to
// end", real JWT verification) and src/hooks/useCatalogSearch.test.tsx
// ("imports a new title with the caller's fresh access token once
// authenticated", the client-side token-attachment wiring). This file only
// needs to prove the signed-out UI is honest about the block.
describe("Discover catalog search", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "/discover";
    search.mockReset();
    importTitle.mockReset();
  });

  it("blocks adding a new title while signed out instead of calling the catalog", async () => {
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
    search.mockResolvedValue({ results: [result], source: "tmdb" });
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

    expect(
      await screen.findByText(
        "Sign in to add new titles from search to your library.",
      ),
    ).toBeInTheDocument();
    expect(importTitle).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("link", { name: "In library" }),
    ).not.toBeInTheDocument();
  });
});
