import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Home } from "./Home";

const dispatch = vi.fn();
vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch }),
}));

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe("Home", () => {
  beforeEach(() => dispatch.mockClear());

  it("keeps the greeting and hero", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: "Good evening, Alex." }),
    ).toBeInTheDocument();
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
});
