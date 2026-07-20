import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Discover } from "./Discover";

const dispatch = vi.fn();
vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch }),
}));

vi.mock("../hooks/useCatalogSearch", () => ({
  useCatalogSearch: () => ({
    configured: true,
    query: "",
    setQuery: vi.fn(),
    format: "any" as const,
    setFormat: vi.fn(),
    searchState: "idle" as const,
    results: [],
    searchMessage: "",
    busyKey: undefined,
    addToLibrary: vi.fn(),
  }),
  catalogResultKey: () => "key",
  catalogResultLocalId: () => "id",
}));

const renderDiscover = () =>
  render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>,
  );

describe("Discover redesign", () => {
  beforeEach(() => dispatch.mockClear());

  it("renders the title and quiet section headers", () => {
    renderDiscover();
    expect(
      screen.getByRole("heading", { name: "Discover", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Find a specific story" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Three considered matches" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Films that echo afterward" }),
    ).toBeInTheDocument();
  });

  it("dispatches when a recommendation card action is used (behavior preserved)", () => {
    renderDiscover();
    const actions = screen.getAllByRole("button", {
      name: /(add to library|log watched|next episode|watched) —/i,
    });
    expect(actions.length).toBeGreaterThan(0);
    fireEvent.click(actions[0]!);
    expect(dispatch).toHaveBeenCalled();
  });

  it("dispatches add when the featured title is saved", () => {
    renderDiscover();
    fireEvent.click(
      screen.getByRole("button", { name: /save for later|in your library/i }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "add",
      mediaId: "perfect-days",
    });
  });

  it("honestly disables the not-yet-built filters control", () => {
    renderDiscover();
    expect(screen.getByRole("button", { name: "All filters" })).toBeDisabled();
  });
});
