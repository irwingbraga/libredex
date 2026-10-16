"use client";

import { memo } from "react";
import { Sprout } from "lucide-react";
import { formatAge, formatFullDate, formatGrowth, formatMonthYear, formatStars, growthHint, LANGUAGE_COLORS } from "@/lib/format";
import type { Repo } from "@/lib/search";
import { PLATFORMS } from "@/lib/taxonomy";
import { PlatformIcon, StarIcon } from "./icons";
import { RepoLogo, RepoShot } from "./RepoMedia";

type Props = {
  repo: Repo;
  rank: number;
  eager?: boolean;
  onOpen: (fullName: string) => void;
};

const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label ?? id;

export const RepoCard = memo(function RepoCard({ repo, rank, eager, onOpen }: Props) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-muted/60">
      <div className="relative">
        <RepoShot image={repo.image} logo={repo.logo} owner={repo.owner} name={repo.name} eager={eager} />
        {repo.isNew && repo.weeklyStars > 0 && (
          <span
            className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-fresh py-1 pr-2.5 pl-2 text-xs font-semibold text-paper shadow-sm"
            title={growthHint(repo.growthMeasured)}
          >
            <Sprout className="size-3.5" aria-hidden="true" />
            {formatGrowth(repo.weeklyStars, repo.growthMeasured)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <RepoLogo logo={repo.logo} owner={repo.owner} name={repo.name} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[17px] font-semibold leading-tight">
              <a
                href={`?repo=${encodeURIComponent(repo.fullName)}`}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  onOpen(repo.fullName);
                }}
                className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-focus"
              >
                {repo.name}
              </a>
            </h3>
            <p className="truncate text-[13px] text-muted">{repo.owner}</p>
          </div>
          <span className="tabular pt-0.5 text-xs text-muted" title={`Rank ${rank} by stars in these results`}>
            #{rank}
          </span>
        </div>

        {repo.description && <p className="line-clamp-2 text-[14px] leading-snug text-ink/85">{repo.description}</p>}

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-2xl font-bold leading-none text-star tabular">
              <StarIcon className="size-[18px]" />
              {formatStars(repo.stars)}
            </p>
            <p className="mt-1.5 text-[13px] text-muted" title={`${formatFullDate(repo.createdAt)}, ${formatAge(repo.createdAt)}`}>
              Started {formatMonthYear(repo.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {repo.platforms.length > 0 && (
              <ul className="flex gap-1.5 text-muted" aria-label="Platforms">
                {repo.platforms.slice(0, 5).map((p) => (
                  <li key={p} title={platformLabel(p)}>
                    <PlatformIcon id={p} className="size-4" />
                    <span className="sr-only">{platformLabel(p)}</span>
                  </li>
                ))}
              </ul>
            )}
            {repo.language && (
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="size-2.5 rounded-full" style={{ background: LANGUAGE_COLORS[repo.language] ?? "var(--muted)" }} />
                {repo.language}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

export function RepoCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface" aria-hidden="true">
      <div className="skeleton aspect-[16/10]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-3">
          <div className="skeleton size-10 rounded-xl" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
        </div>
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
        <div className="skeleton mt-2 h-6 w-20 rounded" />
      </div>
    </div>
  );
}
