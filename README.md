# MovieTracker

MovieTracker is a local-first movie and series journal focused on deciding what to watch, effortless episode tracking, expressive libraries, and human verdicts instead of arbitrary scores.

## Run locally

```bash
npm install
npm run dev
```

The demo uses realistic local seed data and persists changes through a browser repository. No account or API key is required.

## Backend foundation

The invite-only beta foundation uses Neon Auth, Neon Postgres, and the Neon Data API. Until both public Neon URLs are configured, the app remains explicitly in browser-only demo mode.

1. Create a Neon project, then enable Neon Auth and the Data API for its development branch.
2. Copy `.env.example` to `.env.local`. Add the Auth URL, Data API URL, and the pooled `DATABASE_URL` from the Neon Console.
3. Apply the versioned migration:

```bash
npm run db:migrate
```

Verify the deployed schema and authorization contract with:

```bash
npm run db:verify
```

The migration creates the domain tables, profile synchronization trigger, indexes, and Row Level Security policies. It also records checksums so an applied migration cannot be silently rewritten. Enable the Data API only with JWT authentication through Neon Auth, and run Neon’s Data API Advisor before using real accounts.

For production account isolation, run `$env:ACCEPTANCE_CREATE_EPHEMERAL='true'; npm run db:acceptance` in PowerShell to create two one-run Neon Auth users, exercise the real Data API, and delete both identities afterward. Alternatively, add two dedicated accounts to the four `ACCEPTANCE_ACCOUNT_*` variables in the gitignored `.env.local`, then run `npm run db:acceptance`. The harness writes queue/progress/history/Verdict data as Account A, hydrates it through a separate client, proves Account B cannot read or change it, and restores or deletes every acceptance row in a `finally` cleanup. It never prints generated credentials, configured credentials, email addresses, or user IDs.

For GitHub Pages, add `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL` as Actions variables. Repository variables under **Settings → Secrets and variables → Actions → Variables** are preferred; variables scoped to the `github-pages` environment are also supported. The deployment intentionally fails when either value is missing so it cannot silently publish demo mode. Add the local and deployed URLs to Neon Auth’s allowed origins. `DATABASE_URL` is server-only and must never be added to GitHub Pages or prefixed with `VITE_`.

Public registration is intentionally absent from the app. Beta users should be provisioned through a trusted administrative flow, and sign-up must remain disabled in the Neon Auth configuration.

When a signed-in account has no initialized cloud library, MovieTracker does not copy browser data automatically. Open **Account & Data** and choose **Copy library to Neon**. The import is idempotent and records completion only after every row succeeds, so an interrupted copy can be retried safely. Subsequent library, queue, tracking, undo, and title-level Verdict changes use the authenticated Data API with optimistic rollback and stale-write rejection.

## Real TMDB artwork

The curated 14-title catalog can be enriched with real posters, backdrops, synopsis, runtime, year, and genres from TMDB without exposing the provider token to the browser. Local development retains an explicit Unsplash demonstration fallback; production deployment requires TMDB configuration so it cannot silently publish demo artwork.

1. Create or sign in to a TMDB account and request API access from the API section of account settings.
2. Copy the **API Read Access Token**, not a user session token.
3. For local development, add it to the gitignored `.env.local` file:

```dotenv
TMDB_READ_ACCESS_TOKEN=your-read-access-token
```

4. Generate the catalog and start the app:

```bash
npm run catalog:sync
npm run dev
```

For production, add `TMDB_READ_ACCESS_TOKEN` as a GitHub **Actions secret** under **Settings → Secrets and variables → Actions → Secrets**. Re-run the Pages workflow or push a commit. The workflow fetches TMDB on the trusted build runner and publishes only public metadata and image URLs. Never prefix this token with `VITE_` or add it as a GitHub variable.

The Pages workflow validates this secret before installing dependencies. If the configuration step fails, confirm the name is exactly `TMDB_READ_ACCESS_TOKEN` and that it was created as a repository or `github-pages` environment secret rather than as an Actions variable.

The source mapping lives in `catalog/tmdb-seeds.json`; generated browser-safe metadata lives in `src/generated/tmdbCatalog.ts`. Missing images or provider failures retain the local fallback. The Profile page shows the required TMDB attribution whenever generated TMDB data is present.

## Whole-catalog search

Movie and series search is available from the global header search (`/`) and the Discover page through a Cloudflare Worker in `worker/`. Results can be added directly to the current user's library. The Worker keeps `TMDB_READ_ACCESS_TOKEN` and `DATABASE_URL` encrypted outside the browser, applies separate search/import rate limits, caches searches at the edge, stores normalized titles in `public.media`, and keeps raw provider responses in browser-inaccessible Neon cache tables.

The fourth migration must be applied before deploying the Worker:

```bash
npm run db:migrate
npm run db:verify
```

For local Worker development, copy `worker/.dev.vars.example` to the gitignored `worker/.dev.vars`, then run:

```bash
npm run worker:dev
```

For production:

1. Create a Cloudflare account and a Workers API token.
2. Create a GitHub environment named `catalog-worker` with `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `TMDB_READ_ACCESS_TOKEN`, and `DATABASE_URL` as secrets.
3. Run the **Deploy catalog Worker** workflow and copy its `workers.dev` URL.
4. Add that URL as the public GitHub Actions variable `VITE_CATALOG_API_URL`.
5. Re-run the Pages deployment. The header and Discover page expose real search only when this public endpoint is configured.

The Worker configuration is the source of truth for allowed origins and required secrets. Never place either private credential in `VITE_CATALOG_API_URL` or any other browser variable. See the official [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), and [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) documentation.

The current production Worker is `https://movie-tracker-catalog.fabrykjoh12.workers.dev`. Its live acceptance verifies real TMDB results and artwork plus edge and Neon metadata-cache reuse. The public URL is configured through the repository-level `VITE_CATALOG_API_URL` Actions variable; private TMDB and database credentials remain Cloudflare secrets.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run worker:check
npm run build
```

Demo artwork is served from Unsplash and is used as editorial stand-in imagery; the architecture keeps artwork URLs replaceable by a licensed metadata provider.
