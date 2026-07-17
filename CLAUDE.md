# MovieTracker Agent Handoff

## Read this first

MovieTracker is a premium movie and series journal built around four connected experiences: Tonight, Next Up, My Library, and My Taste. The product promise is: “Find something worth watching. Track it effortlessly. Build a library that feels like you.” The working tagline is “Your life in stories.”

The current application is a polished, responsive React prototype with real Neon authentication and a production database foundation. Media discovery, shelves, social activity, and recommendations still use realistic seed data. Authenticated library, queue, tracking, undo, and title-level Verdict persistence are implemented through Neon, but must not be described as production-verified cross-device synchronization until the acceptance test in `roadmap.md` passes.

Read `README.md` and `roadmap.md` before changing architecture or scope.

## Repository and deployment

- Repository: `https://github.com/fabrykjoh12/MovieTracker`
- Default branch: `main`
- Live site: `https://fabrykjoh12.github.io/MovieTracker/`
- Live account route: `https://fabrykjoh12.github.io/MovieTracker/#/account`
- Vite base path: `/MovieTracker/`
- Production deployment: `.github/workflows/deploy-pages.yml`
- The Pages workflow validates, builds, and deploys on pushes to `main`.
- The workflow intentionally fails if either public Neon URL is missing, preventing a silent demo-mode deployment.
- A successful production deployment was verified on 2026-07-17. Workflow run `29544020043` completed successfully, the public page returned HTTP 200, and the live bundle contained both the Neon Auth configuration and password flow.

## Stack

- React 19
- Vite 8
- TypeScript 6 with strict project settings
- React Router 7 with `HashRouter`, required for GitHub Pages
- Vitest, Testing Library, and jsdom
- ESLint 10 and Prettier 3
- Neon Postgres, Neon Auth, and Neon Data API
- `@neondatabase/neon-js` for browser-safe Auth and Data API access
- `pg` only for the trusted local migration runner
- CSS design system in `src/styles.css`; there is no Tailwind dependency

## Commands

```bash
npm install
npm run dev
npm run db:migrate
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

Local development runs at `http://localhost:4173/MovieTracker/`. The account route is `http://localhost:4173/MovieTracker/#/account`.

## Environment and secrets

Copy `.env.example` to `.env.local`. The local file contains:

- `VITE_NEON_AUTH_URL`: public browser Auth endpoint
- `VITE_NEON_DATA_API_URL`: public browser Data API endpoint
- `DATABASE_URL`: private pooled Postgres connection string used only by migrations

`.env.local` is gitignored. Never print, paste, commit, or expose `DATABASE_URL`. Never add it to GitHub Pages and never prefix it with `VITE_`.

GitHub Actions reads the two public `VITE_` values from Actions variables. Repository variables are preferred; variables scoped to the `github-pages` environment are also supported.

## Backend status

Neon is configured on the `production` branch. All three migrations in `neon/migrations` have been applied and recorded by the checksum-aware runner in `scripts/migrate.mjs`. The second migration adds a stable 14-title development catalog with explicit `metadata.localId` mappings. The third adds `profiles.library_initialized_at`, a durable marker that distinguishes a completed first sync from a partial import.

The live database audit completed with:

- 19 public tables
- Row Level Security enabled on all 19 tables
- 41 RLS policies
- UUID-compatible Neon Auth foreign keys
- An automatic profile trigger and a successful backfill for the existing Auth user
- Authenticated schema and table privileges available to the Data API role

The initial schema supports profiles, beta invites, media, seasons, episodes, library state, watch events, Verdicts, pairwise comparisons, shelves, friendships, activities, spoiler-scoped reviews, Watch Together rooms, participants, candidates, and votes.

`src/lib/database.types.ts` is generated from the deployed schema and covers all public tables, relationships, and enums. Regenerate it after schema migrations; do not hand-maintain a partial substitute.

## Authentication status

Implemented:

- Explicit browser-only demo mode when Neon URLs are unavailable
- Session restoration and refresh
- Email/password sign-in and sign-out
- Password setup and reset email flow
- Reset-token handling that works with GitHub Pages hash routing
- Account status in the application shell
- Interaction tests for requesting and completing a password reset

Important limitation: the app does not expose public registration, but the current Neon Auth Beta does not provide reliable restricted-signup enforcement. A determined caller may still reach the signup endpoint. Add a server-side allowlist, Auth webhook validation, or another trusted invitation gate before an invite-only public beta.

## Current data flow

`src/store.tsx` remains the application state source, but persistence is now behind repositories. Demo and signed-out sessions use `src/repositories/localStateRepository.ts`. Signed-in sessions use `src/repositories/neonLibraryRepository.ts` after Neon library data exists.

