import { DAY_MS, expandUrl, type IndexRow, type SearchIndex } from "./index-format";
import { CATEGORIES, KINDS, PLATFORMS } from "./taxonomy";

export type Filters = {
  q: string;
  platforms: string[];
  categories: string[];
  kinds: string[];
  languages: string[];
  licenses: string[];
  minStars: number;
  fresh: number; // only repos created in the last N days that are gaining stars; 0 = off
  sort: "stars" | "growth";
};

// Fresh view windows in days, and the growth a repo needs to count as rising.
export const FRESH_WINDOWS = [30, 90, 180] as const;
export const FRESH_MIN_WEEKLY = 10;
// Cards show a "new" growth badge for repos younger than this.
export const NEW_DAYS = 180;

export const DEFAULT_FILTERS: Filters = {
  q: "",
  platforms: [],
  categories: [],
  kinds: ["app"],
  languages: [],
  licenses: [],
  minStars: 0,
  fresh: 0,
  sort: "stars",
};

export type Repo = {
  index: number;
  fullName: string;
  owner: string;
  name: string;
  description: string;
  stars: number;
  createdAt: Date;
  language: string | null;
  license: string | null;
  platforms: string[];
  categories: string[];
  kind: string;
  logo: string;
  image: string | null;
  weeklyStars: number;
  growthMeasured: boolean;
  isNew: boolean;
};

export type FacetCounts = {
  platforms: Record<string, number>;
  categories: Record<string, number>;
  kinds: Record<string, number>;
  languages: Record<string, number>;
  licenses: Record<string, number>;
};

export type SearchResult = {
  matches: number[]; // row indices, stars descending
  facets: FacetCounts;
};

export type PreparedIndex = {
  raw: SearchIndex;
  haystacks: string[];
  today: number; // day number of the index build, the reference for "fresh"
};

