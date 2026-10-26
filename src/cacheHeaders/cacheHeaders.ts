const IMMUTABLE = "public, max-age=31536000, immutable";

export type Verdict = "immutable" | "mutable" | "hashed-but-mutable" | "unhashed-but-immutable";

export type ServedCache = Readonly<{ url: string; cacheControl: string | null; verdict: Verdict }>;

type Rule = Readonly<{ pattern: RegExp; cacheControl: readonly string[] }>;

const CONTENT_HASH = /(^|[/.])[0-9a-f]{16,}(?=\.|$)/;

export function servedCache(headers: string, files: readonly string[]): readonly ServedCache[] {
  const rules = parseRules(headers);
  return files.flatMap(urls).map((url) => {
    const values = rules.filter((rule) => rule.pattern.test(url)).flatMap((rule) => rule.cacheControl);
    const cacheControl = values.length > 0 ? values.join(", ") : null;
    return { url, cacheControl, verdict: verdict(CONTENT_HASH.test(url), cacheControl) };
  });
}

export function isViolation(verdict: Verdict): boolean {
  switch (verdict) {
    case "immutable":
    case "mutable":
      return false;
    case "hashed-but-mutable":
    case "unhashed-but-immutable":
      return true;
    default: {
      const unreachable: never = verdict;
      return unreachable;
    }
  }
}

function verdict(hashed: boolean, cacheControl: string | null): Verdict {
  if (hashed) return cacheControl === IMMUTABLE ? "immutable" : "hashed-but-mutable";
  return cacheControl?.includes("immutable") ? "unhashed-but-immutable" : "mutable";
}

function urls(file: string): readonly string[] {
  const url = `/${file}`;
  return url.endsWith("/index.html") ? [url.slice(0, -"index.html".length), url] : [url];
}

function parseRules(text: string): readonly Rule[] {
  const rules: { pattern: RegExp; cacheControl: string[] }[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === "" || line.trimStart().startsWith("#")) return;
    const header = /^\s+([^\s:]+):\s*(.*)$/.exec(line);
    const rule = rules[rules.length - 1];
    if (line.startsWith("/")) rules.push({ pattern: pathPattern(line.trim()), cacheControl: [] });
    else if (header && rule) {
      if (header[1].toLowerCase() === "cache-control") rule.cacheControl.push(header[2].trim());
    } else throw new Error(`_headers line ${index + 1} is neither a path rule nor a header of one: ${line}`);
  });
  return rules;
}

// Cloudflare's rules engine: "*" matches any characters including "/", and ":name" matches one path segment.
function pathPattern(rule: string): RegExp {
  const escaped = rule
    .split("*")
    .map((part) => part.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
    .join(".*")
    .replace(/:[A-Za-z]\w*/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}
