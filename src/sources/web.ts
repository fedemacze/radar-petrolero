import type { Article, SourceAdapter, SourceDefinition } from "../domain/types.js";
import { normalizeUrl, sha256, stripHtml } from "../lib/text.js";
import { HttpClient } from "./http.js";

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export class WebAdapter implements SourceAdapter {
  constructor(private readonly http: HttpClient, private readonly limit: number) {}

  async fetch(source: SourceDefinition): Promise<Article[]> {
    const { body, finalUrl } = await this.http.get(source.url);
    const base = new URL(finalUrl);
    const candidates = new Map<string, string>();
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(body)) && candidates.size < this.limit * 4) {
      const href = match[1];
      const label = stripHtml(decodeEntities(match[2] ?? ""));
      if (!href || label.length < 25) continue;
      let url: URL;
      try { url = new URL(href, base); } catch { continue; }
      if (url.hostname !== base.hostname || url.protocol !== "https:") continue;
      if (source.articleLinkPattern && !url.pathname.includes(source.articleLinkPattern)) continue;
      if (/\.(pdf|jpg|jpeg|png|webp|zip)$/i.test(url.pathname)) continue;
      candidates.set(normalizeUrl(url.toString()), label);
    }

    const selected = [...candidates.entries()].slice(0, Math.min(this.limit, 20));
    const results: Article[] = [];
    for (let index = 0; index < selected.length; index += 4) {
      const batch = selected.slice(index, index + 4);
      const articles = await Promise.all(batch.map(async ([url, listingTitle]) => {
        try {
          const page = await this.http.get(url);
          const title = this.meta(page.body, "(?:property|name)=[\"'](?:og:title|twitter:title)[\"']")
            || stripHtml(page.body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")
            || listingTitle;
          const dateText = this.meta(page.body, "(?:property|name)=[\"'](?:article:published_time|datePublished|date)[\"']")
            || page.body.match(/<time\b[^>]*datetime=[\"']([^\"']+)[\"']/i)?.[1]
            || "";
          const articleHtml = page.body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
            || page.body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
            || "";
          const content = stripHtml(articleHtml).slice(0, 30_000) || listingTitle;
          const publishedAt = dateText && !Number.isNaN(Date.parse(dateText)) ? new Date(dateText).toISOString() : null;
          return { sourceId: source.id, sourceName: source.name, title, url, publishedAt, content, retrievedAt: new Date().toISOString(), contentHash: sha256(`${title}\n${content}`) } satisfies Article;
        } catch {
          return { sourceId: source.id, sourceName: source.name, title: listingTitle, url, publishedAt: null, content: listingTitle, retrievedAt: new Date().toISOString(), contentHash: sha256(listingTitle) } satisfies Article;
        }
      }));
      results.push(...articles);
    }
    return results;
  }

  private meta(body: string, selector: string): string {
    const first = new RegExp(`<meta\\b[^>]*${selector}[^>]*content=[\"']([^\"']+)[\"'][^>]*>`, "i").exec(body)?.[1];
    const reversed = new RegExp(`<meta\\b[^>]*content=[\"']([^\"']+)[\"'][^>]*${selector}[^>]*>`, "i").exec(body)?.[1];
    return decodeEntities(first ?? reversed ?? "");
  }
}

export class UnsupportedApiAdapter implements SourceAdapter {
  async fetch(source: SourceDefinition): Promise<Article[]> {
    throw new Error(`La fuente API ${source.id} no tiene adaptador configurado`);
  }
}
