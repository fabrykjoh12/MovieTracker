import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Library } from "./Library";

const dispatch = vi.fn();
vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch }),
}));

const renderLibrary = () =>
  render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  );

describe("Library redesign", () => {
  beforeEach(() => dispatch.mockClear());

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
});
