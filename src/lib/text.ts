import { createHash } from "node:crypto";

const STOPWORDS = new Set([
  "ante", "bajo", "como", "con", "contra", "desde", "donde", "durante", "entre", "hacia",
  "hasta", "para", "pero", "porque", "sobre", "tras", "una", "uno", "unos", "unas", "del",
  "las", "los", "que", "por", "sus", "este", "esta", "estos", "estas", "más", "mas", "fue",
]);

export function stripHtml(value: string): string {
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#(?:8211|8212);/gi, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeText(value: string): string {
  return stripHtml(value)
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): Set<string> {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length >= 3 && !STOPWORDS.has(token)));
}

export function jaccard(left: string, right: string): number {
  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["fbclid", "gclid", "output"].includes(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function uniqueNormalized(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = normalizeText(value);
    if (key && !seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()];
}
