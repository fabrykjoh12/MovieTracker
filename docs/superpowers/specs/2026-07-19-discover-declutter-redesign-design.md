# Discover De-clutter Redesign — Design

- Date: 2026-07-19
- Status: Approved (brainstorm), implementing
- Predecessor: Home de-clutter redesign (primitives shipped). This slice applies
  the same primitives to Discover.

## Goal

Extend the calm, dense visual system to **Discover**, reusing the shipped
`Poster` / `SectionHeader` / `MediaCard` primitives. Fix the oversized featured
hero and the floating-gap recommendation cards. Preserve the editorial identity
and every interaction. Presentation-only.

## Decisions (from brainstorm)

1. Sequence: Discover first; Library is a separate later slice.
2. Latitude: re-treatment + light consolidation (matches Home).
3. Identity preserved; behavior preserved; no store/data changes.

## Scope

In scope (`src/pages/Discover.tsx` + scoped CSS in `src/styles.css`):

1. Replace all three `.section-heading` triples with the quiet `SectionHeader`.
2. Catalog-search band: header becomes `SectionHeader`; the search input, format
   toggle, live results, and unavailable state are unchanged (behavior intact).
3. Featured hero ("This week's quiet find"): keep as the single dominant
   feature but tighten its height and give a missing backdrop a graceful
   gradient instead of a large void.
4. "Three considered matches": swap the `PosterCard` three-up for `MediaCard`
   (fixed-aspect poster + skeleton, grouped title/meta/reason). Preserve the
   add / mark-next actions via `MediaCard`'s `footer`.
5. Editorial ribbon ("Films that echo afterward"): keep the compact numbered
   ribbon; render each item's artwork through `Poster` so missing art shows a
   skeleton, never raw alt-text.
6. Mood cards ("discovery paths"): keep both; tighten spacing to density tokens.

Out of scope: Library redesign (separate slice), global mobile nav, `PosterCard`
(still used by Library), any behavior/data change.

## Behavior to preserve

- Catalog search: query, format toggle, debounced results, add-to-library,
  in-library links, unavailable state.
- Recommendation cards: `add` and `mark-next` dispatches.
- Hero: "Save for later" / "In your library" toggle and Explore link.
- Collection ribbon links and mood-card links.

## Components

- Reuses `Poster`, `SectionHeader`, `MediaCard` (already built and tested).
- The recommendation card action (add vs mark-next, with the same label logic
  used on Home) is passed as `MediaCard.footer`.

## Testing

- Reuse the primitives' existing unit tests.
- New `Discover.test.tsx` (mock `../store` and `useCatalogSearch` like the
  existing page tests): the page renders its sections; a recommendation card's
  action dispatches (`add` / `mark-next`); the hero save button dispatches
  `add`.
- Visual proof: Playwright before/after at desktop + mobile against the dev
  server.

## Guardrails

Editorial design preserved; semantic HTML, visible focus, AA contrast,
reduced-motion respected. Validation baseline (Prettier, ESLint, tsc, Vitest,
build, audit, `git diff --check`) green before commit.

## Follow-ups

- Library redesign (+ reduce its six view modes).
- Remove now-unused legacy CSS (Home + Discover) in a later careful pass.
