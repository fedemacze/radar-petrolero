export type SourceType = "rss" | "web" | "api";
export type Priority = "critica" | "alta" | "media" | "baja";

export interface SourceDefinition {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  region: string;
  priority: Priority;
  enabled: boolean;
  articleLinkPattern?: string;
}

export interface Article {
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  content: string;
  retrievedAt: string;
  contentHash: string;
}

export interface PrefilterResult {
  accepted: boolean;
  score: number;
  priority: Priority;
  piresCompanies: string[];
  targetCompanies: string[];
  criticalSignals: string[];
  projectSignals: string[];
  serviceSignals: string[];
  earlySignals: string[];
  ageDays: number | null;
}

export interface EventCandidate {
  eventKey: string;
  primaryArticle: Article;
  articles: Article[];
  prefilter: PrefilterResult;
}

export interface ServiceFit {
  servicio: string;
  justificacion: string;
}

export interface Opportunity {
  relevante: boolean;
  empresa: string;
  empresa_prioritaria: boolean;
  provincia: string;
  cuenca: string;
  proyecto: string;
  servicios_vermaz: ServiceFit[];
  tipo_senal: string;
  score_radar: number;
  prioridad: "Crítica" | "Alta" | "Media" | "Baja" | "Muy baja";
  etapa_temporal: "Temprana" | "En desarrollo" | "Contratación" | "Adjudicada";
  horizonte: "Inmediata / 0–30 días" | "Corto / 1–3 meses" | "Medio / 3–6 meses" | "Largo / 6–12 meses" | "Futuro / +12 meses" | "Sin determinar";
  hechos_publicados: string[];
  inferencias_comerciales: string[];
  resumen_evidencia: string;
  analisis_ia: string;
  area_objetivo: string;
  cargo_objetivo: string;
  persona_objetivo_nombre: string;
  motivo_contacto: string;
  buscar_en_attio: boolean;
  linkedin_requerido: boolean;
  mensaje_comercial_sugerido: string;
  tipo_accion: "INVESTIGAR" | "BUSCAR_CONTACTO" | "SEGUIR" | "CONTACTAR";
  accion_sugerida: string;
  confianza_ia: number;
}

export interface AnalysisMetadata {
  model: string;
  promptVersion: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  rawResponseId: string | null;
}

export interface AnalyzedOpportunity {
  event: EventCandidate;
  opportunity: Opportunity;
  metadata: AnalysisMetadata;
}

export interface RunSummary {
  runId: string;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  articlesFetched: number;
  articlesNew: number;
  articlesAccepted: number;
  eventsAnalyzed: number;
  opportunitiesQualified: number;
  attioCreated: number;
  attioUpdated: number;
  errors: number;
}

export interface SourceAdapter {
  fetch(source: SourceDefinition): Promise<Article[]>;
}
