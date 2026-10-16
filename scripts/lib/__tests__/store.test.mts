import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, createStore, type RepoRecord, type Sql, type Store } from "../store.mts";

let db: PGlite;
let server: PGLiteSocketServer;
let sql: Sql;
let store: Store;

const repo = (name: string, stars: number, extra: Partial<RepoRecord> = {}): RepoRecord => ({
  node_id: `N_${name}`,
  full_name: `acme/${name}`,
  owner: "acme",
  owner_type: "Organization",
  owner_avatar: null,
  name,
  description: `${name} app`,
  homepage: null,
  stars,
  forks: 1,
  language: "Go",
  license: "MIT",
  topics: ["cli", "go"],
  created_at: "2026-09-01T00:00:00Z",
  pushed_at: "2026-10-01T00:00:00Z",
  archived: false,
  default_branch: "main",
  social_image: null,
  seen_at: "2026-10-16T00:00:00Z",
  ...extra,
});

beforeAll(async () => {
  db = await PGlite.create();
  // Supabase roles the migration revokes from.
  await db.exec("create role anon; create role authenticated;");
  await db.exec(readFileSync(join(import.meta.dirname, "../../../supabase/migrations/20261016120000_catalog.sql"), "utf8"));
  const port = 55000 + Math.floor(Math.random() * 1000);
  server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();
  sql = connect(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`, { max: 1 });
  store = createStore(sql);
});

afterAll(async () => {
  await sql?.end();
  await server?.stop();
  await db?.close();
});

describe("store", () => {
  it("upserts repos with a daily snapshot", async () => {
    await store.saveRepos([repo("alpha", 100), repo("beta", 50), repo("alpha", 100)], "2026-10-15");
    await store.saveRepos([repo("alpha", 140, { description: "updated" })], "2026-10-16");

    const rows = await store.exportRows({ minStars: 0, freshCutoff: "2026-01-01", freshMinStars: 0 });
    expect(rows.map((r) => [r.full_name, r.stars, r.description])).toEqual([
      ["acme/alpha", 140, "updated"],
      ["acme/beta", 50, "beta app"],
    ]);
    expect(rows[0].topics).toEqual(["cli", "go"]);
    const [{ kind }] = await sql`select jsonb_typeof(topics) as kind from catalog.repos limit 1`;
    expect(kind).toBe("array");
    expect(rows[0].created_at).toBeInstanceOf(Date);

    const snaps = await store.snapshotsSince("2026-10-01");
    expect(snaps.get(rows[0].id)).toEqual([
      { day: "2026-10-15", stars: 100 },
      { day: "2026-10-16", stars: 140 },
    ]);
  });

  it("drops a stale row when another node takes over a name", async () => {
    await store.saveRepos([repo("beta", 70, { node_id: "N_beta_new" })], "2026-10-16");
    const rows = await store.exportRows({ minStars: 0, freshCutoff: "2026-01-01", freshMinStars: 0 });
    expect(rows.filter((r) => r.full_name === "acme/beta").map((r) => r.node_id)).toEqual(["N_beta_new"]);
  });

  it("tracks media and seed runs", async () => {
    let pending = await store.pendingMedia({ minStars: 0, freshCutoff: "2026-01-01", freshMinStars: 0, checkedBefore: "2026-10-01", limit: 10 });
    expect(pending.map((p) => p.name)).toEqual(["alpha", "beta"]);

    await store.saveMedia([{ node_id: "N_alpha", logo: "https://x/logo.png", screenshot: null, checked_at: "2026-10-16T00:00:00Z" }]);
    pending = await store.pendingMedia({ minStars: 0, freshCutoff: "2026-01-01", freshMinStars: 0, checkedBefore: "2026-10-01", limit: 10 });
    expect(pending.map((p) => p.name)).toEqual(["beta"]);
    const [alpha] = await store.exportRows({ minStars: 100, freshCutoff: "2027-01-01", freshMinStars: 0 });
    expect(alpha.readme_logo).toBe("https://x/logo.png");

    await store.markSeed("topic:cli", 42, "2026-10-16T01:00:00Z");
    await store.markSeed("topic:cli", 43, "2026-10-16T02:00:00Z");
    expect((await store.seedRuns()).get("topic:cli")?.toISOString()).toBe("2026-10-16T02:00:00.000Z");
  });

  it("prunes old snapshots", async () => {
    await store.pruneSnapshots("2026-10-16");
    const [alpha] = await store.exportRows({ minStars: 100, freshCutoff: "2027-01-01", freshMinStars: 0 });
    expect((await store.snapshotsSince("2026-01-01")).get(alpha.id)).toEqual([{ day: "2026-10-16", stars: 140 }]);
  });
});
