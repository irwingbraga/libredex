import { describe, expect, it } from "vitest";
import { weeklyGrowth } from "../growth";

const now = new Date("2026-10-16T12:00:00Z");

describe("weeklyGrowth", () => {
  it("measures from the snapshot closest to 7 days ago", () => {
    const history = [
      { day: "2026-10-01", stars: 100 }, // 15 days ago, ignored
      { day: "2026-10-08", stars: 800 }, // 8 days ago
      { day: "2026-10-09", stars: 900 }, // 7 days ago, chosen
    ];
    expect(weeklyGrowth(1000, new Date("2020-01-01"), now, history)).toEqual({ weekly: 100, measured: true });
  });

  it("scales a 5 day window to 7 days", () => {
    expect(weeklyGrowth(600, new Date("2020-01-01"), now, [{ day: "2026-10-11", stars: 100 }])).toEqual({ weekly: 700, measured: true });
  });

  it("estimates from the average for young repos without snapshots", () => {
    expect(weeklyGrowth(700, new Date("2026-09-16T12:00:00Z"), now, [])).toEqual({ weekly: 163, measured: false });
    expect(weeklyGrowth(300, new Date("2026-10-14T12:00:00Z"), now, [])).toEqual({ weekly: 300, measured: false });
  });

  it("returns 0 for old repos without snapshots", () => {
    expect(weeklyGrowth(50_000, new Date("2015-01-01"), now, [])).toEqual({ weekly: 0, measured: false });
  });
});
