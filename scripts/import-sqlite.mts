// One-off: copies the local SQLite catalog (data/libredex.db, from before the
// Supabase switch) into the Postgres catalog, including media, star snapshots
// and seed runs. Safe to re-run: everything is an upsert.
//
// Usage: npm run import:sqlite   (reads DATABASE_URL from .env.local)

import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { connect, createStore, type RepoRecord } from "./lib/store.mts";

const SQLITE_PATH = join(import.meta.dirname, "..", "data", "libredex.db");
const CHUNK = 500;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!existsSync(SQLITE_PATH)) {
  console.error(`No SQLite catalog at ${SQLITE_PATH}`);
  process.exit(1);
}

type SqliteRepo = Omit<RepoRecord, "topics" | "archived"> & {
  topics: string;
  archived: number;
  media_checked_at: string | null;
  readme_logo: string | null;
  readme_screenshot: string | null;
};

const lite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
const sql = connect(process.env.DATABASE_URL);
const store = createStore(sql);

try {
  const repos = lite.prepare("SELECT * FROM repos").all() as SqliteRepo[];
  for (let i = 0; i < repos.length; i += CHUNK) {
    const chunk = repos.slice(i, i + CHUNK);
    // Group by the day each repo was seen so its snapshot lands on the right day.
    const byDay = new Map<string, RepoRecord[]>();
    for (const repo of chunk) {
      const day = repo.seen_at.slice(0, 10);
      const record: RepoRecord = {
        node_id: repo.node_id,
        full_name: repo.full_name,
        owner: repo.owner,
        owner_type: repo.owner_type,
        owner_avatar: repo.owner_avatar,
        name: repo.name,
        description: repo.description,
        homepage: repo.homepage,
        stars: repo.stars,
        forks: repo.forks,
        language: repo.language,
        license: repo.license,
        topics: JSON.parse(repo.topics) as string[],
        created_at: repo.created_at,
        pushed_at: repo.pushed_at,
        archived: repo.archived === 1,
        default_branch: repo.default_branch,
        social_image: repo.social_image,
        seen_at: repo.seen_at,
      };
      byDay.set(day, [...(byDay.get(day) ?? []), record]);
    }
    for (const [day, records] of byDay) await store.saveRepos(records, day);

    await store.saveMedia(
      chunk
        .filter((r) => r.media_checked_at)
        .map((r) => ({ node_id: r.node_id, logo: r.readme_logo, screenshot: r.readme_screenshot, checked_at: r.media_checked_at! })),
    );
    console.log(`repos ${Math.min(i + CHUNK, repos.length)}/${repos.length}`);
  }

  const hasTable = (name: string) => Boolean(lite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));

  if (hasTable("star_snapshots")) {
    const snapshots = lite.prepare("SELECT node_id, day, stars FROM star_snapshots").all() as { node_id: string; day: string; stars: number }[];
    for (let i = 0; i < snapshots.length; i += CHUNK * 4) await store.saveSnapshots(snapshots.slice(i, i + CHUNK * 4));
    console.log(`snapshots ${snapshots.length}`);
  }

  if (hasTable("seed_runs")) {
    const runs = lite.prepare("SELECT topic, harvested_at, total FROM seed_runs").all() as { topic: string; harvested_at: string; total: number | null }[];
    for (const run of runs) await store.markSeed(run.topic, run.total ?? 0, run.harvested_at);
    console.log(`seed runs ${runs.length}`);
  }
} finally {
  lite.close();
  await sql.end();
}
