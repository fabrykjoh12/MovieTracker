import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Friends } from "./Friends";

const dispatch = vi.fn();
vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch }),
}));

const renderFriends = () =>
  render(
    <MemoryRouter>
      <Friends />
    </MemoryRouter>,
  );

describe("Friends", () => {
  beforeEach(() => dispatch.mockClear());

  it("renders the title and the watch-together room", () => {
    renderFriends();
    expect(
      screen.getByRole("heading", { name: "Friends", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: initialState.room.name }),
    ).toBeInTheDocument();
  });

  it("still dispatches a vote (real behavior preserved)", () => {
    renderFriends();
    fireEvent.click(screen.getAllByRole("button", { name: "yes" })[0]!);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "vote", vote: "yes" }),
    );
  });

  it("honestly disables every not-yet-built social control", () => {
    renderFriends();
    for (const name of [
      "Invite a friend",
      "Edit constraints",
      "Reveal matches",
      "Reveal anyway",
      "Compare taste maps",
    ]) {
      expect(
        screen.getByRole("button", { name: new RegExp(name) }),
      ).toBeDisabled();
    }
  });
});
