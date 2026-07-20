import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Profile } from "./Profile";

vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch: vi.fn() }),
}));

const renderProfile = () =>
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );

describe("Profile", () => {
  it("renders the profile hero", () => {
    renderProfile();
    expect(
      screen.getByRole("heading", { name: "A home for stories that linger." }),
    ).toBeInTheDocument();
  });

  it("honestly disables every not-yet-built profile control", () => {
    renderProfile();
    expect(
      screen.getByRole("button", { name: "Share profile" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "See how taste DNA works" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Why we think this/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Open year in review/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit ranking" })).toBeDisabled();
  });
});
