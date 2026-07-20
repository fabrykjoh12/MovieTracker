# Account Data Export and Deletion — Design

- Date: 2026-07-18
- Status: Approved (brainstorm), pending implementation plan
- Roadmap link: Phase 5 "Add account export and deletion"; gated as a prerequisite
  "before inviting more beta users."

## Goal

Give every MovieTracker user a trustworthy way to **export their personal data**
as a self-describing backup and to **delete their data**, working consistently in
both demo (signed-out) and signed-in (cloud) sessions. This unblocks the
invite-only friends beta by providing the minimum privacy/trust controls a real
tester expects.

## Scope

In scope:

- Unified JSON **export** of library personal state in both modes.
- **Data-only deletion** of the user's own rows in both modes.
- A "Your data" section on the Account page hosting both controls.

Explicitly out of scope (deliberate, to keep the slice tight):

- **Neon Auth identity deletion.** The browser cannot delete the Auth user; that
  requires a trusted server boundary. This slice is a data-only wipe: the login
  survives and the account returns to an empty/uninitialized state. Full account
  erasure is a documented follow-up.
- **Editable-profile export.** No `ProfileRepository` implementation exists yet,
  so profiles are not persisted. Export includes the signed-in identity
  (email/handle) as read-only header info only.
- **Import.** The export format is designed so a future import can consume it,
  but import itself is not built here.
- **Tonight `filters` and Watch Together `room` state.** Ephemeral prefs and
  unpersisted social/demo state; not "your data" worth backing up. Reserved for a
  possible `version: 2`.

## Decisions (from brainstorm)

1. Deletion depth: **data-only wipe**, browser-only. No Auth-user removal.
2. Mode coverage: **both** demo and signed-in, unified.
3. Export contents: **self-describing** — personal state denormalized with
   title/year/type, media still referenced by stable catalog ID.
4. Architecture: **hybrid** — export derived from in-memory `AppState` via a pure
   function; deletion via one explicit repository method per mode.

## Architecture

`AppState` is already the mode-agnostic representation of all personal library
data (library states with embedded Verdicts, qualities, tags, progress, watched
dates, intent; watch events; shelves; queue). Export reads only this plus the
in-memory catalog map, so no new read path is introduced. Deletion needs a real
bulk operation, so it is a new explicit repository method with a per-mode
implementation.

### Components

- `src/lib/accountExport.ts` — **new.** Pure function
  `buildAccountExport(state, catalog, account): AccountExportV1`. No I/O, no clock.
- `src/repositories/contracts.ts` — add `deleteAllData(): Promise<void>` to
  `LibraryRepository`.
- `src/repositories/localStateRepository.ts` — implement `deleteAllData` by
  clearing the app-state storage key(s).
- `src/repositories/neonLibraryRepository.ts` — implement `deleteAllData` by
  deleting owned rows through the Data API in FK-safe order, then clearing the
  first-sync marker.
- `src/store.tsx` — `downloadExport()` action (stamps `exportedAt`, serializes,
  triggers Blob download) and `deleteAllData()` action (runs the repo method in
  the serialized mutation queue, then resets to empty initial state).
- `src/pages/Account.tsx` — new "Your data" section with Export and Delete
  controls.

## Export format (`AccountExportV1`)

Single versioned, self-describing JSON document:

```jsonc
{
  "format": "movietracker.account-export",
  "version": 1,
  "exportedAt": "2026-07-18T00:00:00.000Z", // stamped by caller, not the pure fn
  "account": {
    "mode": "cloud",                          // "cloud" | "demo"
    "identity": { "email": "…", "handle": "…" } // cloud only; null in demo
  },
  "library": [
    {
      "mediaId": "col-…",
      "title": "Columbus", "year": 2017, "type": "movie", // denormalized
      "status": "watching",
      "progress": { /* EpisodeProgress */ },
      "watchedDates": ["…"],
      "verdict": {
        "kind": "…", "normalized": 4,
        "qualities": ["Story"], "tags": ["slow-burn"], "rank": 2
      },
      "queuePosition": 3,
      "intent": { /* reason, recommendedBy, mood, priority, note … */ }
    }
  ],
  "shelves": [
    {
      "id": "…", "title": "…", "description": "…",
      "mediaIds": ["…"], "featuredId": "…",
      "visibility": "private", "atmosphere": "…"
    }
  ],
  "watchEvents": [
    {
      "id": "…", "mediaId": "…", "title": "…",
      "type": "episode", "watchedAt": "…", "season": 1, "episode": 3
    }
  ]
}
```

