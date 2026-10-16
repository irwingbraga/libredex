// Harvests GitHub repositories into the Supabase catalog, fetches README media,
// then exports the static search index into public/data.
//
// Usage: npm run ingest   (reads DATABASE_URL from .env.local; GITHUB_TOKEN=$(gh auth token) for GitHub calls)
// Env:
//   DATABASE_URL       Postgres connection string (Supabase session pooler)
//   GITHUB_TOKEN       token for the GitHub GraphQL API, not needed with SKIP_HARVEST=1 SKIP_MEDIA=1
//   MIN_STARS          minimum stars to include (default 100)
//   PAGE_SIZE          results per search page (default 50; 100 often times out)
//   MAX_PAGES          pages per topic search (default: up to GitHub's 1000 result cap)
//   SEED_LIMIT         only consider the first N topic seeds, for quick local runs
//   TOPIC_SHARE        share of topic searches to run this time, oldest first (default 1; the nightly job uses 0.34)
//   FRESH_DAYS         repos created within this many days get dedicated searches (default 180)
//   FRESH_MIN_STARS    minimum stars for those fresh repos (default 30)
//   MEDIA_LIMIT        max READMEs to fetch this run (default 5000)
//   MEDIA_TTL_DAYS     refetch README media older than this (default 30)
//   LIBRARY_MIN_STARS  libraries need this many stars to be exported (default 1000)
//   CONCURRENCY        parallel GitHub requests (default 3; more trips secondary rate limits)
//   HARVEST_TTL_HOURS  skip searches that ran more recently than this (default 20), makes runs resumable
//   SKIP_HARVEST=1 / SKIP_MEDIA=1 / SKIP_EXPORT=1 to run only part of the pipeline

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classify } from "../src/lib/classify";
import { weeklyGrowth } from "../src/lib/growth";
import {
  DAY_MS,
  DETAIL_SHARDS,
  INDEX_VERSION,
  compressUrl,
  shardOf,
  type IndexRow,
  type RepoDetails,
  type SearchIndex,
} from "../src/lib/index-format";
import { pickReadmeMedia } from "../src/lib/readme-media";
import { CATEGORIES, KINDS, PLATFORMS, SEED_TOPICS } from "../src/lib/taxonomy";
import { buildSeeds, pickSeeds } from "./lib/seeds.mts";
import { connect, createStore, type MediaUpdate, type RepoRecord } from "./lib/store.mts";

const env = (name: string, fallback: number) => Number(process.env[name] ?? fallback);
const MIN_STARS = env("MIN_STARS", 100);
const PAGE_SIZE = env("PAGE_SIZE", 50);
const MAX_PAGES = env("MAX_PAGES", 1000 / PAGE_SIZE);
const SEED_LIMIT = env("SEED_LIMIT", Infinity);
const TOPIC_SHARE = env("TOPIC_SHARE", 1);
const MEDIA_LIMIT = env("MEDIA_LIMIT", 5000);
const MEDIA_TTL_DAYS = env("MEDIA_TTL_DAYS", 30);
const LIBRARY_MIN_STARS = env("LIBRARY_MIN_STARS", 1000);
const CONCURRENCY = env("CONCURRENCY", 3);
const HARVEST_TTL_HOURS = env("HARVEST_TTL_HOURS", 20);
const FRESH_DAYS = env("FRESH_DAYS", 180);
const FRESH_MIN_STARS = env("FRESH_MIN_STARS", 30);
const SNAPSHOT_KEEP_DAYS = 45;

const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
const FRESH_CUTOFF = new Date(NOW.getTime() - FRESH_DAYS * DAY_MS).toISOString();
const dayOffset = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString().slice(0, 10);

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "public", "data");

const needsGithub = !process.env.SKIP_HARVEST || !process.env.SKIP_MEDIA;
const token = process.env.GITHUB_TOKEN;
if (needsGithub && !token) {
  console.error("GITHUB_TOKEN is required to call GitHub (locally: GITHUB_TOKEN=$(gh auth token) npm run ingest)");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (Supabase session pooler connection string, in .env.local locally)");
  process.exit(1);
}

const sql = connect(process.env.DATABASE_URL);
const store = createStore(sql);

