import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MediaCard } from "./MediaCard";

const wrap = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("MediaCard", () => {
  it("renders title, meta and reason", () => {
    wrap(
      <MediaCard
        title="Past Lives"
        meta="2023 · 106 min · MUBI"
        reason="Tender, unhurried."
      />,
    );
    expect(screen.getByText("Past Lives")).toBeInTheDocument();
    expect(screen.getByText("2023 · 106 min · MUBI")).toBeInTheDocument();
    expect(screen.getByText("Tender, unhurried.")).toBeInTheDocument();
  });

  it("links the title when `to` is set", () => {
    wrap(<MediaCard title="Andor" to="/title/andor" />);
    expect(screen.getByRole("link", { name: "Andor" })).toHaveAttribute(
      "href",
      "/title/andor",
    );
  });

  it("renders a Poster placeholder when no poster src is given", () => {
    const { container } = wrap(<MediaCard title="X" />);
    expect(container.querySelector(".poster-empty")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders footer actions when provided", () => {
    wrap(
      <MediaCard
        title="X"
        footer={<button type="button">Log watched</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Log watched" }),
    ).toBeInTheDocument();
  });
});
