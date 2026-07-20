import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./lib/neon", () => ({
  getNeonClient: () => Promise.resolve(null),
  isNeonConfigured: false,
}));

describe("critical product flows", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "/";
  });

  it("adds an unsaved discovery, moves it to Up Next, and logs the watch", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("link", { name: "Discover" })[0]!);
    expect(
      screen.getByRole("heading", { name: "Discover" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Add to library — Decision to Leave",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Log watched — Decision to Leave" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Decision to Leave" }));
    expect(
      screen.getByRole("heading", { name: "Decision to Leave" }),
    ).toBeInTheDocument();

    const status = screen.getByRole("combobox", { name: "Library state" });
    await user.selectOptions(status, "up-next");
    expect(status).toHaveValue("up-next");

    await user.click(screen.getByRole("button", { name: /Log watched/i }));
    expect(screen.getByRole("button", { name: "Watched" })).toBeDisabled();
  });

  it("marks the next episode and can undo the action", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "Mark episode watched" }),
    );
    expect(screen.getByText("Season 2 · 4 of 10")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo last" }));
    expect(screen.getByText("Season 2 · 3 of 10")).toBeInTheDocument();
  });

  it("keeps reactions ahead of progress out of the rendered discussion", () => {
    window.location.hash = "/title/severance";
    render(<App />);

    expect(
      screen.getByText(
        "The restraint in this episode makes the final scene land even harder.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "I have a theory about what Cold Harbor really means.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Unlocks after episode 8")).toBeInTheDocument();
  });

  it("labels an unconfigured deployment as browser-only demo mode", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Account and data" }));

    expect(
      screen.getByRole("heading", {
        name: "Cloud accounts are ready to connect.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/library remains safely in this browser only/i),
    ).toBeInTheDocument();
    expect(screen.getByText("VITE_NEON_AUTH_URL")).toBeInTheDocument();
    expect(screen.getByText("VITE_NEON_DATA_API_URL")).toBeInTheDocument();
  });
});
