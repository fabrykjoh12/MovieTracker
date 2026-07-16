# MovieTracker

MovieTracker is a local-first movie and series journal focused on deciding what to watch, effortless episode tracking, expressive libraries, and human verdicts instead of arbitrary scores.

## Run locally

```bash
npm install
npm run dev
```

The demo uses realistic local seed data and persists changes in `localStorage`. No account or API key is required.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Demo artwork is served from Unsplash and is used as editorial stand-in imagery; the architecture keeps artwork URLs replaceable by a licensed metadata provider.
