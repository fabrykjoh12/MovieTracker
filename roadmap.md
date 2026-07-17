# MovieTracker Roadmap

## Goal

Turn the current local-first demonstration into a trustworthy invite-only beta for a small group of friends.

The beta is ready when an invited user can sign in, find real media, maintain a private library across devices, track episodes and rewatches, record Verdicts, organize shelves, interact with friends without spoilers, and export or delete their data.

## Current state

The deployed application is a polished interactive prototype with working Neon authentication and a production database foundation. Demo mode remains local-first. The repository now contains the first Neon library synchronization path, including an explicit, idempotent browser-to-cloud import; production account and cross-device acceptance are still pending.

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
- The rate-limited catalog Worker is live at `https://movie-tracker-catalog.fabrykjoh12.workers.dev`, with only `TMDB_READ_ACCESS_TOKEN` and `DATABASE_URL` stored as Cloudflare secrets. Live acceptance verified real TMDB search and artwork, first import into Neon, edge-cache reuse, and Neon-cache reuse.

The following areas are demonstrations rather than production integrations:

- Profile content beyond the authenticated identity
- Cross-device persistence has not completed its two-device production acceptance test.
- Streaming availability
- Friend relationships and activity
- Watch Together synchronization
- Notifications and sharing
- Backups, monitoring, privacy controls, and moderation

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
- [ ] Add authenticated two-account RLS integration tests.
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
- [ ] Complete refresh, second-device, and second-account isolation acceptance.

### Phase 1 exit gate

Two invited accounts can sign in on multiple devices. Each account sees only its own private library, and updates synchronize without data loss.

## Phase 2 — Real metadata and search

- [x] Register and approve the metadata-provider integration.
- [x] Add stable TMDB provider mappings for the curated beta catalog.
- [x] Add a server/build-only TMDB sync that never exposes the read token to the browser.
- [x] Add provider-failure and incomplete-artwork fallbacks plus conditional TMDB attribution.
- [x] Add a rate-limited server-side metadata proxy so provider credentials never reach the browser.
- [x] Add provider ID mapping and browser-inaccessible metadata cache tables.
- [x] Implement movie and series search with normalized library import.
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

- [ ] Implement or remove every inactive control.
- [ ] Add loading, error, offline, expired-session, and rollback states.
- [ ] Add import and export for personal backup.

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
- [ ] Add account export and deletion.
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
4. **Partially accepted:** The signed-in browser library is initialized and its database integrity is verified. Refresh and second-device synchronization remain.
5. **Acceptance next:** Verify episode tracking, undo history, Verdicts, qualities, and optimistic rollback against the production Data API.
6. **Implemented:** Add an explicit and idempotent migration path for existing local demo data.
7. **Implemented:** Activate and accept the secure curated-catalog TMDB adapter in production with 14 real posters, 14 real backdrops, and conditional attribution.
8. **Implemented and API-accepted:** Add and deploy the trusted search Worker, provider ID mappings, metadata cache, dynamic catalog hydration, and Discover import flow.
9. **Next acceptance:** Add a real uncurated movie and series through the production Discover interface after the Pages build receives `VITE_CATALOG_API_URL`.
10. Complete real daily-use flows before expanding social features.

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
- [ ] A refresh and second device show the same queue, progress, and Verdict state.
- [ ] Account B cannot read or change Account A’s rows.

## References

- [Neon documentation](https://neon.com/docs)
- [Neon Auth](https://neon.com/docs/neon-auth/overview)
- [Neon Data API and Row Level Security](https://neon.com/docs/guides/row-level-security)
- [TMDB API terms](https://www.themoviedb.org/api-terms-of-use)
- [TMDB attribution](https://www.themoviedb.org/about/logos-attribution)
- [Norwegian Data Protection Authority: privacy by design](https://www.datatilsynet.no/en/about-privacy/virksomhetenes-plikter/data-protection-by-design-and-by-default/)
