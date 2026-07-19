import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SectionHeader } from "./SectionHeader";

const wrap = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("SectionHeader", () => {
  it("renders the title as a heading and the label when given", () => {
    wrap(<SectionHeader label="Three, not thirty" title="Tonight's picks" />);
    expect(
      screen.getByRole("heading", { name: "Tonight's picks" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Three, not thirty")).toBeInTheDocument();
  });

  it("omits the label when not provided", () => {
    wrap(<SectionHeader title="Worth knowing" />);
    expect(screen.queryByText("Three, not thirty")).toBeNull();
  });

  it("renders a link action when `to` is set", () => {
    wrap(
      <SectionHeader
        title="X"
        action={{ text: "Open calendar", to: "/library" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Open calendar" })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("renders a button action that fires onClick", () => {
    const onClick = vi.fn();
    wrap(
      <SectionHeader title="X" action={{ text: "Tune tonight", onClick }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tune tonight" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
