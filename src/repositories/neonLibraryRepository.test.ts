/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import type { Tables } from "../lib/database.types";
import type { UserMediaState } from "../types";
import {
  createNeonLibraryRepository,
  LibraryConflictError,
} from "./neonLibraryRepository";

const mediaRow: Tables<"media"> = {
  id: "10000000-0000-4000-8000-000000000001",
  format: "series",
  tmdb_id: null,
  title: "Severance",
  original_title: null,
  release_year: 2022,
  runtime_minutes: 52,
  poster_path: null,
  backdrop_path: null,
  metadata: { localId: "severance" },
  metadata_expires_at: null,
  metadata_updated_at: null,
  created_at: "2026-07-17T00:00:00.000Z",
};

const stateRow: Tables<"user_media_states"> = {
  id: "20000000-0000-4000-8000-000000000001",
  user_id: "user-1",
  media_id: mediaRow.id,
  status: "watching",
  progress_season: 2,
  progress_episode: 3,
  intent: { watchDates: [] },
  saved_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-17T10:00:00.000Z",
};

class FakeQuery implements PromiseLike<any> {
  private action: "select" | "insert" | "update" | "delete" = "select";

  constructor(
    private readonly database: FakeDatabase,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  insert() {
    this.action = "insert";
    return this;
  }

  update() {
    this.action = "update";
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq() {
    return this;
  }

  is() {
    return this;
  }

  contains() {
    return this;
  }

  in() {
    return this;
  }

  order() {
    return this;
  }

  single() {
    return Promise.resolve(this.execute(true));
  }

  maybeSingle() {
    return Promise.resolve(this.execute(true));
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute(false)).then(onfulfilled, onrejected);
  }

  private execute(single: boolean) {
    if (this.action === "update" && this.table === "profiles") {
      this.database.profileInitialized = true;
      return { data: single ? {} : null, error: null };
    }
    if (
      this.action === "update" &&
      this.table === "user_media_states" &&
      this.database.conflictOnStateUpdate
    ) {
      return { data: null, error: null };
    }
    if (this.action !== "select") {
      return {
        data: single
          ? { id: "new-row", updated_at: "2026-07-17T11:00:00.000Z" }
          : null,
        error: null,
      };
    }

    const rows = this.database.rows(this.table);
    return { data: single ? (rows[0] ?? null) : rows, error: null };
  }
}

class FakeDatabase {
  profileInitialized = false;
  conflictOnStateUpdate = false;
  states: Tables<"user_media_states">[] = [];

  readonly client = {
    from: (table: string) => new FakeQuery(this, table),
  };

  rows(table: string): unknown[] {
    switch (table) {
      case "media":
        return [mediaRow];
      case "profiles":
        return [
          {
            library_initialized_at: this.profileInitialized
              ? "2026-07-17T11:00:00.000Z"
              : null,
          },
        ];
      case "user_media_states":
        return this.states;
      case "verdicts":
      case "watch_events":
        return [];
      default:
        throw new Error(`Unexpected fake table: ${table}`);
    }
  }
}

describe("Neon library repository", () => {
  it("marks first sync complete only after the import finishes", async () => {
    const database = new FakeDatabase();
    const repository = createNeonLibraryRepository(
      database.client as never,
      "user-1",
    );

    expect((await repository.load()).initialized).toBe(false);

    const imported = await repository.import({
      userMedia: {},
      events: [],
      queue: [],
    });

    expect(database.profileInitialized).toBe(true);
    expect(imported.initialized).toBe(true);
  });

  it("rejects a stale state update instead of overwriting another device", async () => {
    const database = new FakeDatabase();
    database.profileInitialized = true;
    database.states = [stateRow];
    const repository = createNeonLibraryRepository(
      database.client as never,
      "user-1",
    );
    await repository.load();
    database.conflictOnStateUpdate = true;
    const changed: UserMediaState = {
      mediaId: "severance",
      status: "up-next",
      progress: { season: 2, episode: 3 },
      watchedDates: [],
      savedAt: stateRow.saved_at,
    };

    await expect(repository.saveState(changed, 0)).rejects.toBeInstanceOf(
      LibraryConflictError,
    );
  });
});