For an uninitialized cloud library, the app deliberately leaves the browser library untouched and shows **Copy library to Neon** on the Account page. That import uses stable catalog mappings and client event IDs so it is safe to retry. The durable profile marker is written only after every state, Verdict, and watch event succeeds; an interrupted import stays in setup mode and offers **Retry library copy**. It preserves coarse historical watch dates in private intent metadata and does not silently copy data merely because someone signs in.

After first sync, library state, queue order, exact numeric series progress, watch events, undo removal, title-level Verdicts, qualities, tags, and rankings are sent through the authenticated Neon Data API. Mutations apply optimistically in a serialized queue. Updates and deletes include the last observed `updated_at`, so a stale device cannot overwrite a newer row; conflicts reload the latest cloud state and show a visible error. Other failures roll back the latest optimistic mutation, while ambiguous concurrent failure triggers a cloud reload. Cloud-owned library data is not written into the generic signed-out demo cache.

Repository and mapping unit tests exist, and `npm run db:verify` checks the deployed table/RLS contract. The two-account runtime isolation test still needs test credentials or a second provisioned beta account.

## Next vertical slice

Complete production acceptance for the implemented cross-device library flow before expanding metadata or social features:

1. Load the signed-in profile and library.
2. Add a title to the library.
3. Move it to Up Next.
4. Persist exact episode progress and the undo event.
5. Persist a Verdict and up to three qualities.
6. Refresh and confirm the state returns from Neon.
7. Sign in on a second browser/device and confirm synchronization.
8. Verify another account cannot read or mutate the first account’s data.

Add unit tests for mapping and repository behavior plus live integration tests for RLS. Keep provider metadata writes on a trusted server boundary; the browser must not receive privileged database credentials.

## Important files

- `src/App.tsx`: routing and provider composition
- `src/store.tsx`: optimistic state, repository selection, hydration, and first-sync coordination
- `src/domain.ts`: core domain behavior
- `src/domain.test.ts`: domain tests
- `src/data.ts`: realistic demo catalog and activity
- `src/auth/AuthProvider.tsx`: Neon Auth session and password actions
- `src/lib/neon.ts`: lazy Neon client configuration
- `src/lib/database.types.ts`: complete generated public-schema types
- `src/repositories/contracts.ts`: repository boundaries
- `src/repositories/localStateRepository.ts`: browser-only demo persistence
- `src/repositories/neonLibraryRepository.ts`: authenticated library, tracking, and Verdict persistence
- `src/repositories/mappers.ts`: database row to domain-state mapping
- `src/pages/Account.tsx`: account, sign-in, and password-reset UI
- `src/pages/Account.test.tsx`: password flow interactions
- `neon/migrations/202607170001_initial_beta_schema.sql`: production schema and policies
- `neon/migrations/202607170002_seed_development_catalog.sql`: stable beta catalog mapping
- `neon/migrations/202607170003_library_sync_foundation.sql`: durable first-sync marker
- `scripts/migrate.mjs`: transactional checksum-aware migration runner
- `scripts/verify-database.mjs`: live schema and RLS contract verification
- `.github/workflows/deploy-pages.yml`: validation and Pages deployment
- `roadmap.md`: source of truth for product sequencing

## Product and engineering guardrails

- Preserve the premium editorial design; do not turn the app into a generic dashboard or poster database.
- Movies and series remain part of one product and one library.
- Verdict is the primary rating interaction; numeric ratings are optional compatibility views.
- Recommendations need concrete explanations, not invented percentages.
- Spoiler visibility must be filtered by data access and progress, not merely blurred after loading.
- Keep permanent UI borders, glass effects, gradients, glow, and identical rounded cards restrained.
- Maintain semantic HTML, keyboard access, touch targets, visible focus, AA contrast, and reduced-motion behavior.
- Do not add shallow versions of later social features before the authenticated library slice is reliable.
- Keep third-party provider credentials behind a server-side adapter.
- Do not claim an integration is live when it still uses demo data.

## Validation baseline

The last full local validation completed successfully with:

- Prettier
- ESLint
- TypeScript type checking
- 31 Vitest tests across six files
- Vite production build
- `npm audit --audit-level=moderate` with zero vulnerabilities
- Repeat migration returning `Already applied`
- `git diff --check`

The in-editor browser runtime was unavailable during the last session. Production was verified through the GitHub Actions API and direct HTTP/bundle inspection. Perform a real browser review when a browser runtime is available.

## Git workflow preference

- Inspect `git status` before edits and preserve unrelated user work.
- Use the editor’s `developer_git_commit_proposal` workflow for commits; do not run `git commit` directly.
- Include every uncommitted session-edited file in the proposal after cross-checking session files with `git status`.
- After the user approves a commit proposal, push it to `origin` automatically. The user explicitly does not want to be asked to run `git push`.
- Monitor the resulting Pages workflow and verify the live bundle when deployment-related files change.
- Do not mark the overall product complete: authentication, the database foundation, and the first cloud-library implementation are working, but cross-device and two-account isolation acceptance are still pending.
