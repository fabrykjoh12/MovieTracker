import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Library } from "./Library";
import type { AppState } from "../types";

const dispatch = vi.fn();
let mockState: AppState = initialState;
vi.mock("../store", () => ({
  useStore: () => ({ state: mockState, catalog: media, dispatch }),
}));

const renderLibrary = () =>
  render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  );

describe("Library redesign", () => {
  beforeEach(() => {
    dispatch.mockClear();
    mockState = initialState;
  });

  it("renders the title and shelves by default", () => {
    renderLibrary();
    expect(
      screen.getByRole("heading", { name: "Library", level: 1 }),
    ).toBeInTheDocument();
    // a shelf title from the seed data
    expect(
      screen.getByRole("heading", { name: "Weekend films" }),
    ).toBeInTheDocument();
  });

  it("switches to the Queue view and reordering still dispatches", () => {
    renderLibrary();
    fireEvent.click(screen.getByRole("tab", { name: "Queue" }));
    expect(
      screen.getByRole("heading", { name: "Your next four" }),
    ).toBeInTheDocument();
    const down = screen.getAllByRole("button", { name: /move .* down/i });
    expect(down.length).toBeGreaterThan(0);
    fireEvent.click(down[0]!);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "queue", direction: 1 }),
    );
  });

  it("switches to the Gallery view and a track action dispatches mark-next", () => {
    renderLibrary();
    fireEvent.click(screen.getByRole("tab", { name: "Gallery" }));
    const track = screen.getAllByRole("button", {
      name: /(next episode|log watched|watched) —/i,
    });
    expect(track.length).toBeGreaterThan(0);
    fireEvent.click(track[0]!);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mark-next" }),
    );
  });

  it("honestly disables the not-yet-built shelf and pick-for-me controls", () => {
    renderLibrary();
    expect(screen.getByRole("button", { name: "New shelf" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pick for me" })).toBeDisabled();
  });

  it("shows real library size instead of a fabricated health score", () => {
    renderLibrary();
    expect(
      screen.getByText(String(Object.keys(initialState.userMedia).length)),
    ).toBeInTheDocument();
    expect(screen.queryByText("82")).not.toBeInTheDocument();
    expect(screen.queryByText("Focused and useful")).not.toBeInTheDocument();
  });

  describe("Calendar view", () => {
    it("shows real dates and a real watched title, not a fixed date range", () => {
      const today = new Date();
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      mockState = {
        ...initialState,
        events: [
          {
            id: "e1",
            mediaId: "severance",
            type: "episode",
            season: 2,
            episode: 3,
            watchedAt: twoDaysAgo.toISOString(),
          },
        ],
      };
      renderLibrary();
      fireEvent.click(screen.getByRole("tab", { name: "Calendar" }));

      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByText("Watched")).toBeInTheDocument();
      expect(screen.queryByText("New episode")).not.toBeInTheDocument();
      expect(screen.queryByText("Friday film")).not.toBeInTheDocument();
    });

    it("shows nothing on a day with no real watch activity", () => {
      mockState = { ...initialState, events: [] };
      renderLibrary();
      fireEvent.click(screen.getByRole("tab", { name: "Calendar" }));
      expect(screen.queryByText("Watched")).not.toBeInTheDocument();
    });
  });

  describe("stale-titles clean-up", () => {
    it("hides the clean-up prompt when nothing is actually stale", () => {
      mockState = {
        ...initialState,
        userMedia: Object.fromEntries(
          Object.entries(initialState.userMedia).map(([id, entry]) => [
            id,
            { ...entry, status: "completed" as const },
          ]),
        ),
      };
      renderLibrary();
      expect(
        screen.queryByText(/have been waiting a while/),
      ).not.toBeInTheDocument();
    });

    it("shows the real stale count and archives the real stale titles, not fixed ones", () => {
      const longAgo = new Date(Date.now() - 200 * 86400000).toISOString();
      mockState = {
        ...initialState,
        userMedia: {
          "only-stale-title": {
            mediaId: "dark",
            status: "planned",
            watchedDates: [],
            savedAt: longAgo,
          },
        },
      };
      renderLibrary();
      expect(
        screen.getByText("1 title has been waiting a while."),
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Review forgotten saves" }),
      );
      expect(dispatch).toHaveBeenCalledWith({
        type: "status",
        mediaId: "dark",
        status: "archived",
      });
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ mediaId: "aftersun" }),
      );
    });
  });
});
