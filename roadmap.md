# MovieTracker Roadmap

## Goal

Turn the current local-first demonstration into a trustworthy invite-only beta for a small group of friends.

The beta is ready when an invited user can sign in, find real media, maintain a private library across devices, track episodes and rewatches, record Verdicts, organize shelves, interact with friends without spoilers, and export or delete their data.

## Current state

The deployed application is a polished interactive prototype. Core tracking, Verdict, queue ordering, Tonight filters, and several library views work, but application data currently comes from local seed data and is persisted only in browser `localStorage`.

The following areas are demonstrations rather than production integrations:

- Accounts and profiles
- Cross-device persistence
- Media search and metadata
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
- [ ] Configure environment variables in local development and GitHub Pages.
- [x] Add authentication state management.
- [x] Add invited-account email/password sign-in and sign-out actions.
- [ ] Add invite-only registration enforcement.
- [ ] Configure allowed origins and the production domain in Neon Auth.

### Database and authorization

- [x] Add versioned SQL migrations for the initial domain model.
- [x] Add primary foreign-key and query indexes.
- [x] Enable Row Level Security on exposed tables.
- [x] Add initial owner, friendship, shelf, spoiler, and room policies.
- [ ] Generate database TypeScript types from the deployed schema.
- [ ] Add automated database and RLS policy tests.
- [ ] Add development seed data that is separate from production.

### Data access

- [ ] Define repository interfaces for profiles, libraries, tracking, Verdicts, shelves, and social data.
- [ ] Add Neon Data API repository implementations.
- [ ] Move direct `localStorage` access behind a local repository.
- [ ] Hydrate authenticated application state from the database.
- [ ] Add optimistic updates with rollback and conflict handling.
- [ ] Add a migration path for existing local demo data.

### Phase 1 exit gate

Two invited accounts can sign in on multiple devices. Each account sees only its own private library, and updates synchronize without data loss.

## Phase 2 — Real metadata and search

- [ ] Register and approve the metadata-provider integration.
- [ ] Add a server-side metadata proxy so provider credentials never reach the browser.
- [ ] Add provider ID mapping and metadata cache tables.
- [ ] Implement movie, series, season, episode, person, and creator search.
- [ ] Replace demo posters and backdrops with provider artwork.
- [ ] Add Norwegian streaming-provider availability.
- [ ] Add TMDB attribution and provider notices.
- [ ] Handle missing artwork, runtimes, seasons, translations, and release dates.
- [ ] Add cache refresh rules and provider-failure fallbacks.

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

1. Finish Neon Auth and Data API configuration and deploy the initial migration.
2. Generate database types and test all RLS policies.
3. Add repository interfaces and authenticated library persistence.
4. Replace seeded media with a server-side metadata adapter.
5. Complete the real daily-use flows before expanding social features.

## References

- [Neon documentation](https://neon.com/docs)
- [Neon Auth](https://neon.com/docs/neon-auth/overview)
- [Neon Data API and Row Level Security](https://neon.com/docs/guides/row-level-security)
- [TMDB API terms](https://www.themoviedb.org/api-terms-of-use)
- [TMDB attribution](https://www.themoviedb.org/about/logos-attribution)
- [Norwegian Data Protection Authority: privacy by design](https://www.datatilsynet.no/en/about-privacy/virksomhetenes-plikter/data-protection-by-design-and-by-default/)
