# MovieTracker Roadmap

## Goal

Turn the current local-first demonstration into a trustworthy invite-only beta for a small group of friends.

The beta is ready when an invited user can sign in, find real media, maintain a private library across devices, track episodes and rewatches, record Verdicts, organize shelves, interact with friends without spoilers, and export or delete their data.

## Current state

The deployed application is a polished interactive prototype with working Neon authentication and a production database foundation. Demo mode remains local-first. The repository now contains the first Neon library synchronization path, including an explicit, idempotent browser-to-cloud import. Production Data API account isolation and independent-client hydration are accepted; a physical second-device browser smoke test remains.

Production checkpoint on 2026-07-17:

- GitHub Pages is deployed at `https://fabrykjoh12.github.io/MovieTracker/`.
- Neon Auth sign-in, sign-out, session restoration, and password setup/reset work locally and are compiled into the production deployment.
- Five Neon migrations are applied: 21 public tables, RLS on all 21, 41 policies, 14 curated provider mappings, and no browser grants on the provider caches.
- The complete schema types were generated from Neon, and a live schema contract verifies all RLS-enabled tables, owner policies, and anonymous grants.
- A stable 14-title development catalog and durable first-sync completion marker are applied through checksum-protected migrations.
- The existing Auth user was backfilled into `public.profiles`.
- GitHub Actions validates required Neon variables and refuses to publish an unconfigured demo build.
- Repository contracts, database mappers, local persistence, Neon library persistence, explicit retry-safe first sync, optimistic rollback, and stale-write rejection are implemented.
- The first production account completed cloud initialization: 12 mapped library rows, 6 distinct watch events, 5 Verdicts, and 4 exact-progress rows were verified with no duplicate client event IDs.
- A secure build-time TMDB adapter enriches all 14 curated titles with real posters, backdrops, synopsis, runtime, year, and genres while retaining an explicit local fallback. Production workflow run `29600061181` synced all 14 titles and deployed 28 unique TMDB poster/backdrop URLs; sampled live images returned HTTP 200.
- The rate-limited catalog Worker is live at `https://movie-tracker-catalog.fabrykjoh12.workers.dev`, with only `TMDB_READ_ACCESS_TOKEN` and `DATABASE_URL` stored as Cloudflare secrets. Live acceptance verified real TMDB search and artwork, first import into Neon, edge-cache reuse, and Neon-cache reuse. Search is available globally from the header and `/`, with direct library adds.

The following areas are demonstrations rather than production integrations:

- Profile content beyond the authenticated identity
- Cross-device persistence has not completed its two-device production acceptance test.
- Streaming availability
- Friend relationships and activity
- Watch Together synchronization
- Notifications and sharing
- Backups, monitoring, privacy controls, and moderation

## Beta-readiness audit — 2026-07-21

A focused pass treated the app as something a real invited user would depend on daily, not as a demo. The goal was product truthfulness, data correctness, reliability, security, accessibility, testing, and complete daily-use workflows — not new features or a visual redesign. Findings are grouped by severity; P0 items block any external testing and were fixed in this pass (each as its own reviewed, tested commit on this branch). P1+ remain open and are sequenced into the phases above.

### P0 — fixed this pass

- **Unauthenticated catalog writes.** The catalog import endpoint (`POST /v1/catalog` on the Cloudflare Worker) trusted only CORS and a per-IP rate limit, both spoofable by anyone with the Worker URL — there was no check that the caller was a real signed-in user. Fixed: the Worker now verifies a Neon Auth JWT against Neon's JWKS before touching the provider or database (`worker/src/auth.ts`), adds a second per-authenticated-user rate limit alongside the existing per-IP one, and fails closed with a distinct `auth_unavailable` code if Neon Auth isn't configured for the deployment, rather than silently accepting unauthenticated writes. The frontend fetches a fresh JWT at the moment of import instead of caching one, and now honestly blocks a signed-out attempt to add a brand-new title with a clear message instead of round-tripping to the same 401. Public search is unaffected and stays unauthenticated. Covered by real cryptographic JWT tests (`worker/src/auth.test.ts`, `worker/src/index.test.ts`) and a client-side wiring test (`src/hooks/useCatalogSearch.test.tsx`).
  - **Real manual action required before this protection is live:** `worker/wrangler.jsonc`'s `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL` vars are placeholders (empty strings) — an operator with the Neon console must fill them in from the same Neon Auth URL used for `VITE_NEON_AUTH_URL`, then run the existing manual `Deploy catalog Worker` GitHub Action. Left empty, the Worker fails every import closed (safe, but unavailable) rather than insecure.
