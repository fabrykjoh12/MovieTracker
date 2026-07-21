import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Media } from "../types";
import type { MediaSearchResult } from "../catalog/search";

const dispatch = vi.fn();
const registerCatalogItem = vi.fn().mockResolvedValue(undefined);
const search = vi.fn();
const importTitle = vi.fn();
const getJWTToken = vi.fn();

let authStatus: "loading" | "authenticated" | "anonymous" | "demo" = "demo";

vi.mock("../store", () => ({
  useStore: () => ({ dispatch, catalog: [] as Media[], registerCatalogItem }),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ status: authStatus }),
}));

vi.mock("../catalog/search", () => ({
  isCatalogSearchConfigured: true,
  getCatalogSearchClient: () => ({ search, importTitle }),
}));

vi.mock("../lib/neon", () => ({
  getNeonClient: () => Promise.resolve({ auth: { getJWTToken } } as unknown),
}));

const { useCatalogSearch } = await import("./useCatalogSearch");

const result: MediaSearchResult = {
  provider: "tmdb",
  providerId: 42,
  mediaType: "movie",
  format: "movie",
  title: "Northern Light",
  synopsis: "A patient journey north.",
};

const media: Media = {
  id: "tmdb-movie-42",
  title: "Northern Light",
  year: 2026,
  format: "movie",
  poster: "poster",
  backdrop: "backdrop",
  accent: "#7e8061",
  runtime: 108,
  genres: ["Drama"],
  moods: ["Drama"],
  pace: "balanced",
  intensity: "balanced",
  adventurous: 5,
  synopsis: "A patient journey north.",
  creators: [],
  cast: [],
  services: [],
  country: "Norway",
  language: "Norwegian",
  provider: { name: "tmdb", id: 42, mediaType: "movie" },
};

describe("useCatalogSearch addToLibrary", () => {
  beforeEach(() => {
    dispatch.mockReset();
    registerCatalogItem.mockReset().mockResolvedValue(undefined);
    search.mockReset();
    importTitle.mockReset();
    getJWTToken.mockReset();
  });

  it("blocks importing a new title while signed out, without calling the catalog", async () => {
    authStatus = "demo";
    const { result: hook } = renderHook(() => useCatalogSearch());

    let outcome: Media | null = null;
    await act(async () => {
      outcome = await hook.current.addToLibrary(result);
    });

    expect(outcome).toBeNull();
    expect(importTitle).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(hook.current.searchMessage).toBe(
      "Sign in to add new titles from search to your library.",
    );
  });

  it("imports a new title with the caller's fresh access token once authenticated", async () => {
    authStatus = "authenticated";
    getJWTToken.mockResolvedValue("fresh-jwt");
    importTitle.mockResolvedValue(media);
    const { result: hook } = renderHook(() => useCatalogSearch());

    let outcome: Media | null = null;
    await act(async () => {
      outcome = await hook.current.addToLibrary(result);
    });

    expect(outcome).toEqual(media);
    expect(getJWTToken).toHaveBeenCalledWith(false);
    expect(importTitle).toHaveBeenCalledWith(result, "fresh-jwt");
    expect(registerCatalogItem).toHaveBeenCalledWith(media);
    expect(dispatch).toHaveBeenCalledWith({ type: "add", mediaId: media.id });
    await waitFor(() =>
      expect(hook.current.searchMessage).toBe(
        "Northern Light was added to your library.",
      ),
    );
  });
});
