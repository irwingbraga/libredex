"use client";

import Link from "next/link";
import { ArrowUp, Moon, Search, SlidersHorizontal, Sprout, Sun, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { formatCount } from "@/lib/format";
import type { IndexRow, SearchIndex } from "@/lib/index-format";
import {
  DEFAULT_FILTERS,
  FRESH_WINDOWS,
  filtersFromParams,
  filtersToParams,
  prepareIndex,
  search,
  toRepo,
  type FacetCounts,
  type Filters,
  type PreparedIndex,
} from "@/lib/search";
import { CATEGORIES, KINDS, PLATFORMS } from "@/lib/taxonomy";
import { navigate, useLocationSearch, useTheme } from "@/lib/url-state";
import { FacetPanel, PlatformRail } from "./Facets";
import { RepoCard, RepoCardSkeleton } from "./RepoCard";
import { RepoDrawer } from "./RepoDrawer";

export type InitialData = {
  rows: IndexRow[];
  total: number;
  facets: FacetCounts;
  languages: string[];
  licenses: string[];
  generatedAt: string;
};

const PAGE = 36;
type ListKey = "platforms" | "categories" | "languages" | "licenses" | "kinds";

function writeUrl(filters: Filters, repo: string | null, mode: "push" | "replace") {
  const params = filtersToParams(filters);
  if (repo) params.set("repo", repo);
  navigate(params, mode, { drawer: Boolean(repo) });
}

const isDefault = (filters: Filters) => filtersToParams(filters).toString() === "";

export function Catalog({ initial }: { initial: InitialData }) {
  const [index, setIndex] = useState<PreparedIndex | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [paging, setPaging] = useState({ key: "", limit: PAGE });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const locationSearch = useLocationSearch();
  const hydrated = locationSearch !== null;
  const params = useMemo(() => new URLSearchParams(locationSearch ?? ""), [locationSearch]);
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const selected = params.get("repo");
  const filterKey = filtersToParams(filters).toString();
  const limit = paging.key === filterKey ? paging.limit : PAGE;

  useEffect(() => {
    let live = true;
    // The version query keeps browsers from pairing a new page with a cached old index.
    fetch(`/data/index.json?v=${encodeURIComponent(initial.generatedAt)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<SearchIndex>;
      })
      .then((raw) => live && setIndex(prepareIndex(raw)))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, [initial.generatedAt]);

  const deferredFilters = useDeferredValue(filters);
  const result = useMemo(() => (index ? search(index, deferredFilters) : null), [index, deferredFilters]);
  const stale = deferredFilters !== filters;

  // Until the full index arrives, the build-time first page stands in for default filters.
  const initialIndex = useMemo<SearchIndex>(
    () => ({ v: 1, generatedAt: initial.generatedAt, languages: initial.languages, licenses: initial.licenses, repos: initial.rows }),
    [initial],
  );
  const usingInitial = !result && (!hydrated || isDefault(filters));
  const waiting = !result && !usingInitial;
  const facets = result?.facets ?? (usingInitial ? initial.facets : null);
  const total = result ? result.matches.length : usingInitial ? initial.total : null;

  const repos = useMemo(() => {
    if (result && index) return result.matches.slice(0, limit).map((i) => toRepo(index.raw, i));
    if (usingInitial) return initial.rows.map((_, i) => toRepo(initialIndex, i));
    return [];
  }, [result, index, limit, usingInitial, initial.rows, initialIndex]);

  const byName = useMemo(() => {
    const map = new Map<string, number>();
    index?.raw.repos.forEach((row, i) => map.set(row[0], i));
    return map;
  }, [index]);

  const selectedRepo = useMemo(() => {
    if (!selected) return null;
    if (index) {
      const i = byName.get(selected);
      return i === undefined ? null : toRepo(index.raw, i);
    }
    const i = initial.rows.findIndex((r) => r[0] === selected);
    return i < 0 ? null : toRepo(initialIndex, i);
  }, [selected, index, byName, initial.rows, initialIndex]);

  const commit = useCallback((next: Filters, mode: "push" | "replace" = "push") => {
    writeUrl(next, null, mode);
    const top = resultsRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) resultsRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const toggle = useCallback(
    (key: ListKey, value: string) => {
      const list = filters[key];
      commit({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
    },
    [filters, commit],
  );

  const patch = useCallback((change: Partial<Filters>) => commit({ ...filters, ...change }), [filters, commit]);

  const openRepo = useCallback((fullName: string) => writeUrl(filters, fullName, "push"), [filters]);

  const closeRepo = useCallback(() => {
    if (window.history.state?.drawer) window.history.back();
    else writeUrl(filters, null, "replace");
  }, [filters]);

  // Infinite scroll.
  const hasMore = result ? limit < result.matches.length : false;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setPaging({ key: filterKey, limit: limit + PAGE }),
      { rootMargin: "1200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, limit, filterKey]);

  // "/" focuses search, back-to-top visibility.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    const onScroll = () => setShowTop(window.scrollY > 1600);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const pills = activePills(filters);
  const activeCount = pills.length;
  const languages = index?.raw.languages ?? initial.languages;
  const licenses = index?.raw.licenses ?? initial.licenses;
  const facetProps = { filters, facets, languages, licenses, onToggle: toggle, onChange: patch };

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 pt-5 pb-2">
        <Link href="/" className="flex items-baseline gap-2" aria-label="Libredex home">
          <span className="font-display text-2xl font-extrabold tracking-tight">Libredex</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <section className="pt-6 pb-5 sm:pt-10">
        <h1 className="max-w-3xl font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.02] tracking-tight text-balance">
          Open source apps for every platform, ranked by the stars people gave them.
        </h1>
      </section>

      <div className="sticky top-0 z-30 -mx-4 bg-paper/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <label className="relative block">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            type="search"
            value={filters.q}
            onChange={(e) => commit({ ...filters, q: e.target.value }, "replace")}
            onKeyDown={(e) => e.key === "Escape" && filters.q && commit({ ...filters, q: "" }, "replace")}
            placeholder="Search apps, topics, owners"
            autoComplete="off"
            spellCheck={false}
            className="h-14 w-full rounded-2xl border border-line bg-surface pr-14 pl-12 text-[17px] shadow-[0_1px_0_var(--line)] outline-none transition-colors placeholder:text-muted/80 focus:border-focus [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.q ? (
            <button
              type="button"
              onClick={() => {
                commit({ ...filters, q: "" }, "replace");
                searchRef.current?.focus();
              }}
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md border border-line px-2 py-0.5 text-xs text-muted sm:block">
              /
            </kbd>
          )}
        </label>
      </div>

      <div className="pt-1 pb-6">
        <PlatformRail
          filters={filters}
          facets={facets}
          onToggle={toggle}
          onFresh={() => patch(filters.fresh ? { fresh: 0, sort: "stars" } : { fresh: 90 })}
        />
        {filters.fresh > 0 && <FreshBar filters={filters} onChange={patch} />}
      </div>

      <div ref={resultsRef} className="scroll-mt-24 lg:grid lg:grid-cols-[248px_1fr] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2 pb-8">
            <FacetPanel {...facetProps} />
          </div>
        </aside>

        <main>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-muted" aria-live="polite">
              {total === null ? (
                "Loading projects"
              ) : (
                <>
                  <span className="tabular font-semibold text-ink">{formatCount(total)}</span>{" "}
                  {filters.fresh ? "fresh " : ""}
                  {total === 1 ? "project" : "projects"}
                  {filters.fresh ? ` created in the last ${windowLabel(filters.fresh)}` : ""}, ordered by{" "}
                  {filters.sort === "growth" ? "growth" : "stars"}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium lg:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {activeCount > 0 && <span className="tabular rounded-full bg-ink px-1.5 text-xs text-paper">{activeCount}</span>}
            </button>
          </div>

          {pills.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {pills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => commit(pill.remove(filters))}
                  className="flex items-center gap-1.5 rounded-full bg-ink/8 py-1 pr-2 pl-3 text-sm hover:bg-ink/12"
                  aria-label={`Remove filter ${pill.label}`}
                >
                  {pill.label}
                  <X className="size-3.5 text-muted" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => commit({ ...DEFAULT_FILTERS, kinds: [] })}
                className="px-2 text-sm font-medium text-focus hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {loadError && !result && !usingInitial ? (
            <EmptyState title="The catalog could not be loaded." body="Check your connection and reload the page." />
          ) : waiting ? (
            <Grid>
              {Array.from({ length: 9 }, (_, i) => (
                <RepoCardSkeleton key={i} />
              ))}
            </Grid>
          ) : repos.length === 0 ? (
            <EmptyState
              title="No projects match these filters."
              body={filters.kinds.length ? "Try including libraries and tools, or remove a filter." : "Try a shorter search or remove a filter."}
              action={
                filters.kinds.length ? (
                  <button
                    type="button"
                    onClick={() => patch({ kinds: [] })}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
                  >
                    Search all types
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => commit({ ...DEFAULT_FILTERS, kinds: [] })}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
                  >
                    Clear filters
                  </button>
                )
              }
            />
          ) : (
            <Grid dim={stale}>
              {repos.map((repo, i) => (
                <RepoCard key={repo.fullName} repo={repo} rank={i + 1} eager={i < 6} onOpen={openRepo} />
              ))}
            </Grid>
          )}

          <div ref={sentinelRef} className="h-px" />
          {hasMore && (
            <div className="mt-5">
              <Grid>
                {Array.from({ length: 3 }, (_, i) => (
                  <RepoCardSkeleton key={i} />
                ))}
              </Grid>
            </div>
          )}

          <footer className="mt-16 border-t border-line py-8 text-sm text-muted">
            <p>
              Data from the GitHub API, refreshed daily. Last update{" "}
              {new Date(index?.raw.generatedAt ?? initial.generatedAt).toLocaleDateString("en", { dateStyle: "medium" })}. Screenshots and
              logos belong to their projects.
            </p>
          </footer>
        </main>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="animate-fade absolute inset-0 bg-scrim" onClick={() => setSheetOpen(false)} />
          <div className="animate-sheet absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl bg-paper">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-display text-lg font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="grid size-9 place-items-center rounded-full hover:bg-sunken"
                aria-label="Close filters"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <FacetPanel {...facetProps} />
            </div>
            <div className="border-t border-line p-4">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full rounded-full bg-ink py-3 text-[15px] font-medium text-paper"
              >
                Show {total === null ? "" : formatCount(total)} projects
              </button>
            </div>
          </div>
        </div>
      )}

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="animate-fade fixed right-5 bottom-5 z-30 grid size-12 place-items-center rounded-full bg-ink text-paper shadow-lg"
          aria-label="Back to top"
        >
          <ArrowUp className="size-5" />
        </button>
      )}

      {selectedRepo && <RepoDrawer repo={selectedRepo} version={index?.raw.generatedAt ?? initial.generatedAt} onClose={closeRepo} />}
    </div>
  );
}

function Grid({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div
      className={`grid grid-cols-1 gap-5 transition-opacity duration-150 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${dim ? "opacity-70" : ""}`}
    >
      {children}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1 text-muted">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

type Pill = { key: string; label: string; remove: (f: Filters) => Filters };

function activePills(filters: Filters): Pill[] {
  const pills: Pill[] = [];
  const listPill = (key: ListKey, value: string, label: string): Pill => ({
    key: `${key}:${value}`,
    label,
    remove: (f) => ({ ...f, [key]: f[key].filter((v) => v !== value) }),
  });
  filters.platforms.forEach((p) => pills.push(listPill("platforms", p, PLATFORMS.find((x) => x.id === p)?.label ?? p)));
  filters.categories.forEach((c) => pills.push(listPill("categories", c, CATEGORIES.find((x) => x.id === c)?.label ?? c)));
  filters.languages.forEach((l) => pills.push(listPill("languages", l, l)));
  filters.licenses.forEach((l) => pills.push(listPill("licenses", l, l)));
  filters.kinds.forEach((k) => pills.push(listPill("kinds", k, KINDS.find((x) => x.id === k)?.label ?? k)));
  if (filters.fresh) {
    pills.push({ key: "fresh", label: `Fresh, last ${windowLabel(filters.fresh)}`, remove: (f) => ({ ...f, fresh: 0, sort: "stars" }) });
  }
  if (filters.sort === "growth") pills.push({ key: "sort", label: "Fastest growing", remove: (f) => ({ ...f, sort: "stars" }) });
  if (filters.minStars) pills.push({ key: "stars", label: `${filters.minStars / 1000}k+ stars`, remove: (f) => ({ ...f, minStars: 0 }) });
  if (filters.q) pills.push({ key: "q", label: `"${filters.q}"`, remove: (f) => ({ ...f, q: "" }) });
  return pills;
}

const windowLabel = (days: number) => (days % 30 === 0 && days >= 60 ? `${days / 30} months` : `${days} days`);

function FreshBar({ filters, onChange }: { filters: Filters; onChange: (patch: Partial<Filters>) => void }) {
  const option = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`;
  return (
    <div className="animate-fade mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-fresh/30 bg-fresh-soft/60 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-fresh">
        <Sprout className="size-4" aria-hidden="true" />
        New projects gaining stars
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-muted">Created in the last</span>
        <div role="radiogroup" aria-label="Created in the last" className="flex gap-1 rounded-xl bg-sunken p-1">
          {FRESH_WINDOWS.map((days) => (
            <button key={days} type="button" role="radio" aria-checked={filters.fresh === days} onClick={() => onChange({ fresh: days })} className={option(filters.fresh === days)}>
              {windowLabel(days)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-muted">Order by</span>
        <div role="radiogroup" aria-label="Order by" className="flex gap-1 rounded-xl bg-sunken p-1">
          {(["stars", "growth"] as const).map((sort) => (
            <button key={sort} type="button" role="radio" aria-checked={filters.sort === sort} onClick={() => onChange({ sort })} className={option(filters.sort === sort)}>
              {sort === "stars" ? "Most stars" : "Fastest growing"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="grid size-10 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
      aria-label={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
