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
    ]) {
      expect(
        screen.getByRole("button", { name: new RegExp(name) }),
      ).toBeDisabled();
    }
  });

  it("does not show fabricated friends, activity, or compatibility data", () => {
    renderFriends();
    expect(screen.queryByText(/Sara/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Maya/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jonas/)).not.toBeInTheDocument();
    expect(screen.getByText("No friends yet")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Coming soon" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("1 participant")).toBeInTheDocument();
  });

  it("does not claim a mutual match computed from data that isn't real", () => {
    renderFriends();
    expect(screen.queryByText(/possible mutual/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Watch Together matching isn’t live yet."),
    ).toBeInTheDocument();
  });
});