- **Silent data loss during unresolved cloud sync.** An authenticated user's edit made while the cloud repository was still connecting, or after the last cloud read/write had failed, previously fell through to browser-only storage with no warning. A later successful reconnect then unconditionally replaced state with the cloud snapshot, discarding that edit with no error, no rollback, and nothing to tell the user it happened. Fixed to the documented minimum bar: `dispatch` now refuses to apply an edit while the cloud state isn't known to be current, and Shell shows a global banner (not just the Account page) explaining why, with a retry action for the error case. Pre-import states are unaffected — editing locally before the first cloud copy is existing, intentional, documented behavior, not this bug. Covered by `src/store.integration.test.tsx`. This is the _minimum_ bar the brief asked for, not the preferred fix — there is still no offline/failed-mutation queue with automatic retry; a blocked edit today must be manually retried by the user once reconnected, and is not silently queued.
- **No mandatory PR checks.** The only CI workflow ran on push to `main`; nothing validated a pull request before merge. Added `.github/workflows/ci.yml`, running format, lint, typecheck, test, `worker:check`, build, and `npm audit --audit-level=moderate` on every PR and push to `main`, none of which need secrets. **Real manual action required:** add the `validate` job as a required status check for `main` in GitHub branch protection settings — a workflow file alone doesn't block merges.
- **Fictional "your week" stat in the global Shell sidebar.** `src/components/Shell.tsx` rendered a fixed "4h 32m watched" stat and a fixed seven-bar sparkline (`[35, 80, 20, 56, 92, 44, 10]`) on every page, for every account, regardless of actual watch history — a real signed-in user could easily read it as their own data. Fixed: `weeklyWatchSummary` (`src/domain.ts`) derives real per-day and total watched minutes from the account's actual `WatchEvent` history and the catalog's real per-episode/per-movie runtimes (movie and season-complete events use the title's/season's real runtime; episode events use the specific episode's runtime, falling back to the title's typical runtime only when a specific episode isn't in the loaded catalog data; a rewatch-start marker correctly contributes zero, since it has no watched duration of its own). Shell now renders that real value and a real per-day sparkline, so a brand-new account honestly shows "0m" instead of a fabricated number. Covered by `src/domain.test.ts` (the calculation) and `src/components/Shell.test.tsx` (the rendered stat, including the zero-events case).
- **Fabricated greeting and "Continue Watching" hero on Home.** `src/pages/Home.tsx` greeted every account as "Good evening, Alex." above a fixed "THURSDAY, JULY 16" eyebrow, and always featured Severance as the "Continue Watching" hero with a hardcoded "Last watched 2 days ago" and a hardcoded "tv+" service badge — regardless of who was signed in, the real date, or whether the account had ever added Severance, let alone was actively watching it. Fixed: the greeting uses the real signed-in user's name (or none, honestly, rather than a fabricated one) and today's real date; the hero is chosen by a new `continueWatchingCandidate` (`src/domain.ts`) — the account's most recently active series that is actually `watching`/`rewatching` and still has a next episode — with a real relative "last watched" time and the title's real primary streaming service; an account with nothing genuinely in progress now sees an honest "Nothing in progress" empty state instead of someone else's show. A stray hardcoded "S2" in the "up after this" card (independent of which season was actually next) was also fixed. Covered by `src/pages/Home.test.tsx` and `src/domain.test.ts`.
- **Fabricated "This week" agenda and "From friends" activity feed on Home.** The rail beside Tonight's picks hardcoded a specific upcoming episode, a fake "now available" availability notice, a fake Watch Together prompt, and two fabricated friend interactions ("Sara strongly recommends…", "Maya finished the episode you're on") for every account — friend relationships, availability alerts, and reminders don't exist yet in this beta at all (per this file's "Current state" section), so none of it could ever be real for any signed-in user. Fixed by removing the fabricated content and replacing it with an honest "Nothing to report yet" empty state; the real "See friend space" link to the (separately limited) Friends page is kept. The now-fully-unused CSS for the removed markup (`.rail-agenda`, `.rail-divider`, `.rail-subhead`, `.activity-item`, `.event-type`, `.quiet-badge`) was deleted rather than left orphaned; classes still used elsewhere (`.activity-panel`, `.friend-avatar`, `.lock-dot`, `.priority-badge`, `.verdict-badge`) were kept. Covered by `src/pages/Home.test.tsx`.
- **Fabricated friends, activity, and taste compatibility on the Friends page.** `src/pages/Friends.tsx` showed a "Watch Together" room with two named fake participants (Sara, Maya) with pre-set fake votes, a "Friend activity" feed fabricating specific interactions from three named people (Sara, Maya, Jonas — a verdict, a finished episode, a watch invite), and a "Taste compatibility" card with fabricated percentage bars ("You & Sara — Closely aligned — 87% Pacing / 76% Tone / 92% Story"). None of it was reachable from any real data; a real invited user could believe they had specific friends who don't exist. The candidate voting list itself was real (`state.room.candidates`, dispatching a real `vote` action), but its footer computed a "possible mutual matches" count from those same fake pre-set votes, which is a fabricated number even though the underlying mechanism is real. Fixed per explicit product direction (asked and confirmed): kept the real, functional parts — the candidate list, the private per-user vote buttons and their dispatch, the room constraints — and replaced everything that depended on a fake specific person with an honest state: the participant stack now shows only the real signed-in user ("1 participant"), the match-count footer says "Watch Together matching isn't live yet" instead of a number derived from fake votes, the friend-activity feed became a "No friends yet" empty state, and the compatibility card became a "Coming soon" note. `mutualMatches` stays in `src/domain.ts` (still unit-tested) for when a real second voter exists; it's just no longer called from a UI showing only fake participants. Now-orphaned CSS for the removed markup (`.compat-orbit*`, `.compatibility-card > strong`/bars/button, `.friend-events > article` and its descendants, `.spoiler-button`) was deleted. Covered by `src/pages/Friends.test.tsx`.

### P1 — confirmed, not yet fixed

- **Fictional data presented as real, remaining findings.** An earlier audit in this session flagged Profile and the Library calendar view for the same kind of seeded/demo content as the Home, Shell, and Friends findings above. Those need the same file-by-file confirmation pass applied here before fixing, rather than a blanket rewrite.
- **Domain tracking logic is sound.** As a counterpoint audited and confirmed true in this pass: episode/season progress tracking, rewatch handling, and Verdict persistence in `src/domain.ts`, `src/components/VerdictModal.tsx`, and `src/pages/MediaDetail.tsx` are correctly implemented against their own tests — this is not a source of data-correctness risk today.

### Not yet re-audited in this pass (carried from the phase backlog below)

Profile/shelf persistence, full end-to-end offline/session-expiry/conflict test coverage, an accessibility audit, environment separation, and monitoring are still open — see Phases 3, 5, and 6 below for the sequencing. This pass did not re-verify every item in those phases; it fixed the three items that block any external tester from being handed the app safely (P0 above) and confirmed the two P1 findings above through direct code reading rather than re-running the full original audit end to end.

## Architecture direction

- Keep the current React, Vite, and TypeScript frontend.
- Use Neon for PostgreSQL, managed authentication, and its browser-safe Data API.
- Use refresh-based room synchronization for the first beta; add a dedicated realtime provider only after the core persistence flows are reliable.
- Protect every exposed user-data table with Row Level Security.
- Keep provider-specific metadata behind adapters.
- Start with TMDB for non-commercial beta metadata and regional watch-provider data, subject to its attribution and usage terms.
- Use `localStorage` only for demo mode, offline caching, and a future mutation queue—not as the production source of truth.
- Maintain separate development and production environments.

## Phase 1 — Production foundation

Status: **In progress**

### Authentication and environments

- [ ] Create a Neon project with separate development and production branches.
- [x] Add typed Neon Auth and Data API configuration with a safe unconfigured state.
- [x] Configure environment variables in local development and GitHub Pages.
- [x] Add authentication state management.
- [x] Add invited-account email/password sign-in and sign-out actions.
- [x] Add password setup and reset flows compatible with GitHub Pages routing.
- [ ] Add invite-only registration enforcement.
- [x] Configure allowed origins for local development and the production domain.
- [x] Fail deployment when the public Neon configuration is missing.

### Database and authorization

- [x] Add versioned SQL migrations for the initial domain model.
- [x] Add primary foreign-key and query indexes.
- [x] Enable Row Level Security on exposed tables.
- [x] Add initial owner, friendship, shelf, spoiler, and room policies.
- [x] Apply and audit the initial migration against the production Neon branch.
- [x] Generate database TypeScript types from the deployed schema.
- [x] Add an automated deployed-schema and RLS policy contract check.
- [x] Add authenticated two-account RLS integration tests.
- [x] Add a stable development catalog with explicit local-ID-to-UUID mappings.
- [ ] Separate development and production branches and seed catalogs.

### Data access

- [x] Define repository interfaces for profiles, catalogs, libraries, tracking, Verdicts, shelves, and social data.
- [x] Add the first Neon Data API repository for libraries, viewing history, queue order, and title-level Verdicts.
- [ ] Add Neon implementations for profiles, shelves, rankings, and social data.
- [x] Move direct application-state `localStorage` access behind a local repository.
- [x] Hydrate authenticated library state from the database when cloud data exists.
- [x] Add serialized optimistic library updates with rollback and a visible error state.
- [x] Add an explicit, idempotent browser-library import instead of silently copying data.
- [x] Complete and audit the first production account import.
- [x] Complete refresh, independent-client, and second-account Data API acceptance.
- [ ] Complete a physical second-device browser smoke test.

### Phase 1 exit gate

Two invited accounts can sign in on multiple devices. Each account sees only its own private library, and updates synchronize without data loss.

## Phase 2 — Real metadata and search

- [x] Register and approve the metadata-provider integration.
- [x] Add stable TMDB provider mappings for the curated beta catalog.
- [x] Add a server/build-only TMDB sync that never exposes the read token to the browser.
- [x] Add provider-failure and incomplete-artwork fallbacks plus conditional TMDB attribution.
- [x] Add a rate-limited server-side metadata proxy so provider credentials never reach the browser.
- [x] Add provider ID mapping and browser-inaccessible metadata cache tables.
- [x] Implement global movie and series search with normalized direct-to-library import.
- [ ] Add direct season, episode, person, and creator search.
- [x] Replace curated-catalog demo posters and backdrops with provider artwork.
- [x] Add Norwegian streaming-provider availability for imported titles.
- [x] Add TMDB attribution and provider notices for the curated catalog.
- [x] Handle missing artwork, runtimes, seasons, and release dates without broken UI.
- [x] Add 15-minute edge search caching, seven-day Neon title caching, and provider-failure fallbacks.

### Phase 2 exit gate

An authenticated user can find a real movie or series, inspect its actual seasons and episodes, and add it to their private library.

## Phase 3 — Daily-use core

### Home and Tonight

- [ ] Score recommendations from real history, Verdicts, queue state, runtime, services, and mood.
- [ ] Persist Tonight preferences.
- [ ] Generate recommendation explanations from actual signals.
- [ ] Add honest empty and no-match states.

### Library

- [ ] Persist all eight library states.
- [ ] Create, edit, delete, reorder, and share shelves.
- [ ] Connect gallery, queue, timeline, calendar, and Taste Map to server data.
- [ ] Implement search, advanced filtering, bulk actions, and stale-watchlist review.
- [ ] Add accessible pointer, touch, and keyboard shelf ordering.

### Tracking and Verdicts

- [ ] Persist exact episode progress and watch events.
- [ ] Support batch completion, specials, alternative episode orders, and reliable undo.
- [ ] Support multiple watch dates and rewatches.
- [ ] Persist movie, series, season, and episode Verdicts.
- [ ] Persist qualities, tags, pairwise comparisons, and manual rankings.
- [ ] Resolve simultaneous updates from multiple devices.

### Product completeness

- [x] Every previously inactive control (Discover filters, Home reminders,
      Library shelf/pick-for-me, Friends invites/constraints/matches/spoiler
      reveal/taste compare, Profile share/DNA-info/why-this/year-in-review/
      ranking, Media Detail note/reaction) is now honestly disabled with a
      "coming soon" cue instead of silently doing nothing. None are wired to
      real behavior yet — that remains future work per-feature.
- [ ] Add loading, error, offline, expired-session, and rollback states.
- [ ] Add import and export for personal backup.

### Interface and design system

- [x] Add reusable layout primitives — Poster (with skeleton and empty states so missing artwork never spills raw alt text), SectionHeader, and MediaCard — plus density tokens.
- [x] Redesign Home into a calmer one-hero layout with quiet section headers and a consolidated right rail, presentation-only and behavior-preserving.
- [ ] Apply the primitives to Discover and Library, and reduce Library's overlapping view modes.
- [ ] Rebuild mobile navigation as a dedicated bottom bar.
- [ ] Remove the now-unused legacy Home CSS left behind by the redesign.

### Phase 3 exit gate

A tester can use MovieTracker for seven consecutive days on two devices without losing data or needing another tracking application.

## Phase 4 — Invite-only social beta

- [ ] Create expiring, usage-limited invitation links.
- [ ] Implement friend requests, acceptance, removal, and blocking.
- [ ] Keep profiles, shelves, and activity private by default.
- [ ] Generate activity from real domain events.
- [ ] Separate short reactions from long-form reviews.
- [ ] Enforce spoiler visibility in database queries and policies.
- [ ] Implement Watch Together participants, constraints, private votes, and match reveal.
- [ ] Add efficient refresh-based room updates with visibility-aware polling.
- [ ] Add minimal in-app notifications.
- [ ] Add reporting and deletion tools.

### Phase 4 exit gate

Five to ten invited testers can follow one another, react, and use Watch Together without exposing private data or future-episode spoilers.

## Phase 5 — Security, privacy, and operations

- [ ] Audit every RLS policy and service-role operation.
- [ ] Add server-side validation and rate limits.
- [ ] Configure database backups and complete a restoration exercise.
- [ ] Add structured logs, error reporting, and failed-mutation monitoring.
- [ ] Monitor metadata-provider health and quotas.
- [x] Add account export (self-describing JSON) and data-only deletion in both demo and cloud modes. Full Auth-identity erasure remains a server-side follow-up.
- [ ] Write privacy, terms, retention, and acceptable-use policies.
- [ ] Add abuse prevention for invitations and social writes.
- [ ] Create operational and incident-response runbooks.

### Phase 5 exit gate

Every user-data type has an authorization policy, backup strategy, export path, and deletion path.

## Phase 6 — Beta release quality

- [ ] Add end-to-end tests for onboarding, search, library, tracking, Verdicts, shelves, friends, spoilers, and Watch Together.
- [ ] Add migration and realistic-volume integration tests.
- [ ] Test offline behavior and failed networks.
- [ ] Complete keyboard and screen-reader accessibility audits.
- [ ] Review the product at 375, 768, 1280, and 1440 pixel widths.
- [ ] Add image, bundle, and interaction performance budgets.
- [ ] Test current Chrome, Firefox, Safari, and Edge.
- [ ] Add staging and production deployment pipelines.
- [ ] Automate production migrations with rollback safeguards.
- [ ] Configure a custom domain and production email sender.
- [ ] Add in-product beta feedback and support contact paths.
- [ ] Release in small invitation cohorts.

## Deferred until after beta

- Public reviews and global sentiment rankings
- Advanced Taste DNA analytics
- Annual recaps and shareable cards
- Collaborative shelves
- Full franchise-order tools
- Multiple metadata providers
- Automatic tracking integrations
- Native mobile applications
- Paid plans
- Machine-learning recommendation infrastructure
- Large public communities and full-scale moderation

## Immediate implementation sequence

1. **Implemented:** Generate complete database types and add a live deployed-schema/RLS policy contract check.
2. **Implemented:** Define repository interfaces and move `localStorage` behind a local implementation.
3. **Implemented:** Seed a development media catalog with stable local-ID-to-UUID mappings.
4. **API-accepted:** The signed-in library is initialized, and an independently authenticated client hydrates the same queue, progress, history, and Verdict state.
5. **Accepted:** Episode tracking, Verdict qualities, account isolation, cleanup, and visible optimistic rollback are verified against the production Data API. A physical second-device browser smoke remains.
6. **Implemented:** Add an explicit and idempotent migration path for existing local demo data.
7. **Implemented:** Activate and accept the secure curated-catalog TMDB adapter in production with 14 real posters, 14 real backdrops, and conditional attribution.
8. **Implemented and API-accepted:** Add and deploy the trusted search Worker, provider ID mappings, metadata cache, dynamic catalog hydration, and Discover import flow.
9. **Accepted:** Add real uncurated movies and series through the production Discover interface backed by the deployed catalog Worker.
10. **Implemented:** Make catalog search globally accessible from the header and `/`, with direct library adds and detail navigation.
11. Complete real daily-use flows before expanding social features.

## Next acceptance test

The next slice is complete when two accounts can use the production site and demonstrate all of the following:

1. Account A adds a title, moves it to Up Next, tracks an episode, and records a Verdict.
2. A refresh and second device show the same state.
3. Account B cannot read or change Account A’s private rows.
4. Failed mutations roll back visibly without losing the previous state.
5. Demo mode continues to work without Neon environment variables.

Current production evidence:

- [x] Account A initialized its cloud library.
- [x] All 12 library rows resolve through stable catalog mappings.
- [x] Tracking and Verdict writes are present with no duplicate client event IDs.
- [x] Queue hydration preserves positioned planned and watching titles while omitting final states.
- [x] A separate authenticated Account A client hydrates the same queue, progress, history, and Verdict state.
- [x] Account B reads zero Account A rows, cannot update them, and cannot forge an Account A insert.
- [x] A rejected optimistic mutation visibly restores the previous state and reports the sync error.
- [x] Demo mode continues to pass the complete test and production-build suite without Neon variables.
- [ ] A physical second-device browser session shows the same queue, progress, and Verdict state.

The disposable production acceptance run on 2026-07-17 created two real Neon Auth identities, exercised owner-scoped writes and RLS isolation, and removed the test rows, Auth identities, and cascaded profiles before reporting success.

## References

- [Neon documentation](https://neon.com/docs)
- [Neon Auth](https://neon.com/docs/neon-auth/overview)
- [Neon Data API and Row Level Security](https://neon.com/docs/guides/row-level-security)
- [TMDB API terms](https://www.themoviedb.org/api-terms-of-use)
- [TMDB attribution](https://www.themoviedb.org/about/logos-attribution)
- [Norwegian Data Protection Authority: privacy by design](https://www.datatilsynet.no/en/about-privacy/virksomhetenes-plikter/data-protection-by-design-and-by-default/)