// Runs async jobs with bounded parallelism.
async function pool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
}

// ---------------------------------------------------------------- GitHub

type GraphQLResponse<T> = { data?: T; errors?: { message: string; type?: string }[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function graphql<T>(query: string, variables: Record<string, unknown> = {}, attempt = 1): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "libredex-ingest" },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
    const retryAfter = Number(res.headers.get("retry-after") ?? 0) * 1000;
    const wait = Math.max(retryAfter, reset - Date.now(), 30_000);
    console.warn(`  rate limited, waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return graphql(query, variables, attempt);
  }
  if (res.status >= 500 && attempt < 5) {
    await sleep(2000 * attempt);
    return graphql(query, variables, attempt + 1);
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);

  let body: GraphQLResponse<T>;
  try {
    body = (await res.json()) as GraphQLResponse<T>;
  } catch (error) {
    // GitHub occasionally truncates large search responses.
    if (attempt >= 5) throw error;
    await sleep(2000 * attempt);
    return graphql(query, variables, attempt + 1);
  }
  if (body.errors?.length && !body.data) {
    if (attempt < 5) {
      await sleep(2000 * attempt);
      return graphql(query, variables, attempt + 1);
    }
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data as T;
}

const REPO_FIELDS = `
  id
  nameWithOwner
  name
  owner { login __typename avatarUrl }
  description
  homepageUrl
  stargazerCount
  forkCount
  primaryLanguage { name }
  licenseInfo { spdxId name }
  repositoryTopics(first: 20) { nodes { topic { name } } }
  createdAt
  pushedAt
  isArchived
  isFork
  defaultBranchRef { name }
  usesCustomOpenGraphImage
  openGraphImageUrl
`;

type RepoNode = {
  id: string;
  nameWithOwner: string;
  name: string;
  owner: { login: string; __typename: string; avatarUrl: string };
  description: string | null;
  homepageUrl: string | null;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string } | null;
  licenseInfo: { spdxId: string; name: string } | null;
  repositoryTopics: { nodes: { topic: { name: string } }[] };
  createdAt: string;
  pushedAt: string | null;
  isArchived: boolean;
  isFork: boolean;
  defaultBranchRef: { name: string } | null;
  usesCustomOpenGraphImage: boolean;
  openGraphImageUrl: string;
};

function toRecord(node: RepoNode, seenAt: string): RepoRecord {
  return {
    node_id: node.id,
    full_name: node.nameWithOwner,
    owner: node.owner.login,
    owner_type: node.owner.__typename,
    owner_avatar: node.owner.avatarUrl,
    name: node.name,
    description: node.description,
    homepage: node.homepageUrl || null,
    stars: node.stargazerCount,
    forks: node.forkCount,
    language: node.primaryLanguage?.name ?? null,
    license: node.licenseInfo && node.licenseInfo.spdxId !== "NOASSERTION" ? node.licenseInfo.spdxId : null,
    topics: node.repositoryTopics.nodes.map((n) => n.topic.name),
    created_at: node.createdAt,
    pushed_at: node.pushedAt,
    archived: node.isArchived,
    default_branch: node.defaultBranchRef?.name ?? null,
    social_image: node.usesCustomOpenGraphImage ? node.openGraphImageUrl : null,
    seen_at: seenAt,
  };
}

// ---------------------------------------------------------------- harvest

async function harvest() {
  const seeds = buildSeeds({
    now: NOW,
    topics: SEED_TOPICS.slice(0, SEED_LIMIT),
    minStars: MIN_STARS,
    freshDays: FRESH_DAYS,
    freshMinStars: FRESH_MIN_STARS,
  });
  const todo = pickSeeds(seeds, await store.seedRuns(), { now: NOW, ttlHours: HARVEST_TTL_HOURS, topicShare: TOPIC_SHARE });
  console.log(`Harvest: ${todo.length} of ${seeds.length} searches this run`);

  const seenAt = NOW.toISOString();
  const query = `query($q: String!, $after: String, $first: Int!) {
    rateLimit { remaining resetAt }
    search(query: $q, type: REPOSITORY, first: $first, after: $after) {
      repositoryCount
      pageInfo { hasNextPage endCursor }
      nodes { ... on Repository { ${REPO_FIELDS} } }
    }
  }`;

  await pool(todo, async (seed, i) => {
    // Fresh windows always go to the 1000 result cap; MAX_PAGES only limits topic seeds.
    const maxPages = seed.fresh ? Math.ceil(1000 / PAGE_SIZE) : MAX_PAGES;
    let after: string | null = null;
    let total = 0;
    let saved = 0;
    for (let page = 0; page < maxPages; page++) {
      type Result = {
        rateLimit: { remaining: number; resetAt: string };
        search: { repositoryCount: number; pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: RepoNode[] };
      };
      const data: Result = await graphql<Result>(query, { q: seed.query, after, first: PAGE_SIZE });
      total = data.search.repositoryCount;
      const records = data.search.nodes.filter((n) => n?.id && !n.isFork).map((n) => toRecord(n, seenAt));
      await store.saveRepos(records, TODAY);
      saved += data.search.nodes.length;
      if (data.rateLimit.remaining < 50) {
        const wait = new Date(data.rateLimit.resetAt).getTime() - Date.now() + 5000;
        console.warn(`  rate limit nearly exhausted, waiting ${Math.round(wait / 1000)}s`);
        await sleep(wait);
      }
      if (!data.search.pageInfo.hasNextPage) break;
      after = data.search.pageInfo.endCursor;
    }
    await store.markSeed(seed.key, total);
    console.log(`[${i + 1}/${todo.length}] ${seed.key} -> ${saved} of ${total}`);
  });
}

// ---------------------------------------------------------------- README media

const README_NAMES = ["README.md", "readme.md", "Readme.md", "README.MD", "README.markdown", "README", "docs/README.md"];

async function fetchMedia() {
  const todo = await store.pendingMedia({
    minStars: MIN_STARS,
    freshCutoff: FRESH_CUTOFF,
    freshMinStars: FRESH_MIN_STARS,
    checkedBefore: new Date(NOW.getTime() - MEDIA_TTL_DAYS * DAY_MS).toISOString(),
    limit: MEDIA_LIMIT,
  });
  console.log(`README media: ${todo.length} repos to check`);

  const BATCH = 20;
  const starts = Array.from({ length: Math.ceil(todo.length / BATCH) }, (_, i) => i * BATCH);
  const aliases = README_NAMES.map((file, i) => `r${i}: object(expression: "HEAD:${file}") { ... on Blob { text } }`).join("\n");
  const query = `query($ids: [ID!]!) { nodes(ids: $ids) { ... on Repository { id ${aliases} } } }`;

  await pool(starts, async (start) => {
    const batch = todo.slice(start, start + BATCH);
    type Node = { id: string } & Record<string, { text: string | null } | null>;
    let nodes: (Node | null)[];
    try {
      nodes = (await graphql<{ nodes: (Node | null)[] }>(query, { ids: batch.map((r) => r.node_id) })).nodes;
    } catch (error) {
      console.warn(`  batch at ${start} failed: ${(error as Error).message}`);
      return;
    }

    const checkedAt = new Date().toISOString();
    const updates: MediaUpdate[] = batch.map((repo, i) => {
      const node = nodes[i];
      const index = node ? README_NAMES.findIndex((_, n) => node[`r${n}`]?.text) : -1;
      if (!node || index < 0) return { node_id: repo.node_id, logo: null, screenshot: null, checked_at: checkedAt };
      const dir = README_NAMES[index].includes("/") ? README_NAMES[index].split("/").slice(0, -1).join("/") : "";
      const media = pickReadmeMedia(node[`r${index}`]!.text!, { owner: repo.owner, repo: repo.name, branch: repo.default_branch ?? "HEAD", dir });
      return { node_id: repo.node_id, logo: media.logo, screenshot: media.screenshot, checked_at: checkedAt };
    });
    await store.saveMedia(updates);
    if ((start / BATCH) % 10 === 0) console.log(`  media batch ${start / BATCH + 1}/${starts.length}`);
  });
}

// ---------------------------------------------------------------- export

async function exportIndex() {
  await store.pruneSnapshots(dayOffset(SNAPSHOT_KEEP_DAYS));
  const rows = await store.exportRows({ minStars: MIN_STARS, freshCutoff: FRESH_CUTOFF, freshMinStars: FRESH_MIN_STARS });
  const history = await store.snapshotsSince(dayOffset(30));

  const languageCounts = new Map<string, number>();
  const licenseCounts = new Map<string, number>();
  const kept: { row: (typeof rows)[number]; c: ReturnType<typeof classify> }[] = [];

  for (const row of rows) {
    const c = classify({ name: row.name, topics: row.topics, description: row.description, language: row.language });
    // Young libraries stay in so the fresh view shows what is taking off.
    if (c.kind === "library" && row.stars < LIBRARY_MIN_STARS && row.created_at.toISOString() < FRESH_CUTOFF) continue;
    kept.push({ row, c });
    if (row.language) languageCounts.set(row.language, (languageCounts.get(row.language) ?? 0) + 1);
    if (row.license) licenseCounts.set(row.license, (licenseCounts.get(row.license) ?? 0) + 1);
  }

  const byCount = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const languages = byCount(languageCounts);
  const licenses = byCount(licenseCounts);
  const languageIdx = new Map(languages.map((l, i) => [l, i]));
  const licenseIdx = new Map(licenses.map((l, i) => [l, i]));
  const bits = (ids: string[], list: { id: string }[]) => ids.reduce((acc, id) => acc | (1 << list.findIndex((x) => x.id === id)), 0);

  const shards: Record<string, RepoDetails>[] = Array.from({ length: DETAIL_SHARDS }, () => ({}));
  const repos: IndexRow[] = kept.map(({ row, c }) => {
    const description = (row.description ?? "").trim();
    const shortDescription = description.length > 180 ? `${description.slice(0, 177).trimEnd()}...` : description;
    const logo = row.readme_logo ?? (row.owner_type === "Organization" ? row.owner_avatar : null);
    const snaps = history.get(row.id) ?? [];
    const growth = weeklyGrowth(row.stars, row.created_at, NOW, snaps);
    shards[shardOf(row.full_name)][row.full_name] = {
      description: row.description,
      homepage: row.homepage,
      license: row.license,
      forks: row.forks,
      pushedAt: (row.pushed_at ?? row.created_at).toISOString(),
      createdAt: row.created_at.toISOString(),
      topics: row.topics,
      archived: row.archived,
      socialImage: row.social_image,
      starHistory: snaps.map((snap) => [snap.day, snap.stars]),
    };
    return [
      row.full_name,
      shortDescription,
      row.stars,
      Math.floor(row.created_at.getTime() / DAY_MS),
      row.language ? languageIdx.get(row.language)! : -1,
      row.license ? licenseIdx.get(row.license)! : -1,
      bits(c.platforms, PLATFORMS),
      bits(c.categories, CATEGORIES),
      KINDS.findIndex((k) => k.id === c.kind),
      compressUrl(logo),
      compressUrl(row.readme_screenshot ?? row.social_image),
      row.topics.slice(0, 10).join(" "),
      growth.weekly,
      growth.measured ? 1 : 0,
    ];
  });

  const index: SearchIndex = { v: INDEX_VERSION, generatedAt: NOW.toISOString(), languages, licenses, repos };
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(join(OUT_DIR, "details"), { recursive: true });
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index));
  shards.forEach((shard, i) => writeFileSync(join(OUT_DIR, "details", `${i}.json`), JSON.stringify(shard)));

  const withImage = repos.filter((r) => r[10]).length;
  const fresh = repos.filter((r) => r[3] * DAY_MS >= Date.parse(FRESH_CUTOFF)).length;
  const kinds = KINDS.map((k, i) => `${k.id}=${repos.filter((r) => r[8] === i).length}`).join(" ");
  console.log(`Exported ${repos.length} repos (${kinds}), ${withImage} with an image, ${fresh} fresh -> public/data`);
}

// ---------------------------------------------------------------- main

try {
  if (!process.env.SKIP_HARVEST) await harvest();
  if (!process.env.SKIP_MEDIA) await fetchMedia();
  if (!process.env.SKIP_EXPORT) await exportIndex();
} finally {
  await sql.end();
}
