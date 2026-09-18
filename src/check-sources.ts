import { SOURCES } from "./config/radar.js";
import { loadEnv } from "./config/env.js";
import { HttpClient, SourceRouter } from "./sources/http.js";
import { RssAdapter } from "./sources/rss.js";
import { UnsupportedApiAdapter, WebAdapter } from "./sources/web.js";

const env = loadEnv({ ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://unused" });
const http = new HttpClient(env.SOURCE_TIMEOUT_MS);
const router = new SourceRouter({ rss: new RssAdapter(http, 5), web: new WebAdapter(http, 5), api: new UnsupportedApiAdapter() });
let succeeded = 0;
for (const source of SOURCES.filter((item) => item.enabled)) {
  try {
    const articles = await router.fetch(source);
    if (!articles.length) throw new Error("sin artículos detectados");
    succeeded += 1;
    console.log(JSON.stringify({ source: source.id, status: "ok", articles: articles.length }));
  } catch (error) {
    console.log(JSON.stringify({ source: source.id, status: "error", error: error instanceof Error ? error.message : String(error) }));
  }
}
console.log(JSON.stringify({ total: SOURCES.length, succeeded, failed: SOURCES.length - succeeded }));
if (succeeded < 15) process.exitCode = 1;
