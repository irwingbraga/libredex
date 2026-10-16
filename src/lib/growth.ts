import { DAY_MS } from "./index-format";

export type Snapshot = { day: string; stars: number }; // day = YYYY-MM-DD

export type Growth = { weekly: number; measured: boolean };

// Repos younger than this get an estimate from their average since creation.
export const ESTIMATE_MAX_AGE_DAYS = 365;

const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/**
 * Stars gained over the last 7 days. Uses a snapshot taken 5 to 10 days ago when
 * one exists (scaled to exactly 7 days), otherwise estimates from the average
 * daily stars since creation for young repos, otherwise 0.
 */
export function weeklyGrowth(stars: number, createdAt: Date, now: Date, history: Snapshot[]): Growth {
  const today = Math.floor(now.getTime() / DAY_MS);
  let best: { days: number; stars: number } | null = null;
  for (const snap of history) {
    const days = today - dayNumber(snap.day);
    if (days < 5 || days > 10) continue;
    if (!best || Math.abs(days - 7) < Math.abs(best.days - 7)) best = { days, stars: snap.stars };
  }
  if (best) return { weekly: Math.max(0, Math.round(((stars - best.stars) * 7) / best.days)), measured: true };

  const ageDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
  if (ageDays > ESTIMATE_MAX_AGE_DAYS) return { weekly: 0, measured: false };
  if (ageDays <= 7) return { weekly: stars, measured: false };
  return { weekly: Math.round((stars * 7) / ageDays), measured: false };
}
