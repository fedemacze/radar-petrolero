import { OpportunityAnalyzer } from "./analysis/openai.js";
import { AttioClient } from "./clients/attio.js";
import { loadEnv } from "./config/env.js";
import { Database } from "./db/database.js";
import { Logger } from "./lib/logger.js";
import { RadarRunner } from "./pipeline/runner.js";
import { HttpClient, SourceRouter } from "./sources/http.js";
import { RssAdapter } from "./sources/rss.js";
import { UnsupportedApiAdapter, WebAdapter } from "./sources/web.js";

const env = loadEnv();
const dryRun = process.argv.includes("--dry-run") || env.DRY_RUN || !env.ATTIO_PUBLICATION_ENABLED;
if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY es obligatoria para analizar oportunidades");
if (!dryRun && !env.ATTIO_API_KEY) throw new Error("ATTIO_API_KEY es obligatoria cuando DRY_RUN=false");

const logger = new Logger(env.LOG_LEVEL);
const database = new Database(env.DATABASE_URL);
const http = new HttpClient(env.SOURCE_TIMEOUT_MS);
const sourceAdapter = new SourceRouter({
  rss: new RssAdapter(http, env.MAX_ARTICLES_PER_SOURCE),
  web: new WebAdapter(http, env.MAX_ARTICLES_PER_SOURCE),
  api: new UnsupportedApiAdapter(),
});
const analyzer = new OpportunityAnalyzer(env.OPENAI_API_KEY, env.OPENAI_MODEL);
const attio = env.ATTIO_API_KEY ? new AttioClient({ apiKey: env.ATTIO_API_KEY, object: env.ATTIO_OBJECT, stageAttributeId: env.ATTIO_STAGE_ATTRIBUTE_ID, detectedStageId: env.ATTIO_DETECTED_STAGE_ID }) : null;

try {
  await database.migrate();
  if (!dryRun && attio) await attio.validateAttributes();
  const summary = await new RadarRunner({ database, sourceAdapter, analyzer, attio, logger, dryRun, attioSyncLimit: env.ATTIO_SYNC_LIMIT }).run();
  logger.info("Ejecución finalizada", summary as unknown as Record<string, unknown>);
} catch (error) {
  logger.error("Ejecución abortada", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  await database.close();
}
