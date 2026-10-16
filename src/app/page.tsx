import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Catalog, type InitialData } from "@/components/Catalog";
import type { SearchIndex } from "@/lib/index-format";
import { DEFAULT_FILTERS, prepareIndex, search } from "@/lib/search";

// Runs at build time: the static HTML carries the first page of the default view
// so the catalog is useful before the full index downloads.
async function loadInitial(): Promise<InitialData> {
  const raw = JSON.parse(await readFile(join(process.cwd(), "public", "data", "index.json"), "utf8")) as SearchIndex;
  const { matches, facets } = search(prepareIndex(raw), DEFAULT_FILTERS);
  return {
    rows: matches.slice(0, 12).map((i) => raw.repos[i]),
    total: matches.length,
    facets,
    languages: raw.languages,
    licenses: raw.licenses,
    generatedAt: raw.generatedAt,
  };
}

export default async function Home() {
  return <Catalog initial={await loadInitial()} />;
}
