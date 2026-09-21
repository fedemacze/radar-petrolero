import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { AnalysisMetadata, Article, ContractFinding, EventCandidate, Opportunity, PrefilterResult, RunSummary, SourceDefinition } from "../domain/types.js";
import type { ExistingEventFingerprint } from "../pipeline/deduplicator.js";
import { normalizeUrl } from "../lib/text.js";
import { normalizeText, sha256 } from "../lib/text.js";
import { enforceCommercialGate } from "../pipeline/commercial-gate.js";
import { CURATED_CONTRACTS, CURATED_OPPORTUNITIES } from "../config/curated-intelligence.js";

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
    const contracts = [...CURATED_CONTRACTS, ...await this.getExpiringContracts()];
    const contacts = await this.listContacts();
    const followups = await this.listFollowups();
    const mergedOpportunities = [...CURATED_OPPORTUNITIES, ...gatedOpportunities.filter((row) => !CURATED_OPPORTUNITIES.some((item) => item.event_key === row.event_key))];
    return { opportunities: mergedOpportunities, contracts, contacts, followups, sources: sources.rows, runs: runs.rows, estimatedOpenAiUsd: usage };
  }

  async listContacts(): Promise<unknown[]> {
    return (await this.pool.query(`SELECT id,name,company,role,email,phone,linkedin_url,internal_owner,source,source_updated_at,updated_at
      FROM contacts ORDER BY company,name`)).rows;
  }

  async listFollowups(): Promise<unknown[]> {
    return (await this.pool.query("SELECT event_key,status,contact_id,notes,contacted_at,updated_at FROM opportunity_followups")).rows;
  }

  async importContacts(rows: Array<Record<string, string>>, source = "csv"): Promise<{ imported: number; skipped: number }> {
    let imported = 0; let skipped = 0;
    for (const row of rows) {
      const firstMatchingValue = (pattern: RegExp): string => Object.entries(row).find(([key, value]) => pattern.test(key) && value.trim())?.[1]?.trim() ?? "";
      const composedEnglishName = `${row.first_name || ""} ${row.middle_name || ""} ${row.last_name || ""}`.replace(/\s+/g, " ").trim();
      const composedSpanishName = `${row.nombre || ""} ${row.segundo_nombre || ""} ${row.apellidos || row.apellido || ""}`.replace(/\s+/g, " ").trim();
      const name = (row.name || row.names || row.full_name || row.display_name || composedEnglishName || composedSpanishName).trim();
      const company = (row.empresa || row.company || row.company_name || row.organizacion || row.organization || row.organization_name || "").trim();
      const role = (row.cargo || row.role || row.puesto || row.puesto_de_trabajo || row.job_title || row.title || row.organization_title || "").trim();
      const email = (row.email || row.correo || row.correo_electronico || row.direccion_de_correo_electronico || row.e_mail_address || row.email_address || row.primary_email || firstMatchingValue(/^e_mail_\d+_(value|address)$/)).trim().toLowerCase();
      const phone = (row.telefono || row.phone || row.celular || row.telefono_del_trabajo || row.telefono_movil || row.business_phone || row.mobile_phone || row.home_phone || firstMatchingValue(/^phone_\d+_value$/)).trim();
      const linkedin = (row.linkedin || row.linkedin_url || row.pagina_web || row.web_page || row.website || firstMatchingValue(/^(website|url)_\d+_value$/)).trim();
      if (!name || (!company && !email && !phone)) { skipped += 1; continue; }
      const sourceKey = email || sha256(`${normalizeText(name)}|${normalizeText(company)}|${normalizeText(role)}`);
      const rawUpdatedAt = (row.ultima_actualizacion || row.updated_at || "").trim();
      const sourceUpdatedAt = rawUpdatedAt && !Number.isNaN(Date.parse(rawUpdatedAt)) ? new Date(rawUpdatedAt).toISOString() : null;
      await this.pool.query(`INSERT INTO contacts(name,company,normalized_company,role,email,phone,linkedin_url,internal_owner,source,source_key,source_updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT(source,source_key) DO UPDATE SET name=EXCLUDED.name,company=EXCLUDED.company,normalized_company=EXCLUDED.normalized_company,role=EXCLUDED.role,email=EXCLUDED.email,phone=EXCLUDED.phone,linkedin_url=EXCLUDED.linkedin_url,internal_owner=EXCLUDED.internal_owner,source_updated_at=EXCLUDED.source_updated_at,updated_at=now()`,
        [name, company, normalizeText(company), role, email, phone, linkedin, (row.responsable || row.internal_owner || "").trim(), source, sourceKey, sourceUpdatedAt]);
      imported += 1;
    }
    return { imported, skipped };
  }

  async saveFollowup(eventKey: string, status: string, contactId: number | null, notes: string): Promise<void> {
    if (!['pending','contacted','replied','discarded'].includes(status)) throw new Error("Estado comercial inválido");
    await this.pool.query(`INSERT INTO opportunity_followups(event_key,status,contact_id,notes,contacted_at) VALUES($1,$2,$3,$4,CASE WHEN $2='contacted' THEN now() ELSE NULL END)
      ON CONFLICT(event_key) DO UPDATE SET status=EXCLUDED.status,contact_id=EXCLUDED.contact_id,notes=EXCLUDED.notes,
        contacted_at=CASE WHEN EXCLUDED.status='contacted' THEN now() ELSE opportunity_followups.contacted_at END,updated_at=now()`, [eventKey, status, contactId, notes.slice(0, 4000)]);
  }

  async findContractCandidates(limit = 4): Promise<Array<{ id: number; article: Article }>> {
    const result = await this.pool.query<any>(`SELECT a.* FROM articles a LEFT JOIN contract_reviews c ON c.article_id=a.id
      WHERE c.article_id IS NULL
        AND (a.title || ' ' || a.content) ~* '(contrato|adjudic|licitaci|renovaci|pr.rroga|concurso de precios)'
        AND (a.title || ' ' || a.content) ~* '(mantenimiento|ducto|ca.er.a|instalaciones|almac.n|log.stica|transporte|producci.n|workover|pulling)'
      ORDER BY a.published_at DESC NULLS LAST,a.id DESC LIMIT $1`, [limit]);
    return result.rows.map((row: any) => ({ id: Number(row.id), article: { sourceId: row.source_id, sourceName: row.source_name, title: row.title, url: row.url, publishedAt: row.published_at?.toISOString() ?? null, content: row.content, contentHash: row.content_hash, retrievedAt: row.retrieved_at.toISOString() } }));
  }

  async saveContractReview(articleId: number, finding: ContractFinding): Promise<void> {
    const addMonths = (date: string, months: number): string => { const value = new Date(`${date}T12:00:00Z`); value.setUTCMonth(value.getUTCMonth() + months); return value.toISOString().slice(0, 10); };
    let baseEnd = finding.explicit_end_date;
    let optionEnd: string | null = null;
    let confidence = finding.confidence;
    if (!baseEnd && finding.reference_date) {
      baseEnd = addMonths(finding.reference_date, finding.duration_months ?? 24);
      if (finding.duration_months === null) confidence = Math.min(confidence, 59);
    }
    if (baseEnd) optionEnd = addMonths(baseEnd, finding.option_months ?? 12);
    if (finding.option_months === null) confidence = Math.min(confidence, finding.duration_months === null ? 59 : 84);
    await this.pool.query(`INSERT INTO contract_reviews(article_id,relevant,finding,base_end_date,option_end_date,confidence)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(article_id) DO UPDATE SET relevant=EXCLUDED.relevant,finding=EXCLUDED.finding,base_end_date=EXCLUDED.base_end_date,option_end_date=EXCLUDED.option_end_date,confidence=EXCLUDED.confidence,reviewed_at=now()`,
      [articleId, finding.relevant, finding, baseEnd, optionEnd, confidence]);
  }

  async getExpiringContracts(): Promise<unknown[]> {
    const result = await this.pool.query(`SELECT c.article_id,c.finding,c.base_end_date,c.option_end_date,c.confidence,a.url AS source_url,a.source_name
      FROM contract_reviews c JOIN articles a ON a.id=c.article_id
      WHERE c.relevant=true AND c.confidence >= 35 AND (
        c.base_end_date BETWEEN current_date AND current_date + interval '6 months' OR
        c.option_end_date BETWEEN current_date AND current_date + interval '6 months')
      ORDER BY LEAST(COALESCE(c.base_end_date,'infinity'::date),COALESCE(c.option_end_date,'infinity'::date)) ASC`);
    return result.rows;
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
