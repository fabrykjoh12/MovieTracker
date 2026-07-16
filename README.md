# MovieTracker

MovieTracker is a local-first movie and series journal focused on deciding what to watch, effortless episode tracking, expressive libraries, and human verdicts instead of arbitrary scores.

## Run locally

```bash
npm install
npm run dev
```

The demo uses realistic local seed data and persists changes in `localStorage`. No account or API key is required.

## Backend foundation

The invite-only beta foundation uses Neon Auth, Neon Postgres, and the Neon Data API. Until both public Neon URLs are configured, the app remains explicitly in browser-only demo mode.

1. Create a Neon project, then enable Neon Auth and the Data API for its development branch.
2. Copy `.env.example` to `.env.local`. Add the Auth URL, Data API URL, and the pooled `DATABASE_URL` from the Neon Console.
3. Apply the versioned migration:

```bash
npm run db:migrate
```

The migration creates the domain tables, profile synchronization trigger, indexes, and Row Level Security policies. It also records checksums so an applied migration cannot be silently rewritten. Enable the Data API only with JWT authentication through Neon Auth, and run Neon’s Data API Advisor before using real accounts.

For GitHub Pages, add `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL` as repository variables under **Settings → Secrets and variables → Actions → Variables**. Add the local and deployed URLs to Neon Auth’s allowed origins. `DATABASE_URL` is server-only and must never be added to GitHub Pages or prefixed with `VITE_`.

Public registration is intentionally absent from the app. Beta users should be provisioned through a trusted administrative flow, and sign-up must remain disabled in the Neon Auth configuration.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Demo artwork is served from Unsplash and is used as editorial stand-in imagery; the architecture keeps artwork URLs replaceable by a licensed metadata provider.
