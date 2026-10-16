export function formatStars(stars: number): string {
  if (stars < 1000) return String(stars);
  if (stars < 10_000) return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (stars < 1_000_000) return `${Math.round(stars / 1000)}k`;
  return `${(stars / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

const monthYear = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const formatMonthYear = (date: Date) => monthYear.format(date);
export const formatFullDate = (date: Date) => fullDate.format(date);

export function formatAge(date: Date, now = new Date()): string {
  const months = (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + now.getUTCMonth() - date.getUTCMonth();
  if (months < 1) return "this month";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export const formatCount = (n: number) => n.toLocaleString("en");

// Measured growth comes from nightly snapshots; otherwise it is an average since creation.
export function formatGrowth(weekly: number, measured: boolean): string {
  return measured ? `+${formatStars(weekly)} this week` : `~${formatStars(weekly)} a week`;
}

export const growthHint = (measured: boolean) =>
  measured ? "Stars gained in the last 7 days" : "Estimated from the average stars per day since the project started";

// Stable hue per project for image placeholders.
export function hueOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

// Common GitHub linguist colours for the language dot.
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Kotlin: "#A97BFF",
  Java: "#b07219",
  Swift: "#F05138",
  Rust: "#dea584",
  Go: "#00ADD8",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Dart: "#00B4AB",
  Vue: "#41b883",
  PHP: "#4F5D95",
  Ruby: "#701516",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Svelte: "#ff3e00",
  "Objective-C": "#438eff",
  Lua: "#000080",
  Elixir: "#6e4a7e",
  Zig: "#ec915c",
  Nim: "#ffc200",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  Clojure: "#db5855",
  QML: "#44a51c",
  Vala: "#a56de2",
};
