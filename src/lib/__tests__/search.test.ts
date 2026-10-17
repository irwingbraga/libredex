import { describe, expect, it } from "vitest";
import type { IndexRow, SearchIndex } from "../index-format";
import { DEFAULT_FILTERS, filtersFromParams, filtersToParams, prepareIndex, search, toRepo } from "../search";

// platform bits: android=1, ios=2, macos=4, linux=16; category bits: media=4, notes=2
const row = (name: string, stars: number, platforms: number, categories: number, kind: number, lang: number, topics = "", created = 18000, weekly = 0): IndexRow =>
  [name, `${name} description`, stars, created, lang, -1, platforms, categories, kind, "", "", topics, weekly, 0];

const index: SearchIndex = {
  v: 1,
  generatedAt: "2026-10-16T00:00:00Z", // day 20742
  languages: ["Kotlin", "Swift"],
  licenses: [],
  repos: [
    row("acme/music-box", 900, 1, 4, 0, 0, "music-player"),
    row("acme/notely", 500, 2 | 4, 2, 0, 1, "note-taking"),
    row("acme/sdk", 400, 1, 0, 2, 0),
    row("acme/tunes-cli", 100, 16, 4, 1, -1, "cli"),
    row("acme/fresh-old", 90, 0, 0, 0, -1, "", 20742 - 100, 50),
    row("acme/fresh-new", 80, 0, 0, 0, -1, "", 20742 - 10, 80),
    row("acme/fresh-flat", 70, 0, 0, 0, -1, "", 20742 - 5, 3),
  ],
};
const prepared = prepareIndex(index);
const names = (matches: number[]) => matches.map((i) => index.repos[i][0]);
const all = { ...DEFAULT_FILTERS, kinds: [] };

describe("search", () => {
  it("keeps star order and filters by kind", () => {
    expect(names(search(prepared, { ...all, kinds: ["app"] }).matches)).toEqual(["acme/music-box", "acme/notely", "acme/fresh-old", "acme/fresh-new", "acme/fresh-flat"]);
  });

  it("prefix matches every token across name, description and topics", () => {
    expect(names(search(prepared, { ...all, q: "mus" }).matches)).toEqual(["acme/music-box"]);
    expect(names(search(prepared, { ...all, q: "note tak" }).matches)).toEqual(["acme/notely"]);
    expect(names(search(prepared, { ...all, q: "usic" }).matches)).toEqual([]);
  });

  it("ORs within a facet and ANDs across facets", () => {
    expect(names(search(prepared, { ...all, platforms: ["ios", "linux"] }).matches)).toEqual(["acme/notely", "acme/tunes-cli"]);
    expect(names(search(prepared, { ...all, platforms: ["android"], categories: ["media"] }).matches)).toEqual(["acme/music-box"]);
  });

  it("counts each facet with the other filters applied", () => {
    const { facets } = search(prepared, { ...all, platforms: ["android"], categories: ["media"] });
    // platform counts ignore the platform filter but keep category=media
    expect(facets.platforms).toMatchObject({ android: 1, linux: 1, ios: 0 });
    // category counts ignore category but keep platform=android
    expect(facets.categories).toMatchObject({ media: 1, notes: 0 });
    expect(facets.kinds).toMatchObject({ app: 1, tool: 0, library: 0 });
  });

  it("filters by language and minimum stars", () => {
    expect(names(search(prepared, { ...all, languages: ["Kotlin"], minStars: 450 }).matches)).toEqual(["acme/music-box"]);
  });

  it("decodes rows", () => {
    const repo = toRepo(index, 1);
    expect(repo).toMatchObject({ owner: "acme", name: "notely", platforms: ["ios", "macos"], categories: ["notes"], language: "Swift" });
    expect(repo.logo).toBe("https://github.com/acme.png?size=96");
  });
});

describe("fresh view", () => {
  it("keeps young repos that are gaining stars, ordered by stars", () => {
    expect(names(search(prepared, { ...all, fresh: 180 }).matches)).toEqual(["acme/fresh-old", "acme/fresh-new"]);
    expect(names(search(prepared, { ...all, fresh: 30 }).matches)).toEqual(["acme/fresh-new"]);
  });

  it("orders by growth when asked", () => {
    expect(names(search(prepared, { ...all, fresh: 180, sort: "growth" }).matches)).toEqual(["acme/fresh-new", "acme/fresh-old"]);
  });

  it("flags new repos", () => {
    expect(toRepo(index, 5)).toMatchObject({ isNew: true, weeklyStars: 80, growthMeasured: false });
    expect(toRepo(index, 0).isNew).toBe(false);
  });
});

describe("url state", () => {
  it("round trips filters", () => {
    const filters = { ...DEFAULT_FILTERS, q: "music", platforms: ["android", "ios"], kinds: ["app", "tool"], minStars: 1000, fresh: 90, sort: "growth" as const };
    const params = filtersToParams(filters);
    expect(params.toString()).toBe("q=music&platform=android%2Cios&kind=app%2Ctool&stars=1000&fresh=90&sort=growth");
    expect(filtersFromParams(params)).toEqual(filters);
  });

  it("omits defaults", () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
    expect(filtersFromParams(new URLSearchParams("kind=all")).kinds).toEqual([]);
  });
});
