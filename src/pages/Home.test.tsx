import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Home } from "./Home";
import type { AppState } from "../types";

const dispatch = vi.fn();
let mockState: AppState = initialState;
vi.mock("../store", () => ({
  useStore: () => ({ state: mockState, catalog: media, dispatch }),
}));

let mockUser: { id: string; email: string; name: string } | null = null;
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe("Home", () => {
  beforeEach(() => {
    dispatch.mockClear();
    mockUser = null;
    mockState = initialState;
  });

  it("greets a signed-in user by their real name, not a fabricated one", () => {
    mockUser = { id: "u1", email: "casey@example.com", name: "Casey" };
    renderHome();
    expect(
      screen.getByRole("heading", {
        name: /^Good (morning|afternoon|evening), Casey\.$/,
      }),
    ).toBeInTheDocument();
  });

  it("shows an honest greeting with no name when there is no real identity to use", () => {
    mockUser = null;
    renderHome();
    expect(
      screen.getByRole("heading", {
        name: /^Good (morning|afternoon|evening)\.$/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Alex/)).not.toBeInTheDocument();
  });

  it("shows today's real date, not a fixed one", () => {
    renderHome();
    expect(screen.getByText(/^[A-Z]+, [A-Z]+ \d{1,2}$/)).toBeInTheDocument();
    expect(screen.queryByText("THURSDAY, JULY 16")).not.toBeInTheDocument();
  });

  it("keeps the hero", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: "Severance", level: 2 }),
    ).toBeInTheDocument();
  });

  it("still dispatches mark-next when the hero episode is logged", () => {
    renderHome();
    fireEvent.click(
      screen.getByRole("button", { name: /mark episode watched/i }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "mark-next",
      mediaId: "severance",
    });
  });

  it("renders a Tonight's picks action that dispatches (behavior preserved)", () => {
    renderHome();
    const actions = screen.getAllByRole("button", {
      name: /next episode|log watched|watched|add to library/i,
    });
    expect(actions.length).toBeGreaterThan(0);
    fireEvent.click(actions[0]!);
    expect(dispatch).toHaveBeenCalled();
  });

  it("honestly disables the not-yet-built reminder control", () => {
    renderHome();
    expect(
      screen.getByRole("button", { name: "Set reminder for Severance" }),
    ).toBeDisabled();
  });

  it("shows an honest empty state instead of a fabricated hero when nothing is in progress", () => {
    mockState = {
      ...initialState,
      userMedia: Object.fromEntries(
        Object.entries(initialState.userMedia).map(([id, entry]) => [
          id,
          { ...entry, status: "planned" as const },
        ]),
      ),
    };
    renderHome();
    expect(
      screen.getByRole("heading", { name: "Nothing in progress" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Severance", level: 2 }),
    ).not.toBeInTheDocument();
  });

  it("picks the most recently watched in-progress series as the hero, not a fixed one", () => {
    mockState = {
      ...initialState,
      userMedia: {
        ...initialState.userMedia,
        severance: {
          ...initialState.userMedia.severance!,
          watchedDates: ["2020-01-01T00:00:00.000Z"],
        },
        dark: {
          mediaId: "dark",
          status: "watching",
          progress: { season: 1, episode: 1 },
          watchedDates: ["2026-07-20T00:00:00.000Z"],
          savedAt: "2026-07-01T00:00:00.000Z",
        },
      },
    };
    renderHome();
    expect(
      screen.getByRole("heading", { name: "Dark", level: 2 }),
    ).toBeInTheDocument();
  });
});
