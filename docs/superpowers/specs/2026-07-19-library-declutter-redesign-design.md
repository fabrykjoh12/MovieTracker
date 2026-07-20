# Library De-clutter Redesign — Design

- Date: 2026-07-19
- Status: Approved (brainstorm), implementing
- Predecessors: Home and Discover de-clutter redesigns (primitives shipped).

## Goal

Apply the calm, dense visual system to **Library**, reusing the shipped
`Poster` / `SectionHeader` / `MediaCard` primitives. Fix the oversized shelf
cards (gradient voids + overlapping poster clusters), calm the watchlist-health
band and the six-tab switcher, and quiet each view. Presentation-only; all six
views stay reachable and every interaction is preserved.

## Decisions (from brainstorm)

1. Keep all six view modes (Shelves, Gallery, Queue, Timeline, Calendar, Taste)
   — pure presentation re-treatment, no IA change. Reducing views is a separate
   later product call.
2. Identity preserved; behavior preserved; no store/data changes.

## Scope (`src/pages/Library.tsx` + scoped CSS)

Shell:

- Watchlist-health band → a slim, restrained strip (smaller score, keep the
  counts and the "Pick for me" action).
- View switcher → a quieter segmented control (all six tabs, clear active
  state, `role=tablist` preserved).
- "Gentle clean-up" stale-callout → quiet header (no giant serif); the
  "Review forgotten saves" archive action is unchanged.

Views:

- **Shelves:** redesign the shelf card into a compact card with a clean
  `Poster` strip (row of thumbnails, no overlap, skeleton-safe) + quiet
  title / visibility / description + count + "Open shelf" link. Replaces the
  ~300px gradient block with the corner poster cluster.
- **Gallery:** swap the `PosterCard` grid for a `MediaCard` grid; keep the
  status filter row and the mark-next (track) action via `MediaCard.footer`.
- **Queue:** calm the ordered list; `Poster` art; up/down **reordering
  behavior untouched** (same dispatches and aria-labels).
- **Timeline / Calendar / Taste:** quiet each header via `SectionHeader`, use
  `Poster` for artwork; Calendar keeps its structure (mostly demo data).

Out of scope: reducing/removing views, Library data persistence, global mobile
nav, `PosterCard` (still used elsewhere), any behavior/data change.

## Behavior to preserve

- View switching (six tabs), status filter, library search box.
- Queue reorder (`queue` dispatch, up/down, disabled ends) and its aria-labels.
- Gallery mark-next (track) dispatch.
- Stale-callout archive dispatch.
- All title links.

## Components

- Reuses `Poster`, `SectionHeader`, `MediaCard`.
- Gallery's card action (mark-next) uses the same `pickActionLabel` +
  original aria-label contract (`Track {title}`) as Discover, so any
  integration tests keep matching.

## Testing

- Reuse the primitives' unit tests.
- New `Library.redesign.test.tsx` (mock `../store`): the page renders; the
  view switcher changes views (e.g., click Queue → queue heading shows); a
  queue reorder button dispatches `queue`; a gallery card's track action
  dispatches `mark-next`.
- Visual proof: Playwright before/after at desktop + mobile.

## Guardrails

Editorial identity preserved; semantic HTML, `role=tablist`/`tab` retained,
visible focus, AA contrast, reduced-motion respected. Validation baseline green
before commit.

## Follow-ups

- Decide whether to reduce the view modes (Calendar/Taste) once real data backs
  them.
- Remove now-unused legacy CSS (Home/Discover/Library) in a later careful pass.
