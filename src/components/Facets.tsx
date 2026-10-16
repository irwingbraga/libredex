"use client";

import { Check, Sprout } from "lucide-react";
import { useState } from "react";
import { formatCount } from "@/lib/format";
import type { FacetCounts, Filters } from "@/lib/search";
import { CATEGORIES, KINDS, PLATFORMS } from "@/lib/taxonomy";
import { PlatformIcon } from "./icons";

type ListKey = "platforms" | "categories" | "languages" | "licenses" | "kinds";

type Props = {
  filters: Filters;
  facets: FacetCounts | null;
  languages: string[];
  licenses: string[];
  onToggle: (key: ListKey, value: string) => void;
  onChange: (patch: Partial<Filters>) => void;
};

const GENERAL_CATEGORIES = CATEGORIES.filter((c) => !c.group);
const AI_CATEGORIES = CATEGORIES.filter((c) => c.group === "ai");

export const STAR_STEPS = [0, 1000, 10_000, 50_000];
const starLabel = (n: number) => (n === 0 ? "Any" : `${n / 1000}k+`);

type RailProps = Pick<Props, "filters" | "facets" | "onToggle"> & { onFresh: () => void };

export function PlatformRail({ filters, facets, onToggle, onFresh }: RailProps) {
  const fresh = filters.fresh > 0;
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <button
        type="button"
        aria-pressed={fresh}
        onClick={onFresh}
        className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
          fresh ? "border-fresh bg-fresh text-paper" : "border-fresh/40 bg-fresh-soft text-fresh hover:border-fresh"
        }`}
      >
        <Sprout className="size-4" aria-hidden="true" />
        Fresh & rising
      </button>
      <span className="my-1.5 w-px shrink-0 bg-line" aria-hidden="true" />
      {PLATFORMS.map((platform) => {
        const active = filters.platforms.includes(platform.id);
        const count = facets?.platforms[platform.id];
        return (
          <button
            key={platform.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle("platforms", platform.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink hover:border-muted/60"
            } ${count === 0 && !active ? "opacity-45" : ""}`}
          >
            <PlatformIcon id={platform.id} className="size-4" />
            {platform.label}
            {count !== undefined && <span className={`tabular text-xs ${active ? "text-paper/70" : "text-muted"}`}>{formatCount(count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <h2 className="mb-2.5 font-display text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onSelect,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onSelect: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-sunken p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(option.value)}
            className={`rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors ${
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CheckList({
  items,
  selected,
  counts,
  onToggle,
  initial = 8,
  searchable = false,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  counts: Record<string, number> | undefined;
  onToggle: (id: string) => void;
  initial?: number;
  searchable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needle, setNeedle] = useState("");
  const filtered = needle ? items.filter((i) => i.label.toLowerCase().includes(needle.toLowerCase())) : items;
  // Selected items stay visible even when the list is collapsed.
  const visible = expanded || needle ? filtered : filtered.filter((item, i) => i < initial || selected.includes(item.id));

  return (
    <div>
      {searchable && expanded && (
        <input
          value={needle}
          onChange={(e) => setNeedle(e.target.value)}
          placeholder="Filter languages"
          aria-label="Filter languages"
          className="mb-2 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-focus"
        />
      )}
      <ul className={`space-y-0.5 ${expanded ? "max-h-72 overflow-y-auto pr-1" : ""}`}>
        {visible.map((item) => {
          const active = selected.includes(item.id);
          const count = counts?.[item.id] ?? 0;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-sunken ${
                  count === 0 && !active ? "text-muted/70" : ""
                }`}
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded border ${active ? "border-ink bg-ink text-paper" : "border-muted/50"}`}
                >
                  {active && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                <span className="tabular text-xs text-muted">{formatCount(count)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {filtered.length > initial && !needle && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1.5 px-2 text-sm font-medium text-focus hover:underline">
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

export function FacetPanel({ filters, facets, languages, licenses, onToggle, onChange }: Props) {
  return (
    <div>
      <Section title="Type">
        <CheckList
          items={KINDS.map((k) => ({ id: k.id, label: k.label }))}
          selected={filters.kinds}
          counts={facets?.kinds}
          onToggle={(id) => onToggle("kinds", id)}
          initial={KINDS.length}
        />
      </Section>

      <Section title="Category">
        <CheckList
          items={GENERAL_CATEGORIES}
          selected={filters.categories}
          counts={facets?.categories}
          onToggle={(id) => onToggle("categories", id)}
          initial={GENERAL_CATEGORIES.length}
        />
      </Section>

      <Section title="AI">
        <CheckList
          items={AI_CATEGORIES}
          selected={filters.categories}
          counts={facets?.categories}
          onToggle={(id) => onToggle("categories", id)}
          initial={AI_CATEGORIES.length}
        />
      </Section>

      <Section title="Stars">
        <Segmented
          label="Minimum stars"
          value={filters.minStars}
          onSelect={(minStars) => onChange({ minStars })}
          options={STAR_STEPS.map((n) => ({ value: n, label: starLabel(n) }))}
        />
      </Section>

      <Section title="Language">
        <CheckList
          items={languages.map((l) => ({ id: l, label: l }))}
          selected={filters.languages}
          counts={facets?.languages}
          onToggle={(id) => onToggle("languages", id)}
          searchable
        />
      </Section>

      <Section title="License">
        <CheckList
          items={licenses.map((l) => ({ id: l, label: l }))}
          selected={filters.licenses}
          counts={facets?.licenses}
          onToggle={(id) => onToggle("licenses", id)}
          initial={6}
        />
      </Section>
    </div>
  );
}
