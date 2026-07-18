# Home De-clutter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce three reusable layout primitives (`Poster`, `SectionHeader`, `MediaCard`) plus density tokens, and refactor `Home` into a calmer one-hero layout with a consolidated right rail — presentation only, all tracking behavior preserved.

**Architecture:** New self-contained components in `src/components/`, styled by additions to the single `src/styles.css`. `Home.tsx` composes them; no store/data/behavior change. `PosterCard` is intentionally left untouched (still used by Discover/Library, which migrate in later slices).

**Tech Stack:** React 19, TypeScript 6 (strict, `noUncheckedIndexedAccess`), React Router 7, Vitest + Testing Library + jsdom, lucide-react icons, plain CSS with `:root` custom properties (no Tailwind).

## Global Constraints

- Preserve the editorial identity: `--serif: "Instrument Serif"`, `--sans: "DM Sans"`, accent `--accent: #d3664f`, dark base `--bg: #11110f`. Fix hierarchy/density, do not restyle.
- Presentation only: no changes to `src/store.tsx`, `src/domain.ts`, or any repository. Home's Tonight's-picks **log / next-episode / add** actions must still dispatch exactly as today.
- `Poster` `alt` is set on the `<img>` for accessibility but must never render as visible text (this is the bug that makes demo mode look broken).
- Keep semantic HTML, visible focus, AA contrast, keyboard operability; restrained borders/gradients (no dashboard drift).
- Do NOT modify `src/components/PosterCard.tsx` (out-of-scope surfaces depend on it).
- Strict TS: guard array indexing (`noUncheckedIndexedAccess`).
- Single-file test run: `npx vitest run <path>`. Full suite: `npm test`.

**Deviation note (resolved in planning):** the spec described `MediaCard` as replacing the card on Home. Because `PosterCard` is shared by Discover/Library, we add `MediaCard` as a new component used by Home only; `PosterCard` stays. Home's picks lose the in-poster progress bar / verdict badge (rarely meaningful for unwatched picks) but keep the primary log/add action via `MediaCard`'s `footer`, so tracking behavior is preserved.

---

### Task 1: `Poster` primitive

**Files:**
- Create: `src/components/Poster.tsx`
- Create: `src/components/Poster.test.tsx`
- Modify: `src/styles.css` (append Poster styles)

**Interfaces:**
- Produces: `Poster` with props `{ src?: string; alt: string; ratio?: "2/3" | "16/9"; pill?: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Poster.test.tsx
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Poster } from "./Poster";

describe("Poster", () => {
  it("renders an image with its alt when a src is given", () => {
    const { container } = render(<Poster src="/p.jpg" alt="Severance poster" />);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Poster.test.tsx`
Expected: FAIL — module `./Poster` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/Poster.tsx
import { useState } from "react";

interface PosterProps {
  src?: string;
  alt: string;
  ratio?: "2/3" | "16/9";
  pill?: string;
}

