# Account Data Export and Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every user a self-describing JSON export of their library data and a data-only "delete all my data" control, working in both demo and signed-in modes.

**Architecture:** Export is a pure function over the in-memory `AppState` plus the catalog (no new read path). Deletion is one explicit Neon repository method for cloud accounts and a durable empty-state write for demo, both orchestrated by two new store actions surfaced in a "Your data" section on the Account page.

**Tech Stack:** React 19, TypeScript 6 (strict), Vitest + Testing Library + jsdom, Neon Data API via `@neondatabase/neon-js`.

## Global Constraints

- Verdicts live inside `UserMediaState.verdict`; there is no separate in-memory verdict store.
- Owner columns: `user_media_states`, `verdicts`, `watch_events`, `pairwise_comparisons` use `user_id`; `shelves` uses `owner_id`; `profiles` uses `id`.
- The first-sync marker is `profiles.library_initialized_at` (null = uninitialized/setup).
- `AppState.version` is `1`. An empty state must still contain valid `filters` and `room` objects or `isCompatibleState` rejects it on reload.
- Do not delete the `profiles` identity row; only null its `library_initialized_at`.
- Export excludes `filters` and `room` (out of scope, per spec).
- Never expose `DATABASE_URL` / `TMDB_READ_ACCESS_TOKEN`; this slice touches only the browser Data API and local storage.
- Preserve the premium editorial Account styling; semantic HTML, keyboard operable, visible focus, AA contrast.
- Single-file test run: `npx vitest run <path>`. Full suite: `npm test`.

**Deviation from spec (intentional, resolved during planning):** the spec placed `deleteAllData` on `LibraryRepository` "both impls." In this codebase demo persistence is `LocalStateRepository` (`load`/`save`/`clear`), not a `LibraryRepository`. So `deleteAllData` lands on the Neon `LibrarySyncRepository`, and the demo path is a durable empty-state write via `localStateRepository.save(...)` inside the store action. This preserves the design intent (explicit per-mode deletion) while matching the real seam. Demo deletion writes an empty state (not `clear()`) so it does not reseed the demo catalog on reload.

---

### Task 1: Pure export builder

**Files:**
- Create: `src/lib/accountExport.ts`
- Test: `src/lib/accountExport.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Media`, `Shelf`, `Verdict`, `EpisodeProgress`, `LibraryStatus`, `MediaFormat`, `UserMediaState`, `WatchEvent` from `../types`.
- Produces:
  - `type AccountExportHeader = { mode: "cloud" | "demo"; identity: { email: string; handle?: string } | null }`
  - `interface AccountExportV1` (see code)
  - `function buildAccountExport(state: AppState, catalog: Media[], account: AccountExportHeader, exportedAt: string): AccountExportV1`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/accountExport.test.ts
import { describe, expect, it } from "vitest";
import type { AppState, Media } from "../types";
import { buildAccountExport } from "./accountExport";

const media: Media[] = [
  {
    id: "severance",
    title: "Severance",
    year: 2022,
    format: "series",
    poster: "",
    backdrop: "",
    accent: "#000",
    runtime: 52,
    genres: [],
    moods: [],
    pace: "measured",
    intensity: "balanced",
    adventurous: 0,
    synopsis: "",
    creators: [],
    cast: [],
    services: [],
  },
];

const state: AppState = {
  version: 1,
  userMedia: {
    severance: {
      mediaId: "severance",
      status: "up-next",
      progress: { season: 2, episode: 3 },
      watchedDates: ["2026-07-01T00:00:00.000Z"],
      verdict: {
        kind: "loved",
        normalized: 4,
        qualities: ["Story"],
        tags: ["eerie"],
        recordedAt: "2026-07-02T00:00:00.000Z",
      },
      savedAt: "2026-06-01T00:00:00.000Z",
    },
    ghostwritten: {
      mediaId: "ghostwritten",
      status: "planned",
      watchedDates: [],
      savedAt: "2026-06-02T00:00:00.000Z",
    },
  },
  events: [
    {
      id: "e1",
      mediaId: "severance",
      type: "episode",
      season: 2,
      episode: 3,
      watchedAt: "2026-07-01T00:00:00.000Z",
    },
  ],
  shelves: [
    {
      id: "s1",
      title: "Weekend",
      description: "",
      mediaIds: ["severance"],
      featuredId: "severance",
      visibility: "private",
      atmosphere: "#111",
    },
  ],
  queue: ["severance"],
  filters: {} as AppState["filters"],
  room: {} as AppState["room"],
};