export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function prepareIndex(raw: SearchIndex): PreparedIndex {
  const haystacks = raw.repos.map((row) => {
    const words = normalise(`${row[0]} ${row[1]} ${row[11]}`).split(/[^a-z0-9+#]+/).filter(Boolean);
    return ` ${words.join(" ")} `;
  });
  return { raw, haystacks, today: indexDay(raw) };
}

const indexDay = (raw: SearchIndex) => Math.floor((Date.parse(raw.generatedAt) || Date.now()) / DAY_MS);

const tokenize = (q: string) => normalise(q).split(/[^a-z0-9+#]+/).filter(Boolean);

function maskOf(ids: string[], list: { id: string }[]): number {
  return ids.reduce((acc, id) => {
    const bit = list.findIndex((x) => x.id === id);
    return bit < 0 ? acc : acc | (1 << bit);
  }, 0);
}

function indexSet(values: string[], list: string[]): Set<number> | null {
  if (values.length === 0) return null;
  return new Set(values.map((v) => list.indexOf(v)).filter((i) => i >= 0));
}

export function search(prepared: PreparedIndex, filters: Filters): SearchResult {
  const { raw, haystacks, today } = prepared;
  const freshFrom = filters.fresh ? today - filters.fresh : null;
  const tokens = tokenize(filters.q).map((t) => ` ${t}`);
  const platformMask = maskOf(filters.platforms, PLATFORMS);
  const categoryMask = maskOf(filters.categories, CATEGORIES);
  const kindSet = indexSet(filters.kinds, KINDS.map((k) => k.id));
  const languageSet = indexSet(filters.languages, raw.languages);
  const licenseSet = indexSet(filters.licenses, raw.licenses);

  const facets: FacetCounts = { platforms: {}, categories: {}, kinds: {}, languages: {}, licenses: {} };
  const platformCounts = new Array<number>(PLATFORMS.length).fill(0);
  const categoryCounts = new Array<number>(CATEGORIES.length).fill(0);
  const kindCounts = new Array<number>(KINDS.length).fill(0);
  const languageCounts = new Array<number>(raw.languages.length).fill(0);
  const licenseCounts = new Array<number>(raw.licenses.length).fill(0);
  const matches: number[] = [];

  for (let i = 0; i < raw.repos.length; i++) {
    const row = raw.repos[i];
    if (row[2] < filters.minStars) continue;
    if (freshFrom !== null && (row[3] < freshFrom || row[12] < FRESH_MIN_WEEKLY)) continue;
    if (tokens.length && !tokens.every((t) => haystacks[i].includes(t))) continue;

    const okPlatform = platformMask === 0 || (row[6] & platformMask) !== 0;
    const okCategory = categoryMask === 0 || (row[7] & categoryMask) !== 0;
    const okKind = !kindSet || kindSet.has(row[8]);
    const okLanguage = !languageSet || languageSet.has(row[4]);
    const okLicense = !licenseSet || licenseSet.has(row[5]);
    const failures = +!okPlatform + +!okCategory + +!okKind + +!okLanguage + +!okLicense;
    if (failures > 1) continue;

    // Each facet is counted with every other filter applied, so its counts
    // show what toggling an option would return.
    if (failures === 0 || !okPlatform) addBits(platformCounts, row[6]);
    if (failures === 0 || !okCategory) addBits(categoryCounts, row[7]);
    if (failures === 0 || !okKind) kindCounts[row[8]]++;
    if ((failures === 0 || !okLanguage) && row[4] >= 0) languageCounts[row[4]]++;
    if ((failures === 0 || !okLicense) && row[5] >= 0) licenseCounts[row[5]]++;
    if (failures === 0) matches.push(i);
  }

  if (filters.sort === "growth") {
    matches.sort((a, b) => raw.repos[b][12] - raw.repos[a][12] || raw.repos[b][2] - raw.repos[a][2]);
  }

  PLATFORMS.forEach((p, i) => (facets.platforms[p.id] = platformCounts[i]));
  CATEGORIES.forEach((c, i) => (facets.categories[c.id] = categoryCounts[i]));
  KINDS.forEach((k, i) => (facets.kinds[k.id] = kindCounts[i]));
  raw.languages.forEach((l, i) => (facets.languages[l] = languageCounts[i]));
  raw.licenses.forEach((l, i) => (facets.licenses[l] = licenseCounts[i]));
  return { matches, facets };
}

function addBits(counts: number[], bits: number) {
  for (let b = 0; bits !== 0; b++, bits >>>= 1) {
    if (bits & 1) counts[b]++;
  }
}

const fromBits = (bits: number, list: { id: string }[]) => list.filter((_, i) => bits & (1 << i)).map((x) => x.id);

export function toRepo(raw: SearchIndex, index: number): Repo {
  const row: IndexRow = raw.repos[index];
  const [owner, name] = row[0].split("/");
  return {
    index,
    fullName: row[0],
    owner,
    name,
    description: row[1],
    stars: row[2],
    createdAt: new Date(row[3] * 86_400_000),
    language: row[4] >= 0 ? raw.languages[row[4]] : null,
    license: row[5] >= 0 ? raw.licenses[row[5]] : null,
    platforms: fromBits(row[6], PLATFORMS),
    categories: fromBits(row[7], CATEGORIES),
    kind: KINDS[row[8]]?.id ?? "tool",
    logo: expandUrl(row[9]) ?? `https://github.com/${owner}.png?size=96`,
    image: expandUrl(row[10]),
    weeklyStars: row[12] ?? 0,
    growthMeasured: row[13] === 1,
    isNew: row[3] >= indexDay(raw) - NEW_DAYS,
  };
}

// ---------------------------------------------------------------- URL state

const LIST_KEYS = { platform: "platforms", category: "categories", lang: "languages", license: "licenses" } as const;

export function filtersFromParams(params: URLSearchParams): Filters {
  const list = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];
  const kind = params.get("kind");
  return {
    q: params.get("q") ?? "",
    platforms: list("platform"),
    categories: list("category"),
    languages: list("lang"),
    licenses: list("license"),
    kinds: kind === "all" ? [] : kind ? kind.split(",") : DEFAULT_FILTERS.kinds,
    minStars: Number(params.get("stars")) || 0,
    fresh: Number(params.get("fresh")) || 0,
    sort: params.get("sort") === "growth" ? "growth" : "stars",
  };
}

export function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const [key, field] of Object.entries(LIST_KEYS)) {
    if (filters[field].length) params.set(key, filters[field].join(","));
  }
  const kinds = filters.kinds.join(",");
  if (kinds !== DEFAULT_FILTERS.kinds.join(",")) params.set("kind", kinds || "all");
  if (filters.minStars) params.set("stars", String(filters.minStars));
  if (filters.fresh) params.set("fresh", String(filters.fresh));
  if (filters.sort !== "stars") params.set("sort", filters.sort);
  return params;
}
