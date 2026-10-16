import { describe, expect, it } from "vitest";
import { buildSeeds, pickSeeds } from "../seeds.mts";

const now = new Date("2026-10-16T03:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("buildSeeds", () => {
  it("adds fresh date windows before topic searches", () => {
    const seeds = buildSeeds({ now, topics: ["android"], minStars: 100, freshDays: 180, freshMinStars: 30 });
    expect(seeds.map((s) => s.key)).toEqual(["fresh:0-15", "fresh:15-30", "fresh:30-60", "fresh:60-90", "fresh:90-135", "fresh:135-180", "android"]);
    expect(seeds[0].query).toBe("created:2026-10-01..2026-10-16 stars:>=30 fork:false sort:stars-desc");
    expect(seeds[6].query).toBe("topic:android stars:>=100 fork:false sort:stars-desc");
  });

  it("handles a custom fresh window", () => {
    expect(buildSeeds({ now, topics: [], minStars: 100, freshDays: 45, freshMinStars: 30 }).map((s) => s.key)).toEqual([
      "fresh:0-15",
      "fresh:15-30",
      "fresh:30-45",
    ]);
  });
});

describe("pickSeeds", () => {
  const seeds = buildSeeds({ now, topics: ["a", "b", "c", "d", "e", "f"], minStars: 100, freshDays: 30, freshMinStars: 30 });

  it("runs every fresh search and the least recently run third of topics", () => {
    const runs = new Map([
      ["a", hoursAgo(30)],
      ["b", hoursAgo(72)],
      ["c", hoursAgo(50)],
      ["fresh:0-15", hoursAgo(24)],
    ]);
    const picked = pickSeeds(seeds, runs, { now, ttlHours: 20, topicShare: 0.34 });
    // never-run topics (d, e, f) come first; 6 topics * 0.34 rounds up to 3
    expect(picked.map((s) => s.key)).toEqual(["fresh:0-15", "fresh:15-30", "d", "e", "f"]);
  });

  it("skips anything that ran within the TTL, so interrupted runs resume", () => {
    const runs = new Map(seeds.map((s) => [s.key, hoursAgo(2)]));
    runs.set("c", hoursAgo(40));
    expect(pickSeeds(seeds, runs, { now, ttlHours: 20, topicShare: 1 }).map((s) => s.key)).toEqual(["c"]);
  });
});
