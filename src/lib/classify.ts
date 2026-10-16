import {
  APP_TOPICS,
  CATEGORIES,
  DESKTOP_TOPICS,
  LIBRARY_TOPICS,
  PLATFORMS,
  RESOURCE_TOPICS,
  TOOL_TOPICS,
  type Kind,
} from "./taxonomy";

export type ClassifyInput = {
  name?: string;
  topics: string[];
  description: string | null;
  language: string | null;
};

export type Classification = {
  platforms: string[];
  categories: string[];
  kind: Kind;
};

// Description phrases that reliably name a platform. Kept narrow on purpose:
// "linux" or "windows" alone appear in too many unrelated descriptions.
const DESCRIPTION_PLATFORM_HINTS: [RegExp, string][] = [
  [/\bfor android\b|\bandroid (app|application|client)\b/i, "android"],
  [/\bfor ios\b|\bios (app|application|client)\b|\biphone\b/i, "ios"],
  [/\bfor macos\b|\bmacos (app|application|menu ?bar)\b|\bmenu ?bar app\b|\bfor mac\b/i, "macos"],
  [/\bfor windows\b|\bwindows (app|application)\b/i, "windows"],
  [/\bfor linux\b|\blinux (app|application|desktop)\b/i, "linux"],
  [/\bself-?hosted\b/i, "selfhosted"],
  [/\bbrowser extension\b|\bchrome extension\b|\bfirefox (extension|add-?on)\b/i, "extension"],
  [/\bcommand[- ]line\b|\bcli tool\b|\bterminal (ui|app|client)\b/i, "cli"],
  [/\bweb (app|application|ui)\b|\bprogressive web app\b/i, "web"],
  [/\bmcp server\b|\bmodel context protocol\b|\bclaude code (plugin|skill|extension)s?\b|\bagent skills?\b|\bfor (chatgpt|claude|claude code|codex|cursor|copilot)\b/i, "ai"],
];

const DESCRIPTION_LIBRARY = /\b(library|libraries|framework|sdk|toolkit|bindings|wrapper|component library|ui kit|boilerplate|starter kit|template|http client|for the jvm|kotlin multiplatform library|swift package|plugin for)\b/i;
const DESCRIPTION_RESOURCE = /\b(curated list|awesome list|a list of|list of (awesome|free|useful)|collection of (samples|examples|resources|tutorials|links|books)|free (programming )?books|programming books|tutorials?|cheat ?sheets?|interview questions|roadmap|learning path|samples?|code examples|icon (set|pack|font)|material design icons|study guide)\b/i;
const NAME_RESOURCE = /^(awesome|learn-|.*-(samples|examples|tutorials?|books|interview|roadmap|guide|cheatsheet)$)/i;
const DESCRIPTION_APP = /\b(app|application|client|player|editor|manager|launcher|reader|viewer|browser|server for)\b/i;

const topicIndex = (list: { id: string; topics: string[] }[]) => {
  const map = new Map<string, string[]>();
  for (const entry of list) {
    for (const topic of entry.topics) {
      map.set(topic, [...(map.get(topic) ?? []), entry.id]);
    }
  }
  return map;
};

const PLATFORM_BY_TOPIC = topicIndex(PLATFORMS);
const CATEGORY_BY_TOPIC = topicIndex(CATEGORIES);

export function classify({ name = "", topics, description, language }: ClassifyInput): Classification {
  const topicSet = new Set(topics.map((t) => t.toLowerCase()));
  const platforms = new Set<string>();
  const categories = new Set<string>();

  for (const topic of topicSet) {
    PLATFORM_BY_TOPIC.get(topic)?.forEach((p) => platforms.add(p));
    CATEGORY_BY_TOPIC.get(topic)?.forEach((c) => categories.add(c));
  }
  if (DESKTOP_TOPICS.some((t) => topicSet.has(t))) {
    platforms.add("windows").add("macos").add("linux");
  }

  const text = description ?? "";
  for (const [pattern, platform] of DESCRIPTION_PLATFORM_HINTS) {
    if (pattern.test(text)) platforms.add(platform);
  }

  // Language hints only fill gaps: an untagged Swift app is most likely Apple.
  if (platforms.size === 0 && language === "Swift" && /\b(app|macos|mac)\b/i.test(text)) {
    platforms.add(/\bmac/i.test(text) ? "macos" : "ios");
  }

  return {
    platforms: PLATFORMS.map((p) => p.id).filter((id) => platforms.has(id)),
    categories: CATEGORIES.map((c) => c.id).filter((id) => categories.has(id)),
    kind: detectKind(name, topicSet, text, platforms),
  };
}

function detectKind(name: string, topics: Set<string>, description: string, platforms: Set<string>): Kind {
  // Lists and learning material often carry app topics (awesome-selfhosted is tagged self-hosted), so they are checked first.
  if (NAME_RESOURCE.test(name) || DESCRIPTION_RESOURCE.test(description) || RESOURCE_TOPICS.some((t) => topics.has(t))) {
    return "resource";
  }
  const hasLibrary = LIBRARY_TOPICS.some((t) => topics.has(t)) || DESCRIPTION_LIBRARY.test(description);
  const hasApp = APP_TOPICS.some((t) => topics.has(t));
  if (hasApp) return "app";
  if (hasLibrary) return "library";

  const onlyCli = platforms.size === 1 && platforms.has("cli");
  if (onlyCli || TOOL_TOPICS.some((t) => topics.has(t))) return "tool";
  if (platforms.size > 0 || DESCRIPTION_APP.test(description)) return "app";
  return "tool";
}