Rules:

- `version: 1` enables future migration.
- Every `library` and `watchEvents` entry is denormalized with title/year/type
  looked up from the in-memory catalog map; if a title is unavailable the field
  is omitted, never blocking the export.
- Media is still referenced by stable `mediaId` so import can rematch by ID with
  title as fallback.
- Optional fields (`verdict`, `progress`, `queuePosition`, `intent`, `identity`)
  are `null`/omitted when absent.

## Export flow

1. `buildAccountExport` produces the document purely from `AppState` + catalog +
   account header.
2. `downloadExport()` in the store/Account page stamps `exportedAt`, serializes
   with two-space indentation, wraps in a `Blob`, and downloads as
   `movietracker-export-YYYY-MM-DD.json` via a temporary object URL revoked after
   click.
3. Identical in both modes; the only per-mode difference is the `account` header.

## Delete flow

1. `deleteAllData()` on `LibraryRepository`:
   - **Local:** remove the app-state storage key(s). Synchronous, total.
   - **Neon:** delete owned rows through the Data API in FK-safe order —
     `watch_events` → `verdicts` → (`comparisons` if present) →
     `user_media_states` → `shelves` — each scoped by `user_id`/RLS; then set
     `profiles.library_initialized_at = null`. The `profiles` identity row is
     kept.
2. **Store reset:** on success replace state with the empty initial state. In
   cloud mode, clearing `library_initialized_at` returns the account to the
   existing uninitialized/setup path ("Copy library to Neon" reappears) — no
   special-casing.
3. **Confirmation:** the user types a confirmation token (`DELETE`) to enable the
   destructive button; no silent one-click wipe.

## UI

- New "Your data" section in `src/pages/Account.tsx`, visible in both demo and
  signed-in states.
  - **Export** button → immediate download; always enabled and non-destructive.
  - **Delete all my data** → typed-confirmation, then runs `deleteAllData()`,
    shows progress, then a success/empty state.
- Follows existing Account editorial styling (no new dashboard chrome). Semantic
  HTML, keyboard operable, visible focus, AA contrast, reduced-motion respectful.

## Error handling

- **Export** is in-memory → Blob and effectively cannot fail; if serialization
  ever throws, show a non-destructive inline error and leave state untouched.
- **Delete** runs inside the store's existing serialized mutation queue. On a
  partial Neon failure, surface a visible error and reload cloud state (mirrors
  current stale-write/rollback handling) so the UI reflects reality instead of a
  half-empty guess. The typed confirmation guards against accidents.

## Testing

- **Unit — `buildAccountExport`:** self-describing fields present, stable ID
  references, `version`, missing-title omission, both `mode` headers (cloud with
  identity, demo with `null`).
- **Unit/repository — `deleteAllData`:** local clears keys; Neon issues deletes
  in the specified order and resets the marker (against the existing mocked
  client).
- **Interaction — Account page:** export triggers a download; delete requires the
  typed token, then empties state and (cloud) returns to setup.
- **Live/acceptance:** extend the disposable RLS harness so a real account proves
  it can wipe only its own rows (no foreign deletes).

## Rollout / validation baseline

Before commit: Prettier, ESLint, TypeScript, Vitest (new tests green), Vite build,
`npm audit --audit-level=moderate`, `git diff --check`. Regenerate DB types only
if a schema change is introduced (none expected — this slice reuses existing
tables).

## Follow-ups (not this slice)

- Full account erasure including the Neon Auth identity via a trusted server
  boundary (extend the catalog Worker or a dedicated endpoint).
- Import that consumes `AccountExportV1`.
- Editable-profile persistence and its inclusion in export/delete.
