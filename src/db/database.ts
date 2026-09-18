import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { AnalysisMetadata, Article, EventCandidate, Opportunity, RunSummary, SourceDefinition } from "../domain/types.js";
import type { ExistingEventFingerprint } from "../pipeline/deduplicator.js";
import { normalizeUrl } from "../lib/text.js";

const { Pool } = pg;
const LOCK_KEY = 1_934_728_011;

export class Database {
  readonly pool: pg.Pool;
  private lockClient: pg.PoolClient | null = null;

  constructor(connectionString: string) {
    const hostname = new URL(connectionString).hostname;
    const local = ["localhost", "127.0.0.1", "[::1]", "postgres"].includes(hostname) || hostname.endsWith(".railway.internal");
    this.pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000, ssl: local ? false : { rejectUnauthorized: true } });
  }

  async migrate(): Promise<void> {
    const path = fileURLToPath(new URL("./migration.sql", import.meta.url));
    await this.pool.query(await readFile(path, "utf8"));
  }

  async acquireLock(): Promise<boolean> {
    if (this.lockClient) throw new Error("Esta instancia ya posee el bloqueo de ejecución");
    const client = await this.pool.connect();
    const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock($1) AS acquired", [LOCK_KEY]);
    if (!result.rows[0]?.acquired) {
      client.release();
      return false;
    }
    this.lockClient = client;
    return true;
  }

  async releaseLock(): Promise<void> {
    if (!this.lockClient) return;
    try { await this.lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]); }
    finally { this.lockClient.release(); this.lockClient = null; }
  }
  async close(): Promise<void> { await this.pool.end(); }

  async upsertSource(source: SourceDefinition): Promise<void> {
    await this.pool.query(`INSERT INTO sources(id,name,type,url,region,priority,enabled) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,url=EXCLUDED.url,region=EXCLUDED.region,priority=EXCLUDED.priority,enabled=EXCLUDED.enabled,updated_at=now()`,
      [source.id, source.name, source.type, source.url, source.region, source.priority, source.enabled]);
  }

  async markSource(sourceId: string, error?: string): Promise<void> {
    if (error) await this.pool.query("UPDATE sources SET last_error_at=now(),last_error=$2 WHERE id=$1", [sourceId, error.slice(0, 2000)]);
    else await this.pool.query("UPDATE sources SET last_success_at=now(),last_error=NULL WHERE id=$1", [sourceId]);
  }

  async startRun(runId: string, dryRun: boolean): Promise<void> {
    await this.pool.query("INSERT INTO runs(id,status,dry_run) VALUES($1,'running',$2)", [runId, dryRun]);
  }

  async finishRun(runId: string, summary: RunSummary, error?: string): Promise<void> {
    await this.pool.query("UPDATE runs SET finished_at=now(),status=$2,summary=$3,error=$4 WHERE id=$1", [runId, error ? "failed" : "completed", summary, error ?? null]);
  }

  async insertArticle(article: Article, runId: string): Promise<{ id: number | null; inserted: boolean }> {
    const result = await this.pool.query<{ id: string }>(`INSERT INTO articles(source_id,source_name,title,url,normalized_url,published_at,content,content_hash,retrieved_at,first_run_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT DO NOTHING RETURNING id`, [article.sourceId, article.sourceName, article.title, article.url, normalizeUrl(article.url), article.publishedAt, article.content, article.contentHash, article.retrievedAt, runId]);
    if (result.rows[0]) return { id: Number(result.rows[0].id), inserted: true };
    const existing = await this.pool.query<{ id: string }>("SELECT id FROM articles WHERE normalized_url=$1 OR (source_id=$2 AND content_hash=$3) LIMIT 1", [normalizeUrl(article.url), article.sourceId, article.contentHash]);
    return { id: existing.rows[0] ? Number(existing.rows[0].id) : null, inserted: false };
  }

  async upsertEvent(event: EventCandidate, articleIds: number[]): Promise<void> {
    await this.pool.query(`INSERT INTO events(event_key,primary_article_id,title,prefilter) VALUES($1,$2,$3,$4)
      ON CONFLICT(event_key) DO UPDATE SET primary_article_id=EXCLUDED.primary_article_id,title=EXCLUDED.title,prefilter=EXCLUDED.prefilter,last_seen_at=now()`,
      [event.eventKey, articleIds[0] ?? null, event.primaryArticle.title, event.prefilter]);
    for (const articleId of articleIds) {
      await this.pool.query("INSERT INTO event_articles(event_key,article_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [event.eventKey, articleId]);
    }
  }

  async findRecentEvents(days = 45): Promise<ExistingEventFingerprint[]> {
    const result = await this.pool.query<{ event_key: string; title: string; prefilter: unknown }>(
      "SELECT event_key,title,prefilter FROM events WHERE last_seen_at >= now() - ($1::text || ' days')::interval ORDER BY last_seen_at DESC",
      [days],
    );
    return result.rows.map((row) => ({ eventKey: row.event_key, title: row.title, prefilter: row.prefilter as ExistingEventFingerprint["prefilter"] }));
  }

  async needsAnalysis(eventKey: string): Promise<boolean> {
    const result = await this.pool.query<{ needed: boolean }>(`SELECT o.event_key IS NULL OR o.analyzed_at < e.last_seen_at AS needed
      FROM events e LEFT JOIN opportunities o ON o.event_key=e.event_key WHERE e.event_key=$1`, [eventKey]);
    return result.rows[0]?.needed ?? true;
  }

  async saveAnalysis(eventKey: string, opportunity: Opportunity, metadata: AnalysisMetadata): Promise<void> {
    await this.pool.query(`INSERT INTO opportunities(event_key,opportunity,model,prompt_version,input_tokens,output_tokens,latency_ms,response_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(event_key) DO UPDATE SET opportunity=EXCLUDED.opportunity,model=EXCLUDED.model,prompt_version=EXCLUDED.prompt_version,input_tokens=EXCLUDED.input_tokens,output_tokens=EXCLUDED.output_tokens,latency_ms=EXCLUDED.latency_ms,response_id=EXCLUDED.response_id,analyzed_at=now()`,
      [eventKey, opportunity, metadata.model, metadata.promptVersion, metadata.inputTokens, metadata.outputTokens, metadata.latencyMs, metadata.rawResponseId]);
  }

  async getAttioRecordId(eventKey: string): Promise<string | null> {
    const result = await this.pool.query<{ attio_record_id: string | null }>("SELECT attio_record_id FROM opportunities WHERE event_key=$1", [eventKey]);
    return result.rows[0]?.attio_record_id ?? null;
  }

  async recordSync(runId: string, eventKey: string, action: string, status: string, recordId?: string, error?: string): Promise<void> {
    await this.pool.query("INSERT INTO sync_attempts(event_key,run_id,action,status,attio_record_id,error) VALUES($1,$2,$3,$4,$5,$6)", [eventKey, runId, action, status, recordId ?? null, error?.slice(0, 2000) ?? null]);
    if (status === "success" && recordId) await this.pool.query("UPDATE opportunities SET attio_record_id=$2,synced_at=now() WHERE event_key=$1", [eventKey, recordId]);
  }
}
