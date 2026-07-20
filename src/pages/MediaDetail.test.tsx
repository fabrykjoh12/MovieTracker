import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { MediaDetail } from "./MediaDetail";

vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch: vi.fn() }),
}));

const renderMediaDetail = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/title/${id}`]}>
      <Routes>
        <Route path="/title/:id" element={<MediaDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("MediaDetail", () => {
  it("renders the title", () => {
    renderMediaDetail("severance");
    expect(
      screen.getByRole("heading", { name: "Severance", level: 1 }),
    ).toBeInTheDocument();
  });

  it("honestly disables the not-yet-built note and reaction controls", () => {
    renderMediaDetail("severance");
    expect(screen.getByRole("button", { name: "Edit note" })).toBeDisabled();
    const reactionButtons = screen.getAllByRole("button", {
      name: /Reaction/,
    });
    expect(reactionButtons.length).toBeGreaterThan(0);
    for (const button of reactionButtons) {
      expect(button).toBeDisabled();
    }
  });
});
