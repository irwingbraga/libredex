"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatAge, formatCount, formatFullDate, formatGrowth, formatMonthYear, formatStars, growthHint } from "@/lib/format";
import { shardOf, type RepoDetails } from "@/lib/index-format";
import type { Repo } from "@/lib/search";
import { CATEGORIES, KINDS, PLATFORMS } from "@/lib/taxonomy";
import { PlatformIcon, StarIcon } from "./icons";
import { RepoLogo, RepoShot } from "./RepoMedia";

const shardCache = new Map<number, Promise<Record<string, RepoDetails>>>();

function loadDetails(fullName: string, version: string): Promise<RepoDetails | null> {
  const shard = shardOf(fullName);
  let pending = shardCache.get(shard);
  if (!pending) {
    pending = fetch(`/data/details/${shard}.json?v=${encodeURIComponent(version)}`).then((r) => (r.ok ? r.json() : {}));
    pending.catch(() => shardCache.delete(shard));
    shardCache.set(shard, pending);
  }
  return pending.then((all) => all[fullName] ?? null).catch(() => null);
}

const label = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

export function RepoDrawer({ repo, version, onClose }: { repo: Repo; version: string; onClose: () => void }) {
  const [details, setDetails] = useState<{ name: string; data: RepoDetails | null } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    loadDetails(repo.fullName, version).then((data) => live && setDetails({ name: repo.fullName, data }));
    return () => {
      live = false;
    };
  }, [repo.fullName, version]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      previous?.focus?.();
    };
  }, [onClose]);

  const info = details?.name === repo.fullName ? details.data : undefined;
  const image = repo.image ?? info?.socialImage ?? null;
  const github = `https://github.com/${repo.fullName}`;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="animate-fade absolute inset-0 bg-scrim" onClick={onClose} />
      <aside className="animate-drawer absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-paper shadow-2xl sm:border-l sm:border-line">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur">
          <span className="truncate text-sm text-muted">{repo.fullName}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full hover:bg-sunken"
            aria-label="Close details"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-line">
          <RepoShot image={image} logo={repo.logo} owner={repo.owner} name={repo.name} eager />
        </div>

        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <header className="flex items-start gap-4">
            <RepoLogo logo={repo.logo} owner={repo.owner} name={repo.name} className="size-14" />
            <div className="min-w-0">
              <h2 id="drawer-title" className="font-display text-3xl font-bold leading-tight break-words">
                {repo.name}
              </h2>
              <p className="text-muted">by {repo.owner}</p>
            </div>
          </header>

          {(info?.description ?? repo.description) && <p className="text-[16px] leading-relaxed">{info?.description ?? repo.description}</p>}

          <div className="flex flex-wrap gap-2">
            <a
              href={github}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:opacity-90"
            >
              View on GitHub
              <ExternalLink className="size-4" />
            </a>
            {info?.homepage && (
              <a
                href={info.homepage}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:border-muted/60"
              >
                Website
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
            <Stat term="Stars">
              <span className="flex items-center gap-1.5 text-star">
                <StarIcon className="size-4" />
                <span title={formatCount(repo.stars)}>{formatStars(repo.stars)}</span>
              </span>
            </Stat>
            <Stat term="Started" hint={formatAge(repo.createdAt)}>
              <span title={formatFullDate(repo.createdAt)}>{formatMonthYear(repo.createdAt)}</span>
            </Stat>
            <Stat term="Last update" hint={info ? formatAge(new Date(info.pushedAt)) : undefined}>
              {info ? formatMonthYear(new Date(info.pushedAt)) : "..."}
            </Stat>
            {repo.weeklyStars > 0 ? (
              <Stat term="Growth" hint={repo.growthMeasured ? "measured" : "estimated"}>
                <span className="text-fresh" title={growthHint(repo.growthMeasured)}>
                  {formatGrowth(repo.weeklyStars, repo.growthMeasured)}
                </span>
              </Stat>
            ) : (
              <Stat term="Forks">{info ? formatStars(info.forks) : "..."}</Stat>
            )}
            <Stat term="Language">{repo.language ?? "Not set"}</Stat>
            <Stat term="License">{repo.license ?? "Not set"}</Stat>
          </dl>

          {info && info.starHistory.length >= 2 && <StarHistory history={info.starHistory} />}

          {repo.platforms.length > 0 && (
            <TagGroup title="Platforms">
              {repo.platforms.map((p) => (
                <span key={p} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                  <PlatformIcon id={p} className="size-3.5" />
                  {label(PLATFORMS, p)}
                </span>
              ))}
            </TagGroup>
          )}

          <TagGroup title="Type and categories">
            <span className="rounded-full bg-ink px-3 py-1.5 text-sm text-paper">{label([...KINDS], repo.kind).replace(/s$/, "")}</span>
            {repo.categories.map((c) => (
              <span key={c} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                {label(CATEGORIES, c)}
              </span>
            ))}
          </TagGroup>

          {info && info.topics.length > 0 && (
            <TagGroup title="Topics">
              {info.topics.map((t) => (
                <a
                  key={t}
                  href={`https://github.com/topics/${t}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-sunken px-2 py-1 text-[13px] text-muted hover:text-ink"
                >
                  {t}
                </a>
              ))}
            </TagGroup>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({ term, hint, children }: { term: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-4">
      <dt className="text-[13px] text-muted">{term}</dt>
      <dd className="tabular mt-1 font-display text-xl font-semibold">{children}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function StarHistory({ history }: { history: [string, number][] }) {
  const width = 520;
  const height = 96;
  const values = history.map(([, stars]) => stars);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = history.map(([, stars], i) => [
    (i / (history.length - 1)) * width,
    height - 6 - ((stars - min) / range) * (height - 12),
  ]);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const gained = values[values.length - 1] - values[0];
  const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[15px] font-semibold">Stars over time</h3>
        <span className="tabular text-sm text-fresh">
          {gained >= 0 ? "+" : ""}
          {formatCount(gained)} since {day(history[0][0])}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible rounded-xl bg-surface ring-1 ring-line" role="img" aria-label={`Stars grew by ${gained} over ${history.length} days`}>
        <polygon points={`0,${height} ${line} ${width},${height}`} fill="var(--fresh)" opacity="0.12" />
        <polyline points={line} fill="none" stroke="var(--fresh)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  );
}

function TagGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-display text-[15px] font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
