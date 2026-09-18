import { XMLParser } from "fast-xml-parser";
import type { Article, SourceAdapter, SourceDefinition } from "../domain/types.js";
import { normalizeUrl, sha256, stripHtml } from "../lib/text.js";
import { HttpClient } from "./http.js";

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function scalar(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return scalar(record["#text"] ?? record.href ?? record["@_href"] ?? "");
  }
  return "";
}

export class RssAdapter implements SourceAdapter {
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true });

  constructor(private readonly http: HttpClient, private readonly limit: number) {}

  async fetch(source: SourceDefinition): Promise<Article[]> {
    const { body } = await this.http.get(source.url);
    const document = this.parser.parse(body) as Record<string, any>;
    const rawItems = document.rss?.channel?.item ?? document.feed?.entry ?? document["rdf:RDF"]?.item;
    const retrievedAt = new Date().toISOString();
    return asArray<Record<string, unknown>>(rawItems).slice(0, this.limit).flatMap((item) => {
      const title = stripHtml(scalar(item.title));
      const link = normalizeUrl(scalar(item.link) || scalar(item.guid) || scalar(item.id));
      const content = stripHtml(scalar(item["content:encoded"]) || scalar(item.content) || scalar(item.description) || scalar(item.summary));
      const published = scalar(item.isoDate) || scalar(item.pubDate) || scalar(item.published) || scalar(item.updated) || scalar(item.date);
      if (!title || !link) return [];
      const publishedAt = published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null;
      return [{
        sourceId: source.id,
        sourceName: source.name,
        title,
        url: link,
        publishedAt,
        content,
        retrievedAt,
        contentHash: sha256(`${title}\n${content}`),
      } satisfies Article];
    });
  }
}
