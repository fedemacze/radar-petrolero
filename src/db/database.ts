import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { AnalysisMetadata, Article, EventCandidate, Opportunity, PrefilterResult, RunSummary, SourceDefinition } from "../domain/types.js";
import type { ExistingEventFingerprint } from "../pipeline/deduplicator.js";
import { normalizeUrl } from "../lib/text.js";
import { enforceCommercialGate } from "../pipeline/commercial-gate.js";

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

  async getPipelineCounts(): Promise<{ articles: number; events: number; linkedArticles: number; opportunities: number; pendingEvents: number }> {
    const result = await this.pool.query<{
      articles: string; events: string; linked_articles: string; opportunities: string; pending_events: string;
    }>(`SELECT
      (SELECT count(*) FROM articles) AS articles,
      (SELECT count(*) FROM events) AS events,
      (SELECT count(*) FROM event_articles) AS linked_articles,
      (SELECT count(*) FROM opportunities) AS opportunities,
      (SELECT count(*) FROM events e LEFT JOIN opportunities o ON o.event_key=e.event_key WHERE o.event_key IS NULL) AS pending_events`);
    const row = result.rows[0]!;
    return {
      articles: Number(row.articles), events: Number(row.events), linkedArticles: Number(row.linked_articles),
      opportunities: Number(row.opportunities), pendingEvents: Number(row.pending_events),
    };
  }

  async getDashboardSnapshot(): Promise<Record<string, unknown>> {
    const [opportunities, sources, runs] = await Promise.all([
      this.pool.query(`SELECT o.event_key,o.opportunity,o.analyzed_at,o.input_tokens,o.output_tokens,o.attio_record_id,
          e.title,a.url AS source_url
        FROM opportunities o JOIN events e ON e.event_key=o.event_key
        LEFT JOIN articles a ON a.id=e.primary_article_id
        ORDER BY o.analyzed_at DESC LIMIT 200`),
      this.pool.query(`SELECT id,name,type,region,priority,last_success_at,last_error_at,last_error
        FROM sources ORDER BY priority,name`),
      this.pool.query(`SELECT id,started_at,finished_at,status,dry_run,summary,error
        FROM runs ORDER BY started_at DESC LIMIT 30`),
    ]);
    const usage = opportunities.rows.reduce((total, row) => total + Number(row.input_tokens ?? 0) * 0.15 / 1_000_000 + Number(row.output_tokens ?? 0) * 0.60 / 1_000_000, 0);
    const gatedOpportunities = opportunities.rows.map((row) => {
      const event = {
        eventKey: row.event_key,
        primaryArticle: { title: row.title },
      } as unknown as EventCandidate;
      return { ...row, opportunity: enforceCommercialGate(event, row.opportunity as Opportunity) };
    });
    return { opportunities: gatedOpportunities, sources: sources.rows, runs: runs.rows, estimatedOpenAiUsd: usage };
  }

  async hasCompletedRunToday(): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM runs WHERE status='completed' AND started_at >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS exists",
    );
    return result.rows[0]?.exists ?? false;
  }

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

  async findPendingEvents(limit = 100): Promise<EventCandidate[]> {
    const result = await this.pool.query<{
      event_key: string; prefilter: PrefilterResult; primary_article_id: string | null; article_id: string;
      source_id: string; source_name: string; title: string; url: string; published_at: Date | null;
      content: string; content_hash: string; retrieved_at: Date;
    }>(`SELECT e.event_key,e.prefilter,e.primary_article_id,a.id AS article_id,
        a.source_id,a.source_name,a.title,a.url,a.published_at,a.content,a.content_hash,a.retrieved_at
      FROM events e
      JOIN event_articles ea ON ea.event_key=e.event_key
      JOIN articles a ON a.id=ea.article_id
      LEFT JOIN opportunities o ON o.event_key=e.event_key
      WHERE o.event_key IS NULL
      ORDER BY e.first_seen_at ASC,a.id ASC
      LIMIT $1`, [limit]);
    const grouped = new Map<string, { prefilter: PrefilterResult; primaryId: string | null; articles: Array<{ id: string; article: Article }> }>();
    for (const row of result.rows) {
      const item = grouped.get(row.event_key) ?? { prefilter: row.prefilter, primaryId: row.primary_article_id, articles: [] };
      item.articles.push({ id: row.article_id, article: {
        sourceId: row.source_id, sourceName: row.source_name, title: row.title, url: row.url,
        publishedAt: row.published_at?.toISOString() ?? null, content: row.content, contentHash: row.content_hash,
        retrievedAt: row.retrieved_at.toISOString(),
      } });
      grouped.set(row.event_key, item);
    }
    return [...grouped.entries()].map(([eventKey, item]) => ({
      eventKey,
      articles: item.articles.map(({ article }) => article),
      primaryArticle: item.articles.find(({ id }) => id === item.primaryId)?.article ?? item.articles[0]!.article,
      prefilter: item.prefilter,
    }));
  }

  async findUnsyncedQualifiedOpportunities(minimumScore: number, limit: number): Promise<Array<{ event: EventCandidate; opportunity: Opportunity }>> {
    const result = await this.pool.query<{
      event_key: string; opportunity: Opportunity; prefilter: PrefilterResult; primary_article_id: string | null; article_id: string;
      source_id: string; source_name: string; title: string; url: string; published_at: Date | null;
      content: string; content_hash: string; retrieved_at: Date;
    }>(`WITH pending AS (
        SELECT o.event_key,o.opportunity,e.prefilter,e.primary_article_id,o.analyzed_at
        FROM opportunities o JOIN events e ON e.event_key=o.event_key
        WHERE o.attio_record_id IS NULL
          AND (o.opportunity->>'relevante')::boolean=true
          AND (o.opportunity->>'score_radar')::int >= $1
        ORDER BY o.analyzed_at DESC LIMIT $2
      )
      SELECT p.event_key,p.opportunity,p.prefilter,p.primary_article_id,a.id AS article_id,
        a.source_id,a.source_name,a.title,a.url,a.published_at,a.content,a.content_hash,a.retrieved_at
      FROM pending p JOIN event_articles ea ON ea.event_key=p.event_key
      JOIN articles a ON a.id=ea.article_id
      ORDER BY p.analyzed_at DESC,a.id ASC`, [minimumScore, limit]);
    const grouped = new Map<string, { opportunity: Opportunity; prefilter: PrefilterResult; primaryId: string | null; articles: Array<{ id: string; article: Article }> }>();
    for (const row of result.rows) {
      const item = grouped.get(row.event_key) ?? { opportunity: row.opportunity, prefilter: row.prefilter, primaryId: row.primary_article_id, articles: [] };
      item.articles.push({ id: row.article_id, article: {
        sourceId: row.source_id, sourceName: row.source_name, title: row.title, url: row.url,
        publishedAt: row.published_at?.toISOString() ?? null, content: row.content, contentHash: row.content_hash,
        retrievedAt: row.retrieved_at.toISOString(),
      } });
      grouped.set(row.event_key, item);
    }
    return [...grouped.entries()].map(([eventKey, item]) => ({
      opportunity: item.opportunity,
      event: {
        eventKey, articles: item.articles.map(({ article }) => article),
        primaryArticle: item.articles.find(({ id }) => id === item.primaryId)?.article ?? item.articles[0]!.article,
        prefilter: item.prefilter,
      },
    }));
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
