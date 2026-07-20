import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Poster } from "./Poster";

describe("Poster", () => {
  it("renders an image with its alt when a src is given", () => {
    const { container } = render(
      <Poster src="/p.jpg" alt="Severance poster" />,
    );
    const img = screen.getByRole("img", { name: "Severance poster" });
    expect(img).toHaveAttribute("src", "/p.jpg");
    // skeleton is present until the image load event fires
    expect(container.querySelector(".poster-skeleton")).toBeInTheDocument();
    fireEvent.load(img);
    expect(container.querySelector(".poster-skeleton")).not.toBeInTheDocument();
  });

  it("renders a placeholder (no <img>) when src is missing and never shows alt as text", () => {
    const { container } = render(<Poster alt="Andor poster" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".poster-empty")).toHaveAttribute(
      "aria-label",
      "Andor poster",
    );
    expect(screen.queryByText("Andor poster")).toBeNull();
  });

  it("applies the ratio class and renders a pill when given", () => {
    const { container } = render(
      <Poster src="/p.jpg" alt="x" ratio="16/9" pill="Up next" />,
    );
    expect(container.querySelector(".poster")).toHaveClass("poster-16x9");
    expect(screen.getByText("Up next")).toHaveClass("poster-pill");
  });
});
