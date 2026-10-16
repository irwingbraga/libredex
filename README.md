# Libredex

Browse and search open source projects on GitHub by platform (including AI), category, type, language and license. Results are ordered by stars, each project shows the date it started plus a screenshot or logo from its README, and a "Fresh & rising" filter surfaces new projects that are gaining stars.

Libredex runs on free resources only. The website is fully static and searches in the browser; a nightly job keeps the catalog in Supabase and republishes the site.

## How it works

```
GitHub Actions (nightly)  <->  Supabase Postgres (catalog schema: repos, star snapshots, search runs)
        |
        v  exports public/data/index.json + details shards, builds the static site
Cloudflare Pages  ->  browsers (download the index once, search and filter locally)
```

1. `scripts/ingest.mts` runs GitHub GraphQL searches (`scripts/lib/seeds.mts`): six date-window searches for repos created in the last 6 months every run, plus the topic searches from `src/lib/taxonomy.ts`, rotating so each run covers the least recently refreshed share.
2. Repos are upserted into Supabase with one star count per repo per day (`scripts/lib/store.mts`); the daily counts measure weekly growth (`src/lib/growth.ts`).
3. READMEs are fetched for new or stale repos to pick a logo and a screenshot (`src/lib/readme-media.ts`).
4. Every repo is classified into platforms, categories and a type (`src/lib/classify.ts`) and exported as a compact index plus 256 detail shards.
5. `next build` produces the static site in `out/`; the browser does the searching (`src/lib/search.ts`).

The visitors never talk to Supabase, so traffic does not count against its free tier.

## Local development

```sh
npm install
cp .env.example .env.local        # then set DATABASE_URL
npx supabase db push --db-url "$DATABASE_URL"   # first time: create the catalog schema
GITHUB_TOKEN=$(gh auth token) npm run ingest
npm run dev
```

No Supabase handy? `npm run db:local` starts a local Postgres (PGlite, no Docker) with the migrations applied; point `DATABASE_URL` at `postgres://postgres:postgres@127.0.0.1:54329/postgres`.

Useful variations:

```sh
# quick sample instead of a full harvest
GITHUB_TOKEN=$(gh auth token) SEED_LIMIT=5 MAX_PAGES=2 MEDIA_LIMIT=100 npm run ingest

# re-export the site data from the catalog without calling GitHub (after taxonomy or classifier changes)
SKIP_HARVEST=1 SKIP_MEDIA=1 npm run ingest

# copy a pre-Supabase SQLite catalog (data/libredex.db) into the database
npm run import:sqlite
```

All ingestion settings are documented at the top of `scripts/ingest.mts`. Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (static output in `out/`).

## Deployment (free)

`.github/workflows/nightly.yml` runs every night at 03:17 UTC, on manual dispatch, and on pushes to `main` (pushes only re-export and redeploy, without calling GitHub). Steps: test, apply migrations, ingest, build, deploy `out/` to Cloudflare Pages.

Repository secrets:

| Secret | What |
| --- | --- |
| `DATABASE_URL` | Supabase session pooler connection string |
| `CATALOG_GITHUB_TOKEN` | Fine-grained personal access token with public repository read access (the default `GITHUB_TOKEN` only gets 1000 GraphQL points per hour) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with the "Cloudflare Pages: Edit" permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |

One-time setup: create the Pages project with `npx wrangler pages project create libredex --production-branch main`. Keep the repository public so Actions minutes stay free.

Free tier budget: the catalog is about 20 MB of repos plus up to 45 days of star counts (well under Supabase's 500 MB); one nightly run reads and writes a few tens of MB. A free Supabase project pauses after 7 idle days, which the nightly job prevents.