describe("buildAccountExport", () => {
  it("produces a versioned, self-describing document", () => {
    const doc = buildAccountExport(
      state,
      media,
      { mode: "cloud", identity: { email: "a@b.c" } },
      "2026-07-18T00:00:00.000Z",
    );

    expect(doc.format).toBe("movietracker.account-export");
    expect(doc.version).toBe(1);
    expect(doc.exportedAt).toBe("2026-07-18T00:00:00.000Z");
    expect(doc.account).toEqual({ mode: "cloud", identity: { email: "a@b.c" } });

    const severance = doc.library.find((e) => e.mediaId === "severance")!;
    expect(severance.title).toBe("Severance");
    expect(severance.year).toBe(2022);
    expect(severance.type).toBe("series");
    expect(severance.queuePosition).toBe(0);
    expect(severance.verdict?.kind).toBe("loved");

    const planned = doc.library.find((e) => e.mediaId === "ghostwritten")!;
    expect(planned.queuePosition).toBeNull();
    expect(planned.verdict).toBeNull();
  });

  it("omits titles for media missing from the catalog", () => {
    const doc = buildAccountExport(
      state,
      [],
      { mode: "demo", identity: null },
      "2026-07-18T00:00:00.000Z",
    );
    const severance = doc.library.find((e) => e.mediaId === "severance")!;
    expect(severance.title).toBeUndefined();
    expect(severance.year).toBeUndefined();
    expect(severance.type).toBeUndefined();
    expect(doc.watchEvents[0].title).toBeUndefined();
    expect(doc.account).toEqual({ mode: "demo", identity: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/accountExport.test.ts`
Expected: FAIL — `buildAccountExport` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/accountExport.ts
import type {
  AppState,
  EpisodeProgress,
  LibraryStatus,
  Media,
  MediaFormat,
  Shelf,
  UserMediaState,
  Verdict,
  WatchEvent,
} from "../types";

export interface AccountExportIdentity {
  email: string;
  handle?: string;
}

export interface AccountExportHeader {
  mode: "cloud" | "demo";
  identity: AccountExportIdentity | null;
}

export interface AccountExportLibraryEntry {
  mediaId: string;
  title?: string;
  year?: number;
  type?: MediaFormat;
  status: LibraryStatus;
  progress?: EpisodeProgress;
  watchedDates: string[];
  verdict: Verdict | null;
  queuePosition: number | null;
  intent?: UserMediaState["intent"];
}

export interface AccountExportEvent {
  id: string;
  mediaId: string;
  title?: string;
  type: WatchEvent["type"];
  watchedAt: string;
  season?: number;
  episode?: number;
}

export interface AccountExportV1 {
  format: "movietracker.account-export";
  version: 1;
  exportedAt: string;
  account: AccountExportHeader;
  library: AccountExportLibraryEntry[];
  shelves: Shelf[];
  watchEvents: AccountExportEvent[];
}

export function buildAccountExport(
  state: AppState,
  catalog: Media[],
  account: AccountExportHeader,
  exportedAt: string,
): AccountExportV1 {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const titleFields = (mediaId: string) => {
    const item = byId.get(mediaId);
    return item
      ? { title: item.title, year: item.year, type: item.format }
      : {};
  };

  const library = Object.values(state.userMedia).map((entry) => {
    const index = state.queue.indexOf(entry.mediaId);
    return {
      mediaId: entry.mediaId,
      ...titleFields(entry.mediaId),
      status: entry.status,
      ...(entry.progress ? { progress: entry.progress } : {}),
      watchedDates: entry.watchedDates,
      verdict: entry.verdict ?? null,
      queuePosition: index < 0 ? null : index,
      ...(entry.intent ? { intent: entry.intent } : {}),
    };
  });

  const watchEvents = state.events.map((event) => ({
    id: event.id,
    mediaId: event.mediaId,
    ...titleFields(event.mediaId),
    type: event.type,
    watchedAt: event.watchedAt,
    ...(event.season === undefined ? {} : { season: event.season }),
    ...(event.episode === undefined ? {} : { episode: event.episode }),
  }));

  return {
    format: "movietracker.account-export",
    version: 1,
    exportedAt,
    account,
    library,
    shelves: state.shelves.map((shelf) => ({ ...shelf })),
    watchEvents,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/accountExport.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/accountExport.ts src/lib/accountExport.test.ts
git commit -m "feat: add pure account export builder"
```

---

### Task 2: Neon `deleteAllData`

**Files:**
- Modify: `src/repositories/contracts.ts` (add method to `LibrarySyncRepository`)
- Modify: `src/repositories/neonLibraryRepository.ts` (implement in the `repository` object, and extend the fake in the test)
- Test: `src/repositories/neonLibraryRepository.test.ts`

**Interfaces:**
- Consumes: the existing `client` and `userId` closure, `resultError`, `stateVersions`, `verdictVersions` from `neonLibraryRepository.ts`.
- Produces: `deleteAllData(): Promise<void>` on `LibrarySyncRepository`.

- [ ] **Step 1: Extend the interface**

In `src/repositories/contracts.ts`, add the method to `LibrarySyncRepository`:

```ts
export interface LibrarySyncRepository extends LibraryRepository {
  load(): Promise<CloudLibrarySnapshot>;
  import(snapshot: LibrarySnapshot): Promise<CloudLibrarySnapshot>;
  persistChanges(previous: AppState, next: AppState): Promise<void>;
  refreshCatalog(): Promise<Media[]>;
  deleteAllData(): Promise<void>;
}
```

- [ ] **Step 2: Write the failing test**

First, extend the fake in `src/repositories/neonLibraryRepository.test.ts` so deletes are recorded and the profiles-update payload is read (this keeps the existing import test green because import updates the marker to a non-null timestamp):

```ts
// In class FakeQuery: capture the update payload
  private updatePayload: Record<string, unknown> | null = null;

  update(values?: Record<string, unknown>) {
    this.action = "update";
    this.updatePayload = values ?? null;
    return this;
  }
```

Replace the profiles branch and add a delete branch inside `FakeQuery.execute`:

```ts
    if (this.action === "delete") {
      this.database.deletedTables.push(this.table);
      return { data: single ? null : null, error: null };
    }
    if (this.action === "update" && this.table === "profiles") {
      this.database.profileInitialized =
        this.updatePayload?.library_initialized_at != null;
      return { data: single ? {} : null, error: null };
    }
```

Add the tracking array to `FakeDatabase`:

```ts
  deletedTables: string[] = [];
```

Then add the test:

```ts
  it("deletes only owned rows and clears the sync marker", async () => {
    const database = new FakeDatabase();
    database.profileInitialized = true;
    const repository = createNeonLibraryRepository(
      database.client as never,
      "user-1",
    );

    await repository.deleteAllData();

    expect(database.deletedTables).toEqual([
      "watch_events",
      "verdicts",
      "pairwise_comparisons",
      "user_media_states",
      "shelves",
    ]);
    expect(database.profileInitialized).toBe(false);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/repositories/neonLibraryRepository.test.ts`
Expected: FAIL — `repository.deleteAllData is not a function`.

- [ ] **Step 4: Implement `deleteAllData`**

In `src/repositories/neonLibraryRepository.ts`, add this method to the `repository` object (place it after `import`, before the closing of the object):

```ts
    async deleteAllData() {
      const ownedByUser = [
        "watch_events",
        "verdicts",
        "pairwise_comparisons",
        "user_media_states",
      ] as const;
      for (const table of ownedByUser) {
        const result = await client.from(table).delete().eq("user_id", userId);
        if (result.error) {
          throw resultError(result.error, `Deleting ${table}`);
        }
      }
      const shelves = await client
        .from("shelves")
        .delete()
        .eq("owner_id", userId);
      if (shelves.error) {
        throw resultError(shelves.error, "Deleting shelves");
      }
      const profile = await client
        .from("profiles")
        .update({ library_initialized_at: null })
        .eq("id", userId);
      if (profile.error) {
        throw resultError(profile.error, "Resetting the library sync marker");
      }
      stateVersions.clear();
      verdictVersions.clear();
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/repositories/neonLibraryRepository.test.ts`
Expected: PASS (3 tests — the two existing plus the new one).

- [ ] **Step 6: Commit**

```bash
git add src/repositories/contracts.ts src/repositories/neonLibraryRepository.ts src/repositories/neonLibraryRepository.test.ts
git commit -m "feat: delete owned cloud rows and clear sync marker"
```

---

### Task 3: Empty-state helper

**Files:**
- Modify: `src/data.ts` (add `emptyLibraryState`)
- Test: `src/data.test.ts` (create if absent)

**Interfaces:**
- Consumes: `initialState` and `AppState` (already in `src/data.ts` / `../types`).
- Produces: `function emptyLibraryState(base?: AppState): AppState`.

- [ ] **Step 1: Write the failing test**

```ts
// src/data.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data.test.ts`
Expected: FAIL — `emptyLibraryState` is not exported.

- [ ] **Step 3: Implement the helper**

Add to `src/data.ts` (below the `initialState` export):

```ts
export function emptyLibraryState(base: AppState = initialState): AppState {
  return { ...base, userMedia: {}, events: [], shelves: [], queue: [] };
}
```

If `AppState` is not already imported in `src/data.ts`, add it to the existing type import from `./types`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/data.test.ts
git commit -m "feat: add empty library state helper"
```

---

### Task 4: Store actions + "Your data" Account UI

**Files:**
- Modify: `src/store.tsx` (add `downloadExport`, `deleteAllData` actions; extend `StoreValue`)
- Modify: `src/pages/Account.tsx` (add the "Your data" section)
- Test: `src/pages/Account.test.tsx` (add interaction tests)

**Interfaces:**
- Consumes: `buildAccountExport`, `AccountExportHeader` (Task 1); `emptyLibraryState` (Task 3); Neon `deleteAllData` (Task 2); existing store refs (`stateRef`, `catalogRef`, `cloudRepositoryRef`, `syncStatusRef`, `mutationChainRef`, `mutationVersionRef`, `replaceState`, `setLibrarySync`, `loadCloudLibrary`), `useAuth().user`.
- Produces on `StoreValue`: `downloadExport: () => void` and `deleteAllData: () => Promise<void>`.

- [ ] **Step 1: Write the failing interaction test**

```tsx
// Add to src/pages/Account.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
// (reuse the file's existing render helpers/providers; the snippet below assumes
// a `renderAccount()` helper like the other tests in this file. If none exists,
// mirror the existing test's provider setup.)

it("exports account data as a downloaded JSON file", () => {
  const createObjectURL = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:mock");
  const revokeObjectURL = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);

  renderAccount();

  fireEvent.click(screen.getByRole("button", { name: /export my data/i }));

  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(clickSpy).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

  createObjectURL.mockRestore();
  revokeObjectURL.mockRestore();
  clickSpy.mockRestore();
});

it("requires typing DELETE before wiping data", async () => {
  renderAccount();

  const deleteButton = screen.getByRole("button", {
    name: /delete all my data/i,
  });
  expect(deleteButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
    target: { value: "DELETE" },
  });
  expect(deleteButton).toBeEnabled();

  fireEvent.click(deleteButton);

  await waitFor(() =>
    expect(screen.getByText(/your library is empty/i)).toBeInTheDocument(),
  );
});
```

Note: `renderAccount()` should render the Account page inside `AuthProvider` + `StoreProvider` in demo mode (no Neon env), matching the existing tests in this file. In demo mode `deleteAllData` takes the local branch and empties state synchronously via the store.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Account.test.tsx`
Expected: FAIL — no "Export my data" / "Delete all my data" controls exist.

- [ ] **Step 3: Add the store actions**

In `src/store.tsx`:

1. Add imports:

```ts
import { initialState, emptyLibraryState, media as fallbackCatalog } from "./data";
import { buildAccountExport } from "./lib/accountExport";
import type { AccountExportHeader } from "./lib/accountExport";
import { createLocalStateRepository } from "./repositories/localStateRepository";
```

(Merge the `emptyLibraryState` name into the existing `./data` import; `createLocalStateRepository` is already imported — `localStateRepository` is the module-level instance.)

2. Extend `StoreValue`:

```ts
interface StoreValue {
  state: AppState;
  catalog: Media[];
  dispatch: Dispatch<Action>;
  librarySync: LibrarySyncState;
  startCloudSync: () => Promise<void>;
  retryCloudSync: () => Promise<void>;
  registerCatalogItem: (item: Media) => Promise<void>;
  downloadExport: () => void;
  deleteAllData: () => Promise<void>;
}
```

3. Inside `StoreProvider`, pull `user` from `useAuth` (currently only `status`/`user` used for `userId` — `user` is already destructured; confirm it is available), then add the two callbacks before the `value` memo:

```ts
  const downloadExport = useCallback(() => {
    const account: AccountExportHeader = userId
      ? { mode: "cloud", identity: { email: user?.email ?? "" } }
      : { mode: "demo", identity: null };
    const doc = buildAccountExport(
      stateRef.current,
      catalogRef.current,
      account,
      new Date().toISOString(),
    );
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `movietracker-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [user, userId]);

  const deleteAllData = useCallback(async () => {
    const empty = emptyLibraryState(initialState);
    const repository = cloudRepositoryRef.current;
    const cloudActive =
      repository &&
      (syncStatusRef.current === "synced" ||
        syncStatusRef.current === "saving");

    if (repository && cloudActive) {
      setLibrarySync({ status: "saving" });
      // Invalidate any in-flight mutation so its completion cannot flip status.
      mutationVersionRef.current += 1;
      try {
        await mutationChainRef.current.catch(() => undefined);
        await repository.deleteAllData();
        replaceState(empty);
        setLibrarySync({ status: "needs-import" });
      } catch (error) {
        setLibrarySync({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Your data could not be deleted.",
        });
        try {
          await loadCloudLibrary(repository);
        } catch {
          // Keep the error state if the reload also fails.
        }
      }
      return;
    }

    // Demo / signed-out: durable empty write so reload does not reseed demo data.
    localStateRepository.save(empty);
    replaceState(empty);
  }, [loadCloudLibrary, replaceState, setLibrarySync, user, userId]);
```

4. Add both to the `value` memo object and its dependency array:

```ts
  const value = useMemo(
    () => ({
      state,
      catalog,
      dispatch,
      librarySync,
      startCloudSync,
      retryCloudSync,
      registerCatalogItem,
      downloadExport,
      deleteAllData,
    }),
    [
      catalog,
      deleteAllData,
      dispatch,
      downloadExport,
      librarySync,
      registerCatalogItem,
      retryCloudSync,
      startCloudSync,
      state,
    ],
  );
```

- [ ] **Step 4: Add the Account "Your data" section**

In `src/pages/Account.tsx`:

1. Extend the store destructure:

```ts
  const { state, librarySync, startCloudSync, retryCloudSync, downloadExport, deleteAllData } =
    useStore();
```

2. Add local UI state near the other `useState` hooks:

```ts
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const libraryCount = Object.keys(state.userMedia).length;
  const runDelete = async () => {
    setDeleting(true);
    try {
      await deleteAllData();
      setConfirmText("");
    } finally {
      setDeleting(false);
    }
  };
```

3. Add a new section inside the `account-shell` (after the existing `account-card`), following the existing class conventions:

```tsx
        <section className="account-card account-data-controls">
          <p className="eyebrow">YOUR DATA</p>
          <h2>Export or delete your library</h2>
          <p className="account-note">
            Download a personal backup of your library, or permanently delete
            your data from this device and account. Your sign-in is not removed.
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={downloadExport}
          >
            Export my data
          </button>

          <div className="account-danger-zone">
            <label htmlFor="account-delete-confirm" className="account-note">
              Type DELETE to confirm
            </label>
            <input
              id="account-delete-confirm"
              className="account-input"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="secondary-button danger"
              disabled={confirmText !== "DELETE" || deleting}
              onClick={() => void runDelete()}
            >
              Delete all my data
            </button>
            {libraryCount === 0 ? (
              <p className="account-message" role="status">
                Your library is empty.
              </p>
            ) : null}
          </div>
        </section>
```

(If `useState` is not already imported in `Account.tsx`, add it to the `react` import.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/Account.test.tsx`
Expected: PASS (existing password tests plus the two new interaction tests).

- [ ] **Step 6: Add minimal styling**

Append to `src/styles.css` (match existing token usage; keep restrained per guardrails):

```css
.account-data-controls .secondary-button {
  margin-top: 0.75rem;
}
.account-danger-zone {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.secondary-button.danger {
  border-color: color-mix(in srgb, var(--accent-danger, #b4413c) 60%, transparent);
  color: var(--accent-danger, #b4413c);
}
.secondary-button.danger:disabled {
  opacity: 0.5;
}
```

If `--accent-danger` is not defined, the fallback `#b4413c` applies; do not introduce new global tokens unless the file already defines a danger color.

- [ ] **Step 7: Commit**

```bash
git add src/store.tsx src/pages/Account.tsx src/pages/Account.test.tsx src/styles.css
git commit -m "feat: add account data export and deletion controls"
```

---

### Task 5: Validation baseline and docs

**Files:**
- Modify: `roadmap.md` (check off the export/deletion item)
- Modify: `CLAUDE.md` (update "Next vertical slice" status note)

- [ ] **Step 1: Run the full validation baseline**

Run each and confirm clean:

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
git diff --check
```

Expected: Prettier clean, ESLint clean, `tsc` no errors, all Vitest files green (including the new `accountExport`, `data`, `neonLibraryRepository`, and `Account` tests), Vite build succeeds, audit reports zero moderate+ vulnerabilities, no whitespace errors.

- [ ] **Step 2: Update the roadmap**

In `roadmap.md`, under **Phase 5**, change:

```md
- [ ] Add account export and deletion.
```

to:

```md
- [x] Add account export (self-describing JSON) and data-only deletion in both demo and cloud modes. Full Auth-identity erasure remains a server-side follow-up.
```

- [ ] **Step 3: Update CLAUDE.md**

In the "Next vertical slice" section of `CLAUDE.md`, mark export/deletion controls delivered and note the remaining follow-ups (Auth-identity erasure, import, profile/shelf persistence). Keep it to one or two lines; do not claim the product is complete.

- [ ] **Step 4: Commit**

```bash
git add roadmap.md CLAUDE.md
git commit -m "docs: record account export and deletion slice"
```

- [ ] **Step 5: Push**

```bash
git push -u origin claude/what-to-do-next-im3zen
```

---

## Self-Review

**Spec coverage:**
- Export format `AccountExportV1` (self-describing, versioned, ID-referenced) → Task 1. ✓
- Export flow (pure builder + Blob download, both modes) → Task 1 + Task 4 (`downloadExport`). ✓
- Delete flow cloud (FK-safe owned-row deletes + marker reset) → Task 2. ✓
- Delete flow demo (durable empty write) → Task 3 + Task 4 (`deleteAllData` local branch). ✓
- Store reset to empty + cloud returns to `needs-import` → Task 4. ✓
- Typed `DELETE` confirmation → Task 4. ✓
- "Your data" Account UI, both modes, accessible → Task 4. ✓
- Error handling: export non-destructive; delete surfaces error + cloud reload → Task 4. ✓
- Tests: unit builder, repository delete, interaction → Tasks 1, 2, 4. ✓
- Out-of-scope items (Auth erasure, import, profile export, filters/room) — not implemented, recorded as follow-ups. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code and exact commands. ✓

**Type consistency:** `buildAccountExport(state, catalog, account, exportedAt)`, `AccountExportHeader { mode, identity }`, `deleteAllData(): Promise<void>`, `emptyLibraryState(base?)` are used with identical signatures across Tasks 1–4. Delete order string array matches the test's `deletedTables` expectation exactly. ✓

**Note on live acceptance:** the spec's optional live-harness extension (prove a real account wipes only its own rows) is not scripted here because it requires the disposable Neon harness and real credentials; add it as a follow-up in `scripts/*acceptance*` when running against production. Flagged rather than silently dropped.
