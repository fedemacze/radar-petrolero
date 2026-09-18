import { randomUUID } from "node:crypto";
import { ATTIO, SOURCES } from "../config/radar.js";
import type { AttioClient } from "../clients/attio.js";
import type { OpportunityAnalyzer } from "../analysis/openai.js";
import { FatalAnalysisError } from "../analysis/openai.js";
import type { Database } from "../db/database.js";
import type { Article, RunSummary, SourceAdapter } from "../domain/types.js";
import type { Logger } from "../lib/logger.js";
import { Prefilter } from "./prefilter.js";
import { Deduplicator } from "./deduplicator.js";

export interface RunnerDependencies {
  database: Database;
  sourceAdapter: SourceAdapter;
  analyzer: OpportunityAnalyzer;
  attio: AttioClient | null;
  logger: Logger;
  dryRun: boolean;
}

export class RadarRunner {
  private readonly prefilter = new Prefilter();
  private readonly deduplicator = new Deduplicator();

  constructor(private readonly deps: RunnerDependencies) {}

  async run(): Promise<RunSummary> {
    const runId = randomUUID();
    const summary: RunSummary = { runId, sourcesAttempted: 0, sourcesSucceeded: 0, articlesFetched: 0, articlesNew: 0, articlesAccepted: 0, eventsAnalyzed: 0, opportunitiesQualified: 0, attioCreated: 0, attioUpdated: 0, errors: 0 };
    if (!await this.deps.database.acquireLock()) throw new Error("Ya existe otra ejecución activa de Radar Petrolero");

    try {
      await this.deps.database.startRun(runId, this.deps.dryRun);
      const newArticles: Array<{ article: Article; id: number }> = [];
      for (const source of SOURCES.filter((item) => item.enabled)) {
        summary.sourcesAttempted += 1;
        await this.deps.database.upsertSource(source);
        try {
          const articles = await this.deps.sourceAdapter.fetch(source);
          summary.sourcesSucceeded += 1;
          summary.articlesFetched += articles.length;
          for (const article of articles) {
            const saved = await this.deps.database.insertArticle(article, runId);
            if (saved.inserted && saved.id !== null) {
              newArticles.push({ article, id: saved.id });
              summary.articlesNew += 1;
            }
          }
          await this.deps.database.markSource(source.id);
          this.deps.logger.info("Fuente procesada", { source: source.id, articles: articles.length });
        } catch (error) {
          summary.errors += 1;
          const message = error instanceof Error ? error.message : String(error);
          await this.deps.database.markSource(source.id, message);
          this.deps.logger.warn("Fuente fallida", { source: source.id, error: message });
        }
      }

      const evaluated = newArticles.map(({ article }) => ({ article, prefilter: this.prefilter.evaluate(article) })).filter((item) => item.prefilter.accepted);
      summary.articlesAccepted = evaluated.length;
      const existingEvents = await this.deps.database.findRecentEvents();
      const events = this.deduplicator.cluster(evaluated).map((event) => this.deduplicator.reconcile(event, existingEvents));

      for (const event of events) {
        const articleIds = event.articles.map((article) => newArticles.find((item) => item.article.url === article.url)?.id).filter((id): id is number => id !== undefined);
        await this.deps.database.upsertEvent(event, articleIds);
        if (!await this.deps.database.needsAnalysis(event.eventKey)) continue;
        try {
          const analyzed = await this.deps.analyzer.analyze(event);
          summary.eventsAnalyzed += 1;
          await this.deps.database.saveAnalysis(event.eventKey, analyzed.opportunity, analyzed.metadata);
          if (!analyzed.opportunity.relevante || analyzed.opportunity.score_radar < ATTIO.minimumScore) continue;
          summary.opportunitiesQualified += 1;
          if (this.deps.dryRun || !this.deps.attio) {
            await this.deps.database.recordSync(runId, event.eventKey, "dry-run", "success");
            continue;
          }
          const knownRecordId = await this.deps.database.getAttioRecordId(event.eventKey);
          const result = await this.deps.attio.upsert(event, analyzed.opportunity, knownRecordId);
          if (result.action === "created") summary.attioCreated += 1;
          else summary.attioUpdated += 1;
          await this.deps.database.recordSync(runId, event.eventKey, result.action, "success", result.recordId);
        } catch (error) {
          summary.errors += 1;
          const message = error instanceof Error ? error.message : String(error);
          await this.deps.database.recordSync(runId, event.eventKey, "analysis-or-sync", "failed", undefined, message);
          this.deps.logger.error(`Evento fallido: ${message}`, { eventKey: event.eventKey, error: message });
          if (error instanceof FatalAnalysisError) throw error;
        }
      }

      await this.deps.database.finishRun(runId, summary);
      return summary;
    } catch (error) {
      summary.errors += 1;
      await this.deps.database.finishRun(runId, summary, error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await this.deps.database.releaseLock();
    }
  }
}
