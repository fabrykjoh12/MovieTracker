import { describe, expect, it } from "vitest";
import { initialState } from "../data";
import { createLocalStateRepository } from "./localStateRepository";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("local state repository", () => {
  it("round-trips compatible application state", () => {
    const repository = createLocalStateRepository(memoryStorage());
    const changed = {
      ...initialState,
      queue: ["andor", "past-lives"],
    };

    repository.save(changed);

    expect(repository.load(initialState)).toEqual(changed);
  });

  it("falls back safely for corrupt or obsolete data", () => {
    const storage = memoryStorage();
    const repository = createLocalStateRepository(storage);
    storage.setItem("movietracker:v1", "not-json");
    expect(repository.load(initialState)).toBe(initialState);

    storage.setItem(
      "movietracker:v1",
      JSON.stringify({ ...initialState, version: initialState.version + 1 }),
    );
    expect(repository.load(initialState)).toBe(initialState);
  });
});
