// Picks a logo and a screenshot out of a README (markdown with inline HTML).

export type ReadmeImage = {
  url: string;
  alt: string;
  width: number | null;
};

export type ReadmeContext = {
  owner: string;
  repo: string;
  branch: string;
  // Directory of the README inside the repo, "" for the root.
  dir?: string;
};

export type ReadmeMedia = {
  logo: string | null;
  screenshot: string | null;
};

const BADGE_HOSTS = /(shields\.io|badgen\.net|badge\.fury\.io|travis-ci\.|circleci\.com|codecov\.io|coveralls\.io|app\.codacy|sonarcloud|herokucdn|buymeacoffee|ko-fi\.com|liberapay|opencollective\.com|patreon|paypal|deepscan|snyk\.io|godoc\.org|goreportcard|pkg\.go\.dev|repology\.org|hosted\.weblate|translate\.|weblate\.org|crowdin|gitter\.im|discord(app)?\.com\/api|img\.badgesize|readthedocs\.org\/projects|api\.netlify|vercel\.com\/button|deploy\.|star-history\.com|starchart\.cc|contrib\.rocks|api\.star-history|trendshift\.io|producthunt\.com|github-readme-stats|komarev\.com|visitor-badge|hits\.seeyoufarm|ghbtns|forthebadge|awesome\.re|cdn\.rawgit\.com\/sindresorhus\/awesome|github\.com\/[^/]+\/[^/]+\/(actions\/)?workflows\/.+\/badge)/i;
const BADGE_PATH = /(badge|shield|button|sponsor|backers|donat|coffee|wechat|weixin|alipay|qr-?code|qrcode|paypal|kofi|patreon|integrations?\/|partners?\/|sponsors?\/|supporters?\/|companies\/|used-by|powered-by|download-on|get-it-on|app-store|google-play|play-store|f-droid\.png|fdroid-badge|get_it_on|flathub-badge|snap-store|microsoft-store|mac-app-store|license|contributors|stars?(-|_)?history)/i;
const LOGO_HINT = /(logo|icon|mascot|emblem)/i;
// Project logos sit at the top of a README; logos further down are usually sponsors or integrations.
const LOGO_WINDOW = 3;
const SCREENSHOT_HINT = /(screenshot|screen[-_ ]?shot|screen|demo|preview|showcase|example|usage|interface|ui[-_.]|gui|overview|hero|cover|banner|teaser)/i;
const RASTER = /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i;

export function extractImages(markdown: string): ReadmeImage[] {
  const images: ReadmeImage[] = [];
  const references = new Map<string, string>();

  // Reference definitions: [id]: url "title"
  for (const match of markdown.matchAll(/^\s*\[([^\]]+)\]:\s*<?(\S+?)>?(?:\s+["'(].*)?$/gm)) {
    references.set(match[1].toLowerCase(), match[2]);
  }

  const tokens: { index: number; image: ReadmeImage }[] = [];

  // Inline markdown: ![alt](url "title")
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g)) {
    tokens.push({ index: match.index ?? 0, image: { alt: match[1], url: match[2], width: null } });
  }

  // Reference markdown: ![alt][id] or ![alt]
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\[([^\]]*)\]/g)) {
    const id = (match[2] || match[1]).toLowerCase();
    const url = references.get(id);
    if (url) tokens.push({ index: match.index ?? 0, image: { alt: match[1], url, width: null } });
  }

  // HTML <img ...>
  for (const match of markdown.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = attr(tag, "src") ?? attr(tag, "data-canonical-src");
    if (!src) continue;
    const width = Number.parseInt(attr(tag, "width") ?? "", 10);
    tokens.push({
      index: match.index ?? 0,
      image: { url: src, alt: attr(tag, "alt") ?? "", width: Number.isFinite(width) ? width : null },
    });
  }

  // <picture><source srcset> usually duplicates the <img>, so it is ignored.
  tokens.sort((a, b) => a.index - b.index);
  for (const token of tokens) images.push(token.image);
  return images;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

export function resolveImageUrl(raw: string, ctx: ReadmeContext): string | null {
  const url = raw.trim().replace(/&amp;/g, "&");
  if (!url || url.startsWith("data:") || url.startsWith("#")) return null;

  if (/^https?:\/\//i.test(url)) {
    // github.com/<o>/<r>/blob/<branch>/<path> and /raw/ are served by raw.githubusercontent.com
    const blob = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+?)(\?raw=true)?$/i);
    if (blob) return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`;
    return url.replace(/^http:\/\//i, "https://");
  }
  if (url.startsWith("//")) return `https:${url}`;

  const base = url.startsWith("/") ? "" : ctx.dir ? `${ctx.dir.replace(/\/$/, "")}/` : "";
  const path = normalisePath(`${base}${url.replace(/^\//, "")}`);
  return `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${ctx.branch}/${path}`;
}

function normalisePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function isBadge(image: ReadmeImage, url: string): boolean {
  if (BADGE_HOSTS.test(url)) return true;
  const file = url.split(/[?#]/)[0];
  if (BADGE_PATH.test(file) || BADGE_PATH.test(image.alt)) return true;
  // Tiny explicit widths are badges or inline icons.
  if (image.width !== null && image.width < 48) return true;
  if (/\.svg(\?|#|$)/i.test(url) && !LOGO_HINT.test(file) && !LOGO_HINT.test(image.alt)) return true;
  return false;
}

function isGithubAsset(url: string): boolean {
  return /github\.com\/user-attachments\/assets\/|user-images\.githubusercontent\.com|private-user-images\.githubusercontent\.com/i.test(url);
}

export function pickReadmeMedia(markdown: string, ctx: ReadmeContext): ReadmeMedia {
  let logo: string | null = null;
  let hinted: string | null = null;
  let fallback: string | null = null;

  let position = 0;
  for (const image of extractImages(markdown)) {
    const url = resolveImageUrl(image.url, ctx);
    if (!url || isBadge(image, url)) continue;
    position++;

    const file = url.split(/[?#]/)[0];
    const looksLikeLogo = LOGO_HINT.test(file) || LOGO_HINT.test(image.alt) || (image.width !== null && image.width <= 200);
    if (looksLikeLogo) {
      if (position <= LOGO_WINDOW) logo ??= url;
      continue;
    }
    if (!RASTER.test(url) && !isGithubAsset(url)) continue;
    if (!hinted && (SCREENSHOT_HINT.test(file) || SCREENSHOT_HINT.test(image.alt))) hinted = url;
    fallback ??= url;
  }

  return { logo, screenshot: hinted ?? fallback };
}
