import { describe, expect, it } from "vitest";
import { emptyLibraryState, initialState } from "./data";

describe("emptyLibraryState", () => {
  it("clears personal data but keeps a valid, reloadable shell", () => {
    const empty = emptyLibraryState();
    expect(empty.userMedia).toEqual({});
    expect(empty.events).toEqual([]);
    expect(empty.shelves).toEqual([]);
    expect(empty.queue).toEqual([]);
    // filters/room are preserved so isCompatibleState accepts it on reload
    expect(empty.version).toBe(initialState.version);
    expect(empty.filters).toEqual(initialState.filters);
    expect(empty.room).toEqual(initialState.room);
  });

  it("does not mutate the source state", () => {
    const empty = emptyLibraryState();
    expect(Object.keys(initialState.userMedia).length).toBeGreaterThan(0);
    expect(empty).not.toBe(initialState);
  });
});
