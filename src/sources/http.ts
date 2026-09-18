import type { Article, SourceAdapter, SourceDefinition } from "../domain/types.js";

export class HttpClient {
  constructor(private readonly timeoutMs: number) {}

  async get(url: string): Promise<{ body: string; contentType: string; finalUrl: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": "RadarPetrolero/0.1 (+contacto comercial Vermaz; lector de noticias)",
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return {
        body: await response.text(),
        contentType: response.headers.get("content-type") ?? "",
        finalUrl: response.url,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class SourceRouter implements SourceAdapter {
  constructor(
    private readonly adapters: Record<SourceDefinition["type"], SourceAdapter>,
  ) {}

  fetch(source: SourceDefinition): Promise<Article[]> {
    return this.adapters[source.type].fetch(source);
  }
}
