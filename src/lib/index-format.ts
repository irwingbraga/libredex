// Compact search index shared by the ingestion export and the browser.

export const INDEX_VERSION = 2;

// Row layout of SearchIndex.repos, kept positional to keep the file small.
export type IndexRow = [
  fullName: string,
  description: string,
  stars: number,
  createdDay: number, // days since 1970-01-01
  language: number, // index into facets.languages, -1 when unknown
  license: number, // index into facets.licenses, -1 when unknown
  platformBits: number,
  categoryBits: number,
  kind: number, // index into KINDS
  logo: string, // compressed URL, "" when none (UI falls back to the owner avatar)
  image: string, // compressed URL, "" when none
  topics: string, // space separated, used for text search
  weeklyStars: number, // stars gained in the last 7 days (measured or estimated)
  growthMeasured: number, // 1 when weeklyStars comes from snapshots, 0 when estimated from age
];

export type SearchIndex = {
  v: number;
  generatedAt: string;
  languages: string[];
  licenses: string[];
  repos: IndexRow[]; // sorted by stars descending
};

export type RepoDetails = {
  description: string | null;
  homepage: string | null;
  license: string | null;
  forks: number;
  pushedAt: string;
  createdAt: string;
  topics: string[];
  archived: boolean;
  socialImage: string | null;
  // Daily star counts from nightly snapshots, oldest first, at most 30 days.
  starHistory: [day: string, stars: number][];
};

// Prefix codes for common image hosts. Order matters: longest first.
const URL_PREFIXES: [string, string][] = [
  ["R|", "https://raw.githubusercontent.com/"],
  ["U|", "https://github.com/user-attachments/assets/"],
  ["I|", "https://user-images.githubusercontent.com/"],
  ["O|", "https://repository-images.githubusercontent.com/"],
  ["A|", "https://avatars.githubusercontent.com/"],
  ["G|", "https://github.com/"],
];

export function compressUrl(url: string | null): string {
  if (!url) return "";
  for (const [code, prefix] of URL_PREFIXES) {
    if (url.startsWith(prefix)) return code + url.slice(prefix.length);
  }
  return url;
}

export function expandUrl(value: string): string | null {
  if (!value) return null;
  const code = value.slice(0, 2);
  const prefix = URL_PREFIXES.find(([c]) => c === code);
  return prefix ? prefix[1] + value.slice(2) : value;
}

export const DETAIL_SHARDS = 256;

// FNV-1a, stable across Node and browsers.
export function shardOf(fullName: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < fullName.length; i++) {
    hash ^= fullName.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % DETAIL_SHARDS;
}

export const DAY_MS = 86_400_000;
