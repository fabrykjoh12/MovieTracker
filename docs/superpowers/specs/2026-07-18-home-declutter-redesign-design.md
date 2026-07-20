# Home De-clutter Redesign — Design

- Date: 2026-07-18
- Status: Approved (brainstorm), pending implementation plan
- Motivation: First-impression feedback that the app feels "messy and crowded,"
  corroborated by a screenshot review of all routes and a competitive scan
  (Trakt's disliked redesign is a cautionary tale; Letterboxd/Serializd win on
  calm, intuitive density).

## Goal

Fix the "messy and crowded" feel by introducing a small set of reusable layout
primitives and applying them to a fully redesigned **Home**, preserving the
premium editorial identity (Instrument Serif display, terracotta accent, dark
restrained palette). Home becomes the reference implementation; other surfaces
adopt the same primitives in follow-up slices.

## Root-cause diagnosis (what makes it feel crowded)

1. Every section shouts equally: `ALL-CAPS eyebrow → giant serif headline →
   subtitle`, repeated 5-6x per page. No hierarchy, so the eye never rests.
2. Oversized, low-density cards and heroes with empty gradient voids → long
   scroll for little content.
3. Awkward card internals: `justify-between` pins title to top and description
   to bottom with a void between.
4. Missing/loading poster art spills raw alt-text instead of a skeleton.
5. Home stacks four equally-weighted full-width sections.

## Decisions (from brainstorm)

1. Scope: **shared primitives + Home as the flagship** (not all surfaces at once).
2. Home latitude: **re-treatment + light consolidation** — may merge/demote
   sections (specifically: fold the two social/agenda sections into one rail).
3. Identity: **keep** the editorial language; fix hierarchy/density, do not
   restyle.
4. Verification: rendered before/after mockups approved during brainstorm;
   implementation verified by unit tests + Playwright before/after captures.

## Scope

In scope:

- Three reusable primitives: `SectionHeader`, `Poster`, `MediaCard`.
- Density/rhythm tokens in `:root`.
- `Home.tsx` fully refactored to the new hierarchy, including the consolidated
  right rail, at desktop **and** mobile widths (responsive).
- Removal of now-dead Home-specific CSS.

Out of scope (explicit follow-ups, each its own spec, reusing these primitives):

- Discover redesign.
- Library redesign and reducing its six view modes.
- Global mobile bottom-navigation rebuild (Home is responsive now, but the
  app-wide nav overhaul is separate).
- Any data/store/behavior change. This slice is layout + presentation only.

## The new Home (approved mockup)

1. **One dominant hero** — Continue Watching stays the focal point.
2. **Quiet secondary headers** — a small uppercase label + a modest serif title
   on a thin rule, replacing the eyebrow/giant-serif/subtitle triple. The one
   remaining large serif on the page is the greeting ("Good evening, Alex.").
3. **Consolidated right rail** — the former "Happening this week" and "Worth
   knowing" sections become a single calm rail: a compact "This week" agenda
   (date + kind + title + subtitle rows) above a "From friends" list. Below the
   hero, Home is a two-column zone: Tonight's picks (left) + the rail (right).
4. **Fixed-aspect poster cards with grouped internals** — `MediaCard` uses a
   2:3 poster and groups title + meta + reason together (no floating gap).
5. **Poster skeleton** — missing/loading art renders a placeholder, never
   raw alt-text.

Tunable without changing direction: exact poster height, rail width, hero size.

## Components (primitives)

Each lives in `src/components/`, is small and single-purpose, and is unit
tested. Props below are the contract other tasks rely on.

### `SectionHeader`

```ts
interface SectionHeaderProps {
  label?: string;        // small uppercase kicker, e.g. "Three, not thirty"
  title: string;         // modest serif title, e.g. "Tonight's picks"
  action?: { text: string; to?: string; onClick?: () => void }; // optional right-aligned link/button
}
```

Renders a `<header>` with the label, an `<h2>` serif title, and the optional
action, separated from content by a bottom rule. Used for every non-hero
section on Home.

### `Poster`

```ts
interface PosterProps {
  src?: string;          // poster URL; undefined/empty → empty state
  alt: string;           // accessible name; never rendered as visible text
  ratio?: "2/3" | "16/9"; // default "2/3"
  pill?: string;         // optional corner label, e.g. "Up next"
}
```

States: `loading` (skeleton until the image load event), `loaded` (image),
`empty` (no `src` → static placeholder, not alt-text). The skeleton/placeholder
is a subtle surface gradient. `alt` is set on the `img` for accessibility but is
never shown as visible text in any state.

### `MediaCard`

```ts
interface MediaCardProps {
  title: string;
  meta?: string;         // e.g. "2023 · 106 min · MUBI"
  reason?: string;       // one-line, shown under a hairline rule
  poster?: string;
  pill?: string;
  to?: string;           // navigates to the title on click
  footer?: React.ReactNode; // optional action area (e.g. the existing
                            // "Mark episode watched" / "Next episode" controls)
}
```

Composes `Poster` (top) + a grouped body (title, meta, optional reason) + an
optional `footer` action area. One card shape reused across Home; the same
component will serve later surfaces. **Behavior preservation:** Home's
Tonight's-picks cards currently expose log / mark-episode / next-episode
actions; these are passed through `footer` so the redesign changes layout only,
never the tracking behavior.

## Density tokens

Add a spacing/rhythm scale to `:root` in `styles.css` (both dark and light
themes inherit; these are theme-agnostic lengths):

```css
--space-section: 40px;   /* gap between major sections (was ad hoc, larger) */
--space-block: 18px;     /* header-to-content */
--rail-width: 340px;     /* consolidated right rail */
```

Existing color/type tokens are unchanged. Section-level styles use these tokens
so the page rhythm is consistent and tighter than today.

## Testing

- **Unit (Vitest + Testing Library):**
  - `Poster`: no `src` → placeholder present, no visible alt-text; with `src` →
    an `img` with the correct `alt`; ratio class applied; `pill` rendered when
    given.
  - `SectionHeader`: renders `label`, `title` as a heading, and `action` (link
    or button) only when provided.
  - `MediaCard`: renders title/meta/reason and a `Poster`; renders `footer`
    actions when provided; navigates via `to`.
- **Non-regression:** existing Home and store tests stay green; the
  Tonight's-picks log/mark-episode actions still fire (behavior preserved). Semantic
  headings, keyboard focus order, visible focus, and AA contrast preserved.
- **Visual proof (not asserted):** a Playwright script captures Home before and
  after at desktop (1440) and mobile (390) for human review of the density win.

## Guardrails (from CLAUDE.md)

- Preserve the premium editorial design; no generic-dashboard drift.
- Restrained borders/glass/gradients/glow; no identical rounded-card overload.
- Semantic HTML, keyboard access, touch targets, visible focus, AA contrast,
  reduced-motion behavior.
- No data claims changed; this is presentation only.

## Validation baseline

Before commit: Prettier, ESLint, TypeScript, Vitest (new + existing green),
Vite build, `npm audit --audit-level=moderate`, `git diff --check`.

## Follow-ups (not this slice)

- Apply primitives to Discover (tall hero + floating-gap cards).
- Apply to Library; consolidate its six view modes to 2-3.
- Global mobile bottom-navigation rebuild.
- Poster art robustness everywhere (skeleton) once `Poster` is the standard.
