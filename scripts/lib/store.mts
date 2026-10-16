// Postgres (Supabase) storage for the ingestion job. Every catalog read and
// write goes through here so the SQL lives in one place.

import postgres from "postgres";
import type { Snapshot } from "../../src/lib/growth";

export type Sql = postgres.Sql;

export function connect(url: string, overrides: { max?: number } = {}): Sql {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return postgres(url, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: 4,
    idle_timeout: 20,
    ssl: local ? false : "require",
    onnotice: () => {},
    connection: { application_name: "libredex-ingest" },
    ...overrides,
  });
}

export type RepoRecord = {
  node_id: string;
  full_name: string;
  owner: string;
  owner_type: string | null;
  owner_avatar: string | null;
  name: string;
  description: string | null;
  homepage: string | null;
  stars: number;
  forks: number;
  language: string | null;
  license: string | null;
  topics: string[];
  created_at: string;
  pushed_at: string | null;
  archived: boolean;
  default_branch: string | null;
  social_image: string | null;
  seen_at: string;
};

export type StoredRepo = Omit<RepoRecord, "created_at" | "pushed_at" | "seen_at"> & {
  id: number;
  created_at: Date;
  pushed_at: Date | null;
  readme_logo: string | null;
  readme_screenshot: string | null;
};

export type MediaUpdate = { node_id: string; logo: string | null; screenshot: string | null; checked_at: string };
export type SnapshotRecord = { node_id: string; day: string; stars: number };

const REPO_COLUMNS = [
  "node_id", "full_name", "owner", "owner_type", "owner_avatar", "name", "description", "homepage", "stars", "forks",
  "language", "license", "topics", "created_at", "pushed_at", "archived", "default_branch", "social_image", "seen_at",
] as const;

export function createStore(sql: Sql) {
  return {
    /** Upserts repos and records today's star count for each. */
    async saveRepos(records: RepoRecord[], day: string) {
      // Search pages can repeat a repo; one upsert cannot touch a row twice.
      const unique = [...new Map(records.map((r) => [r.node_id, r])).values()];
      if (unique.length === 0) return;

      await sql.begin(async (tx) => {
        // tx.json marks the value as JSON so the driver encodes it exactly once.
        const rows = unique.map((r) => ({ ...r, topics: tx.json(r.topics) }));
        // A renamed or recreated repo can hold a name another node id still claims.
        await tx`
          delete from catalog.repos
          where full_name in ${tx(unique.map((r) => r.full_name))}
            and node_id not in ${tx(unique.map((r) => r.node_id))}`;
        await tx`
          insert into catalog.repos ${tx(rows, ...REPO_COLUMNS)}
          on conflict (node_id) do update set
            full_name = excluded.full_name, owner = excluded.owner, owner_type = excluded.owner_type,
            owner_avatar = excluded.owner_avatar, name = excluded.name, description = excluded.description,
            homepage = excluded.homepage, stars = excluded.stars, forks = excluded.forks,
            language = excluded.language, license = excluded.license, topics = excluded.topics,
            created_at = excluded.created_at, pushed_at = excluded.pushed_at, archived = excluded.archived,
            default_branch = excluded.default_branch, social_image = excluded.social_image, seen_at = excluded.seen_at`;
        await saveSnapshotsIn(tx, unique.map((r) => ({ node_id: r.node_id, day, stars: r.stars })));
      });
    },

    async saveSnapshots(snapshots: SnapshotRecord[]) {
      if (snapshots.length) await saveSnapshotsIn(sql, snapshots);
    },

    async saveMedia(updates: MediaUpdate[]) {
      if (updates.length === 0) return;
      await sql`
        update catalog.repos as r
        set readme_logo = v.logo, readme_screenshot = v.shot, media_checked_at = v.checked
        from unnest(
          ${sql.array(updates.map((u) => u.node_id))}::text[],
          ${sql.array(updates.map((u) => u.logo))}::text[],
          ${sql.array(updates.map((u) => u.screenshot))}::text[],
          ${sql.array(updates.map((u) => u.checked_at))}::timestamptz[]
        ) as v (node_id, logo, shot, checked)
        where r.node_id = v.node_id`;
    },

    async seedRuns(): Promise<Map<string, Date>> {
      const rows = await sql<{ seed: string; harvested_at: Date }[]>`select seed, harvested_at from catalog.seed_runs`;
      return new Map(rows.map((r) => [r.seed, r.harvested_at]));
    },

    async markSeed(seed: string, total: number, at = new Date().toISOString()) {
      await sql`
        insert into catalog.seed_runs (seed, harvested_at, total) values (${seed}, ${at}, ${total})
        on conflict (seed) do update set harvested_at = excluded.harvested_at, total = excluded.total`;
    },

    async pendingMedia(opts: { minStars: number; freshCutoff: string; freshMinStars: number; checkedBefore: string; limit: number }) {
      return sql<{ node_id: string; owner: string; name: string; default_branch: string | null }[]>`
        select node_id, owner, name, default_branch from catalog.repos
        where (stars >= ${opts.minStars} or (created_at >= ${opts.freshCutoff} and stars >= ${opts.freshMinStars}))
          and (media_checked_at is null or media_checked_at < ${opts.checkedBefore})
        order by stars desc
        limit ${opts.limit}`;
    },

    async exportRows(opts: { minStars: number; freshCutoff: string; freshMinStars: number }): Promise<StoredRepo[]> {
      // topics is read as text and parsed here, so it does not depend on the driver's jsonb parsing.
      const rows = await sql<(Omit<StoredRepo, "topics"> & { topics: string })[]>`
        select id::integer as id, node_id, full_name, owner, owner_type, owner_avatar, name, description, homepage, stars, forks,
          language, license, topics::text as topics, created_at, pushed_at, archived, default_branch, social_image,
          readme_logo, readme_screenshot
        from catalog.repos
        where not archived and (stars >= ${opts.minStars} or (created_at >= ${opts.freshCutoff} and stars >= ${opts.freshMinStars}))
        order by stars desc, full_name`;
      return rows.map((row) => ({ ...row, topics: JSON.parse(row.topics) as string[] }));
    },

    /** Snapshots since a day (YYYY-MM-DD), oldest first, keyed by repo id. */
    async snapshotsSince(day: string): Promise<Map<number, Snapshot[]>> {
      const rows = await sql<{ repo_id: number; day: string; stars: number }[]>`
        select repo_id::integer as repo_id, to_char(day, 'YYYY-MM-DD') as day, stars
        from catalog.star_snapshots where day >= ${day} order by day`;
      const map = new Map<number, Snapshot[]>();
      for (const row of rows) {
        const list = map.get(row.repo_id) ?? [];
        list.push({ day: row.day, stars: row.stars });
        map.set(row.repo_id, list);
      }
      return map;
    },

    async pruneSnapshots(beforeDay: string) {
      await sql`delete from catalog.star_snapshots where day < ${beforeDay}`;
    },
  };
}

export type Store = ReturnType<typeof createStore>;

async function saveSnapshotsIn(sql: Sql | postgres.TransactionSql, snapshots: SnapshotRecord[]) {
  await sql`
    insert into catalog.star_snapshots (repo_id, day, stars)
    select r.id, v.day, v.stars
    from unnest(
      ${sql.array(snapshots.map((s) => s.node_id))}::text[],
      ${sql.array(snapshots.map((s) => s.day))}::date[],
      ${sql.array(snapshots.map((s) => s.stars))}::integer[]
    ) as v (node_id, day, stars)
    join catalog.repos r on r.node_id = v.node_id
    on conflict (repo_id, day) do update set stars = excluded.stars`;
}
