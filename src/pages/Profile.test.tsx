import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Profile } from "./Profile";

vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch: vi.fn() }),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "casey@example.com", name: "Casey" },
  }),
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
      screen.getByRole("button", { name: /Why we think this/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Open year in review/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit ranking" })).toBeDisabled();
  });

  it("shows the real signed-in user's name, not a fabricated identity", () => {
    renderProfile();
    expect(screen.getByText("Casey")).toBeInTheDocument();
    expect(screen.queryByText("ALEX KIM")).not.toBeInTheDocument();
    expect(screen.queryByText(/Oslo/)).not.toBeInTheDocument();
  });

  it("computes real profile stats from the account's own library, not fixed numbers", () => {
    renderProfile();
    expect(screen.queryByText("486")).not.toBeInTheDocument();
    expect(screen.queryByText("1,032h")).not.toBeInTheDocument();
    expect(screen.queryByText("18")).not.toBeInTheDocument();
  });

  it("shows the real top-ranked verdicted title as the personal canon leader", () => {
    renderProfile();
    // The fixture's "arrival" verdict is explicitly ranked #1.
    const heading = screen.getByRole("heading", { name: "Arrival" });
    expect(heading).toBeInTheDocument();
  });

  it("labels Taste DNA as not live instead of showing fabricated percentages", () => {
    renderProfile();
    expect(
      screen.getByRole("heading", { name: "Coming soon" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Patient stories. Human stakes."),
    ).not.toBeInTheDocument();
  });

  it("does not show the fabricated static taste cloud", () => {
    renderProfile();
    expect(screen.queryByText("Korean cinema")).not.toBeInTheDocument();
  });
});