export function Poster({ src, alt, ratio = "2/3", pill }: PosterProps) {
  const [loaded, setLoaded] = useState(false);
  const ratioClass = ratio === "16/9" ? "poster-16x9" : "poster-2x3";
  return (
    <div className={`poster ${ratioClass}`}>
      {src ? (
        <img
          className={loaded ? "poster-img is-loaded" : "poster-img"}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="poster-empty" role="img" aria-label={alt} />
      )}
      {src && !loaded && <div className="poster-skeleton" aria-hidden="true" />}
      {pill && <span className="poster-pill">{pill}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Append Poster styles to `src/styles.css`**

```css
/* Poster primitive */
.poster {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
}
.poster-2x3 {
  aspect-ratio: 2 / 3;
}
.poster-16x9 {
  aspect-ratio: 16 / 9;
}
.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 240ms ease;
}
.poster-img.is-loaded {
  opacity: 1;
}
.poster-empty,
.poster-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(150deg, var(--surface-warm), var(--surface));
}
.poster-pill {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.5);
  color: var(--text);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: var(--radius-xs);
}
@media (prefers-reduced-motion: reduce) {
  .poster-img {
    transition: none;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Poster.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/Poster.tsx src/components/Poster.test.tsx src/styles.css
git commit -m "feat: add Poster primitive with skeleton and empty states"
```

---

### Task 2: `SectionHeader` primitive + density tokens

**Files:**
- Create: `src/components/SectionHeader.tsx`
- Create: `src/components/SectionHeader.test.tsx`
- Modify: `src/styles.css` (add density tokens to `:root`, append SectionHeader styles)

**Interfaces:**
- Produces: `SectionHeader` with props `{ label?: string; title: string; action?: { text: string; to?: string; onClick?: () => void } }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SectionHeader.test.tsx
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SectionHeader } from "./SectionHeader";

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("SectionHeader", () => {
  it("renders the title as a heading and the label when given", () => {
    wrap(<SectionHeader label="Three, not thirty" title="Tonight's picks" />);
    expect(
      screen.getByRole("heading", { name: "Tonight's picks" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Three, not thirty")).toBeInTheDocument();
  });

  it("omits the label when not provided", () => {
    wrap(<SectionHeader title="Worth knowing" />);
    expect(screen.queryByText("Three, not thirty")).toBeNull();
  });

  it("renders a link action when `to` is set", () => {
    wrap(<SectionHeader title="X" action={{ text: "Open calendar", to: "/library" }} />);
    expect(screen.getByRole("link", { name: "Open calendar" })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("renders a button action that fires onClick", () => {
    const onClick = vi.fn();
    wrap(<SectionHeader title="X" action={{ text: "Tune tonight", onClick }} />);
    fireEvent.click(screen.getByRole("button", { name: "Tune tonight" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SectionHeader.test.tsx`
Expected: FAIL — module `./SectionHeader` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/SectionHeader.tsx
import { Link } from "react-router-dom";

interface SectionHeaderAction {
  text: string;
  to?: string;
  onClick?: () => void;
}

interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: SectionHeaderAction;
}

export function SectionHeader({ label, title, action }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <div>
        {label && <p className="section-kicker">{label}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {action &&
        (action.to ? (
          <Link className="section-action" to={action.to}>
            {action.text}
          </Link>
        ) : (
          <button
            type="button"
            className="section-action"
            onClick={action.onClick}
          >
            {action.text}
          </button>
        ))}
    </header>
  );
}
```

- [ ] **Step 4: Add density tokens and SectionHeader styles to `src/styles.css`**

Add these three tokens inside the existing `:root { … }` block (next to the other custom properties):

```css
  --space-section: 40px;
  --space-block: 18px;
  --rail-width: 340px;
```

Append the SectionHeader styles at the end of the file:

```css
/* SectionHeader primitive */
.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 10px;
  margin-bottom: var(--space-block);
}
.section-kicker {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}
.section-title {
  font-family: var(--serif);
  font-size: 24px;
  font-weight: 400;
  line-height: 1.1;
}
.section-action {
  color: var(--text-soft);
  font-size: 12px;
  text-decoration: none;
  background: none;
  border: 0;
  cursor: pointer;
  font-family: var(--sans);
  white-space: nowrap;
}
.section-action:hover {
  color: var(--text);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/SectionHeader.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/SectionHeader.tsx src/components/SectionHeader.test.tsx src/styles.css
git commit -m "feat: add SectionHeader primitive and density tokens"
```

---

### Task 3: `MediaCard` primitive

**Files:**
- Create: `src/components/MediaCard.tsx`
- Create: `src/components/MediaCard.test.tsx`
- Modify: `src/styles.css` (append MediaCard styles)

**Interfaces:**
- Consumes: `Poster` (Task 1).
- Produces: `MediaCard` with props `{ title: string; meta?: string; reason?: string; poster?: string; pill?: string; to?: string; footer?: React.ReactNode }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/MediaCard.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MediaCard } from "./MediaCard";

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("MediaCard", () => {
  it("renders title, meta and reason", () => {
    wrap(
      <MediaCard
        title="Past Lives"
        meta="2023 · 106 min · MUBI"
        reason="Tender, unhurried."
      />,
    );
    expect(screen.getByText("Past Lives")).toBeInTheDocument();
    expect(screen.getByText("2023 · 106 min · MUBI")).toBeInTheDocument();
    expect(screen.getByText("Tender, unhurried.")).toBeInTheDocument();
  });

  it("links the title when `to` is set", () => {
    wrap(<MediaCard title="Andor" to="/title/andor" />);
    expect(screen.getByRole("link", { name: "Andor" })).toHaveAttribute(
      "href",
      "/title/andor",
    );
  });

  it("renders a Poster placeholder when no poster src is given", () => {
    const { container } = render(
      <MemoryRouter>
        <MediaCard title="X" />
      </MemoryRouter>,
    );
    expect(container.querySelector(".poster-empty")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders footer actions when provided", () => {
    wrap(<MediaCard title="X" footer={<button type="button">Log watched</button>} />);
    expect(
      screen.getByRole("button", { name: "Log watched" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/MediaCard.test.tsx`
Expected: FAIL — module `./MediaCard` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/MediaCard.tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Poster } from "./Poster";

interface MediaCardProps {
  title: string;
  meta?: string;
  reason?: string;
  poster?: string;
  pill?: string;
  to?: string;
  footer?: ReactNode;
}

export function MediaCard({
  title,
  meta,
  reason,
  poster,
  pill,
  to,
  footer,
}: MediaCardProps) {
  const poster_ = <Poster src={poster} alt={`${title} poster`} pill={pill} />;
  return (
    <article className="media-card">
      {to ? (
        <Link className="media-card-poster" to={to} aria-label={`View ${title}`}>
          {poster_}
        </Link>
      ) : (
        <div className="media-card-poster">{poster_}</div>
      )}
      <div className="media-card-body">
        <h3 className="media-card-title">
          {to ? <Link to={to}>{title}</Link> : title}
        </h3>
        {meta && <p className="media-card-meta">{meta}</p>}
        {reason && <p className="media-card-reason">{reason}</p>}
      </div>
      {footer && <div className="media-card-footer">{footer}</div>}
    </article>
  );
}
```

- [ ] **Step 4: Append MediaCard styles to `src/styles.css`**

```css
/* MediaCard primitive */
.media-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.media-card-poster {
  display: block;
}
.media-card-body {
  padding: 11px 12px 13px;
}
.media-card-title {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 14px;
  line-height: 1.25;
}
.media-card-title a {
  color: var(--text);
  text-decoration: none;
}
.media-card-title a:hover {
  color: var(--accent-soft);
}
.media-card-meta {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}
.media-card-reason {
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.35;
  margin-top: 8px;
  border-top: 1px solid var(--line);
  padding-top: 8px;
}
.media-card-footer {
  padding: 0 12px 12px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/MediaCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/MediaCard.tsx src/components/MediaCard.test.tsx src/styles.css
git commit -m "feat: add MediaCard primitive"
```

---

### Task 4: Refactor `Home` to the calm layout

**Files:**
- Modify: `src/pages/Home.tsx`
- Create: `src/pages/Home.test.tsx`
- Modify: `src/styles.css` (append Home zone/rail styles)

**Interfaces:**
- Consumes: `SectionHeader` (Task 2), `MediaCard` (Task 3), existing `useStore`, `domain` helpers, `TonightControls`.

- [ ] **Step 1: Write the failing behavior-preservation test**

```tsx
// src/pages/Home.test.tsx
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, media } from "../data";
import { Home } from "./Home";

const dispatch = vi.fn();
vi.mock("../store", () => ({
  useStore: () => ({ state: initialState, catalog: media, dispatch }),
}));

describe("Home", () => {
  beforeEach(() => dispatch.mockClear());

  it("keeps the greeting and hero", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Good evening, Alex." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Severance" })).toBeInTheDocument();
  });

  it("still dispatches mark-next when the hero episode is logged", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /mark episode watched/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "mark-next", mediaId: "severance" });
  });

  it("renders a Tonight's picks action for a pick (behavior preserved)", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    // at least one pick action button exists (Next episode / Log watched / Add to library)
    const actions = screen.getAllByRole("button", {
      name: /next episode|log watched|add to library/i,
    });
    expect(actions.length).toBeGreaterThan(0);
    fireEvent.click(actions[0]!);
    expect(dispatch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Home.test.tsx`
Expected: FAIL — Home still renders the old markup; the pick action buttons live inside `PosterCard` with different accessible names, or the assertions on new structure fail. (If it happens to pass on the hero test, the picks/structure assertions will not.)

- [ ] **Step 3: Rewrite `src/pages/Home.tsx`**

Replace the entire file with the version below. It keeps the hero and undo strip verbatim, swaps the two `.section-heading` blocks for `SectionHeader`, renders picks via `MediaCard` (with the log/add action passed as `footer`), and consolidates the week + activity panels into one `.home-rail`.

```tsx
import {
  ArrowRight,
  BookmarkPlus,
  CalendarDays,
  Check,
  Clock3,
  Info,
  Play,
  RotateCcw,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  nextEpisode,
  progressPercent,
  recommendationReason,
  tonightCandidates,
} from "../domain";
import { MediaCard } from "../components/MediaCard";
import { SectionHeader } from "../components/SectionHeader";
import { TonightControls } from "../components/TonightControls";
import type { Media, UserMediaState } from "../types";
import { useStore } from "../store";

function pickActionLabel(item: Media, userState?: UserMediaState) {
  if (!userState) return "Add to library";
  if (item.format === "series") return "Next episode";
  return userState.status === "completed" ? "Watched" : "Log watched";
}

export function Home() {
  const { state, dispatch, catalog } = useStore();
  const hero = catalog.find((item) => item.id === "severance")!;
  const heroState = state.userMedia[hero.id];
  const upcoming = nextEpisode(hero, heroState?.progress);
  const picks = tonightCandidates(catalog, state);
  const progress = progressPercent(hero, heroState?.progress);

  const trackHero = () => dispatch({ type: "mark-next", mediaId: hero.id });

  return (
    <div className="page home-page">
      <section className="welcome-line">
        <div>
          <p className="eyebrow">THURSDAY, JULY 16</p>
          <h1>Good evening, Alex.</h1>
        </div>
        <p>One episode waiting. A quiet night to fill.</p>
      </section>

      <section
        className="continue-hero"
        style={
          {
            "--hero-image": `url(${hero.backdrop})`,
            "--hero-accent": hero.accent,
          } as React.CSSProperties
        }
      >
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> CONTINUE WATCHING
          </p>
          <h2>{hero.title}</h2>
          <div className="episode-line">
            <strong>
              S{upcoming?.season.number} E{upcoming?.episode?.number}
            </strong>
            <span>{upcoming?.episode?.title}</span>
          </div>
          <p className="hero-description">{upcoming?.episode?.synopsis}</p>
          <div className="hero-meta">
            <span>
              <Clock3 size={15} />
              {upcoming?.episode?.runtime} min
            </span>
            <span className="service-mark">tv+</span>
            <span>Last watched 2 days ago</span>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={trackHero}
            >
              <Check size={18} />
              Mark episode watched
            </button>
            <Link className="secondary-button" to={`/title/${hero.id}`}>
              <Info size={18} />
              Details
            </Link>
          </div>
          <div className="hero-progress">
            <div>
              <span>
                Season {heroState?.progress?.season} ·{" "}
                {heroState?.progress?.episode} of{" "}
                {upcoming?.season.episodes.length}
              </span>
              <span>{progress}% overall</span>
            </div>
            <i>
              <b
                style={{
                  width: `${((heroState?.progress?.episode ?? 0) / (upcoming?.season.episodes.length ?? 1)) * 100}%`,
                }}
              />
            </i>
          </div>
        </div>
        <div className="hero-episode-card">
          <p>UP AFTER THIS</p>
          <span>S2 E{(upcoming?.episode?.number ?? 0) + 1}</span>
          <strong>
            {upcoming?.season.episodes[upcoming?.episode?.number ?? 0]?.title ??
              "The next chapter"}
          </strong>
        </div>
      </section>

      <div className="home-zone">
        <div className="home-primary">
          <SectionHeader
            label="THREE, NOT THIRTY"
            title="Tonight's picks"
          />
          <TonightControls />
          <section className="tonight-grid" aria-label="Tonight's recommendations">
            {picks.length ? (
              picks.map((item, index) => {
                const userState = state.userMedia[item.id];
                const onClick = userState
                  ? () => dispatch({ type: "mark-next", mediaId: item.id })
                  : () => dispatch({ type: "add", mediaId: item.id });
                return (
                  <MediaCard
                    key={item.id}
                    title={item.title}
                    to={`/title/${item.id}`}
                    poster={item.poster}
                    pill={index === 0 ? "Up next" : undefined}
                    meta={`${item.year} · ${
                      item.format === "movie"
                        ? `${item.runtime} min`
                        : `${item.seasons?.length ?? 0} seasons`
                    }`}
                    reason={recommendationReason(item, userState)}
                    footer={
                      <button
                        type="button"
                        className="card-action"
                        onClick={onClick}
                        aria-label={`${pickActionLabel(item, userState)} — ${item.title}`}
                      >
                        {userState ? <Play size={15} /> : <BookmarkPlus size={15} />}
                        {pickActionLabel(item, userState)}
                      </button>
                    }
                  />
                );
              })
            ) : (
              <div className="empty-state">
                <h3>No honest matches yet.</h3>
                <p>Relax one filter and the shortlist will rebuild.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="home-rail">
          <SectionHeader label="THIS WEEK" title="Worth knowing" />
          <div className="rail-agenda">
            <article>
              <time><strong>17</strong><span>FRI</span></time>
              <div>
                <span className="event-type">NEW EPISODE</span>
                <h3>Severance</h3>
                <p>“Woe’s Hollow” · Apple TV+</p>
              </div>
              <button type="button" aria-label="Set reminder for Severance">
                <CalendarDays size={16} />
              </button>
            </article>
            <article>
              <time><strong>19</strong><span>SUN</span></time>
              <div>
                <span className="event-type available">NOW AVAILABLE</span>
                <h3>Past Lives</h3>
                <p>Saved 3 months ago · MUBI</p>
              </div>
              <span className="quiet-badge">Up Next</span>
            </article>
            <article>
              <time><strong>21</strong><span>TUE</span></time>
              <div>
                <span className="event-type party">WATCH TOGETHER</span>
                <h3>Friday film shortlist</h3>
                <p>Sara and Maya are ready to vote</p>
              </div>
              <Link to="/friends" aria-label="Open watch together room">
                <Users size={16} />
              </Link>
            </article>
          </div>

          <div className="rail-divider" />
          <p className="section-kicker rail-subhead">FROM FRIENDS</p>
          <div className="activity-item">
            <span className="friend-avatar warm">SA</span>
            <p>
              <strong>Sara</strong> strongly recommends{" "}
              <Link to="/title/portrait">Portrait of a Lady on Fire</Link>
              <small>“The final scene alone.” · spoiler-free</small>
            </p>
          </div>
          <div className="activity-item">
            <span className="friend-avatar blue">MY</span>
            <p>
              <strong>Maya</strong> finished the Severance episode you’re on
              <small>Her reaction unlocks when you finish</small>
            </p>
          </div>
          <Link className="text-link" to="/friends">
            See friend space <ArrowRight size={15} />
          </Link>
        </aside>
      </div>

      <div className="undo-strip" role="status" aria-live="polite">
        <RotateCcw size={15} />
        <span>Tracking mistakes are always reversible.</span>
        <button type="button" onClick={() => dispatch({ type: "undo" })}>
          Undo last
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Append Home zone/rail styles to `src/styles.css`**

```css
/* Home calm layout */
.home-zone {
  display: grid;
  grid-template-columns: 1fr var(--rail-width);
  gap: var(--space-section);
  margin-top: var(--space-section);
}
.home-primary .tonight-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line-strong);
  color: var(--text);
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.card-action:hover {
  background: rgba(255, 255, 255, 0.1);
}
.home-rail {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 18px;
  align-self: start;
}
.rail-agenda article {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 11px 0;
  border-top: 1px solid var(--line);
}
.rail-agenda article:first-child {
  border-top: 0;
}
.rail-agenda time {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
}
.rail-agenda time strong {
  font-family: var(--serif);
  font-size: 20px;
  color: var(--text-soft);
}
.rail-agenda time span {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.rail-agenda article > div {
  flex: 1;
}
.rail-agenda h3 {
  font-size: 13px;
  font-weight: 600;
  margin-top: 2px;
}
.rail-agenda p {
  color: var(--muted);
  font-size: 11px;
}
.rail-divider {
  height: 1px;
  background: var(--line);
  margin: 16px 0;
}
.rail-subhead {
  margin-bottom: 12px;
}
@media (max-width: 900px) {
  .home-zone {
    grid-template-columns: 1fr;
  }
  .home-primary .tonight-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/Home.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Remove now-dead Home CSS (cautiously)**

The refactor stops using these Home-only selectors. Confirm each is unused repo-wide before deleting its rule block from `src/styles.css`:

```bash
for c in section-heading tonight-heading home-lower-grid week-panel activity-panel event-list event-art tonight-pick pick-number; do
  echo "== $c =="; grep -rn "\"$c\"\|className={\`[^}]*$c\|\\.$c" src/ | grep -v styles.css | head -3
done
```

For any class with **no** non-CSS references remaining, delete its rule block from `src/styles.css`. If a class still appears in another `.tsx`, leave it. (Do not remove `.activity-item`, `.friend-avatar`, `.event-type`, `.quiet-badge`, `.text-link`, `.empty-state` — the new Home still uses them.)

- [ ] **Step 7: Run the full suite + build**

Run: `npm test` then `npm run typecheck` then `npm run build`
Expected: all tests pass; no TS errors; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.test.tsx src/styles.css
git commit -m "feat: refactor Home into calm one-hero layout with consolidated rail"
```

---

### Task 5: Visual proof + validation baseline

**Files:**
- Create: `scripts/capture-home.mjs` (throwaway visual capture; committed so the follow-up surfaces can reuse it)

- [ ] **Step 1: Add the capture script**

```js
// scripts/capture-home.mjs — run against a local `npm run dev` server
import pkg from "playwright";
const { chromium } = pkg;
const BASE = "http://localhost:4173/MovieTracker/#/";
const browser = await chromium.launch();
for (const [name, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `home-after-${name}.png`, fullPage: true });
  console.log(`wrote home-after-${name}.png`);
  await ctx.close();
}
await browser.close();
```

Note: `playwright` is not a project dependency; this script is for local/manual visual review only (run with the globally available Playwright). It is not part of `npm test`.

- [ ] **Step 2: Run the full validation baseline**

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
git diff --check
```

Expected: Prettier clean, ESLint clean, no TS errors, all Vitest files green (including the four new test files), build succeeds, audit zero moderate+ vulnerabilities, no whitespace errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/capture-home.mjs
git commit -m "chore: add Home visual capture script"
```

---

## Self-Review

**Spec coverage:**
- `SectionHeader` primitive → Task 2. ✓
- `Poster` primitive with skeleton/empty, alt never visible → Task 1. ✓
- `MediaCard` with footer action → Task 3; used on Home → Task 4. ✓
- Density tokens (`--space-section`, `--space-block`, `--rail-width`) → Task 2. ✓
- Home: one hero, quiet headers, consolidated rail, fixed-aspect cards → Task 4. ✓
- Behavior preserved (log/mark/add still dispatch) → Task 4 tests. ✓
- Responsive (mobile column collapse) → Task 4 CSS `@media (max-width:900px)`. ✓
- No store/data/PosterCard changes → constraints + Task 4 leaves them untouched. ✓
- Testing: unit for each primitive + Home non-regression → Tasks 1–4. ✓
- Dead-CSS cleanup → Task 4 Step 6. ✓
- Out-of-scope (Discover/Library/mobile-nav) not touched. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete; commands have expected output. ✓

**Type consistency:** `Poster({src?,alt,ratio?,pill?})`, `SectionHeader({label?,title,action?})`, `MediaCard({title,meta?,reason?,poster?,pill?,to?,footer?})` used identically across Tasks 1–4. Home passes `footer` a `<button>` and `pill` a string — matches. `pickActionLabel(item, userState?)` defined and used in Task 4 only. ✓

**Note:** the approved mockup omitted the per-card action button for visual calm; the plan restores it as a footer button to satisfy the behavior-preservation constraint. This is intentional and called out in the spec's deviation note.
