import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Shell } from "./Shell";
import type { AppState, WatchEvent } from "../types";

let mockState: AppState = initialState;

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ status: "demo", user: null }),
}));

vi.mock("../store", () => ({
  useStore: () => ({
    state: mockState,
    catalog: media,
    dispatch: vi.fn(),
    registerCatalogItem: vi.fn(),
    librarySync: { status: "browser" },
    retryCloudSync: vi.fn(),
  }),
}));

vi.mock("../catalog/search", () => ({
  isCatalogSearchConfigured: false,
  getCatalogSearchClient: () => null,
}));

vi.mock("../lib/neon", () => ({
  getNeonClient: () => Promise.resolve(null),
  isNeonConfigured: false,
}));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<div>Page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Shell weekly watch stat", () => {
  it("shows an honest zero for a brand-new account with no watch events", () => {
    mockState = { ...initialState, events: [] };
    renderShell();

    expect(screen.getByText("0m")).toBeInTheDocument();
    expect(screen.getByLabelText("0m watched this week")).toBeInTheDocument();
  });

  it("computes real minutes watched from real events, not a fixed number", () => {
    const duneTwo = media.find((item) => item.id === "dune-part-two")!;
    const today = new Date().toISOString();
    const events: WatchEvent[] = [
      { id: "e1", mediaId: duneTwo.id, type: "movie", watchedAt: today },
    ];
    mockState = { ...initialState, events };
    renderShell();

    const hours = Math.floor(duneTwo.runtime / 60);
    const minutes = duneTwo.runtime % 60;
    const expected = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText("4h 32m")).not.toBeInTheDocument();
  });
});
