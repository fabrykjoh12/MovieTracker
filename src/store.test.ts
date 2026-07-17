import { describe, expect, it } from "vitest";
import { initialState } from "./data";
import { reducer } from "./store";

describe("store queue tracking", () => {
  it("removes a completed movie from the queue and restores its position on undo", () => {
    expect(initialState.queue).toContain("past-lives");

    const watched = reducer(initialState, {
      type: "mark-next",
      mediaId: "past-lives",
    });

    expect(watched.userMedia["past-lives"]?.status).toBe("completed");
    expect(watched.queue).not.toContain("past-lives");

    const restored = reducer(watched, { type: "undo" });
    expect(restored.userMedia["past-lives"]?.status).toBe("up-next");
    expect(restored.queue).toEqual(initialState.queue);
  });
});
