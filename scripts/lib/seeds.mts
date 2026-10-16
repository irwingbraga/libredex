// Which GitHub searches a run performs.

const DAY_MS = 86_400_000;

export type Seed = { key: string; query: string; fresh: boolean };

export type SeedOptions = {
  now: Date;
  topics: string[];
  minStars: number;
  freshDays: number;
  freshMinStars: number;
};

// Topic searches find established projects; date-window searches find young ones
// that topic searches miss because they sort by stars.
export function buildSeeds({ now, topics, minStars, freshDays, freshMinStars }: SeedOptions): Seed[] {
  const day = (offset: number) => new Date(now.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
  const windows = [0, 15, 30, 60, 90, 135, freshDays].filter((d, i, all) => d <= freshDays && all.indexOf(d) === i);
  const fresh = windows.slice(0, -1).map((from, i) => ({
    key: `fresh:${from}-${windows[i + 1]}`,
    query: `created:${day(windows[i + 1])}..${day(from)} stars:>=${freshMinStars} fork:false sort:stars-desc`,
    fresh: true,
  }));
  const topical = topics.map((topic) => ({
    key: topic,
    query: `topic:${topic} stars:>=${minStars} fork:false sort:stars-desc`,
    fresh: false,
  }));
  return [...fresh, ...topical];
}

// Fresh searches run every time; topic searches rotate, least recently run first,
// so each run refreshes a share of them and every topic is covered within a few runs.
// Anything that ran within ttlHours is skipped, which also makes interrupted runs resumable.
export function pickSeeds(seeds: Seed[], runs: Map<string, Date>, opts: { now: Date; ttlHours: number; topicShare: number }): Seed[] {
  const lastRun = (seed: Seed) => runs.get(seed.key)?.getTime() ?? 0;
  const recent = (seed: Seed) => lastRun(seed) > opts.now.getTime() - opts.ttlHours * 3_600_000;
  const topics = seeds.filter((s) => !s.fresh);
  const budget = Math.ceil(topics.length * opts.topicShare);
  const due = topics
    .filter((s) => !recent(s))
    .sort((a, b) => lastRun(a) - lastRun(b))
    .slice(0, budget);
  return [...seeds.filter((s) => s.fresh && !recent(s)), ...due];
}
