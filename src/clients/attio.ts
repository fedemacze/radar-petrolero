import { ATTIO } from "../config/radar.js";
import type { EventCandidate, Opportunity } from "../domain/types.js";

interface AttioRecord { id?: { record_id?: string } }
interface AttioListResponse { data?: AttioRecord[] }

export interface AttioConfig {
  apiKey: string;
  object: string;
  stageAttributeId: string;
  detectedStageId: string;
}

function signalType(value: string): string | undefined {
  const t = value.toLocaleLowerCase("es-AR");
  if (t.includes("licit")) return "Licitación";
  if (t.includes("adjudic")) return "Adjudicación";
  if (t.includes("vencimiento")) return "Vencimiento de contrato";
  if (t.includes("contratista")) return "Cambio de contratista";
  if (t.includes("invers")) return "Nueva inversión";
  if (t.includes("prórroga") || t.includes("extension") || t.includes("extensión")) return "Extensión de concesión";
  if (t.includes("conces")) return "Nueva concesión";
  if (t.includes("campaña")) return "Nueva campaña";
  if (t.includes("reactiv") && t.includes("pozo")) return "Reactivación de pozos";
  if (t.includes("incremento") && t.includes("produ")) return "Incremento de producción";
  if (t.includes("workover") || t.includes("intervenc")) return "Workover / intervención";
  if (t.includes("planta") || t.includes("batería")) return "Nueva planta / batería";
  if (t.includes("mantenimiento") && t.includes("instal")) return "Mantenimiento de instalaciones";
  if (t.includes("ducto")) return "Recambio de ductos";
  if (t.includes("rotura") || t.includes("fuga")) return "Rotura / fuga";
  if (t.includes("ambiental")) return "Permiso ambiental";
  if (t.includes("aprob")) return "Proyecto aprobado";
  return undefined;
}

function horizon(value: Opportunity["horizonte"]): string {
  const values: Record<Opportunity["horizonte"], string> = {
    "Inmediata / 0–30 días": "0–30 días · Corto",
    "Corto / 1–3 meses": "1–3 meses · Medio",
    "Medio / 3–6 meses": "3–6 meses · Largo",
    "Largo / 6–12 meses": "6–12 meses · Futuro",
    "Futuro / +12 meses": "+12 meses · Sin determinar",
    "Sin determinar": "+12 meses · Sin determinar",
  };
  return values[value];
}

export function buildAttioValues(event: EventCandidate, opportunity: Opportunity, config: Pick<AttioConfig, "stageAttributeId" | "detectedStageId">): Record<string, unknown> {
  const values: Record<string, unknown> = {
    name: `Radar - ${opportunity.empresa || opportunity.tipo_senal || "Oportunidad"} - ${opportunity.provincia || "N/A"}`,
    [config.stageAttributeId]: config.detectedStageId,
    id_radar: event.eventKey,
    fecha_detectada: new Date().toISOString().slice(0, 10),
    ultima_actualizacion_radar: new Date().toISOString().slice(0, 10),
    score_del_radar: opportunity.score_radar,
    prioridad: opportunity.score_radar >= 90 ? "🔥 Crítica" : opportunity.score_radar >= 75 ? "🟢 Alta" : opportunity.score_radar >= 50 ? "🟠 Media" : "🟡 Baja",
    etapa_temporal: opportunity.etapa_temporal,
    horizonte: horizon(opportunity.horizonte),
    fuente_medio: [...new Set(event.articles.map((article) => article.sourceName))].join(" · "),
    url_original: event.primaryArticle.url,
    resumen_evidencia: `${opportunity.resumen_evidencia}\n\nFuentes:\n${event.articles.map((article) => `- ${article.sourceName}: ${article.url}`).join("\n")}`,
    analisis_ia: opportunity.analisis_ia,
    accion_sugerida: opportunity.accion_sugerida,
    confianza_ia: opportunity.confianza_ia,
  };
  if (opportunity.provincia) values.provincia = opportunity.provincia;
  if (opportunity.cuenca) values.cuenca = opportunity.cuenca.replace(/^Cuenca (del )?/i, "");
  if (opportunity.proyecto) values.yacimiento_proyecto = opportunity.proyecto;
  const type = signalType(opportunity.tipo_senal);
  if (type) values.tipo_de_senal = type;
  const services = opportunity.servicios_vermaz.map((fit) => ATTIO.serviceOptions[fit.servicio.toLocaleLowerCase("es-AR")]).filter(Boolean);
  if (services.length) values.servicio_vermaz = [...new Set(services)];
  return values;
}

export class AttioClient {
  constructor(private readonly config: AttioConfig) {}

  private async request(path: string, init: RequestInit = {}, retries = 3): Promise<any> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(`https://api.attio.com${path}`, {
          ...init,
          headers: { authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json", ...(init.headers ?? {}) },
        });
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          continue;
        }
        if (!response.ok) throw new Error(`Attio HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
        return await response.json();
      } catch (error) { lastError = error; }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async validateAttributes(): Promise<void> {
    const payload = await this.request(`/v2/objects/${this.config.object}/attributes`);
    const slugs = new Set<string>((payload.data ?? []).map((item: any) => item.api_slug).filter(Boolean));
    const required = ["name", "id_radar", "score_del_radar", "prioridad", "fecha_detectada", "ultima_actualizacion_radar"];
    const missing = required.filter((slug) => !slugs.has(slug));
    if (missing.length) throw new Error(`Faltan atributos requeridos en Attio: ${missing.join(", ")}`);
  }

  async findByRadarId(eventKey: string): Promise<string | null> {
    const payload = await this.request(`/v2/objects/${this.config.object}/records/query`, {
      method: "POST",
      body: JSON.stringify({ filter: { id_radar: { value: { $eq: eventKey } } }, limit: 1 }),
    }) as AttioListResponse;
    return payload.data?.[0]?.id?.record_id ?? null;
  }

  async upsert(event: EventCandidate, opportunity: Opportunity, knownRecordId?: string | null): Promise<{ action: "created" | "updated"; recordId: string }> {
    const values = buildAttioValues(event, opportunity, this.config);
    const recordId = knownRecordId || await this.findByRadarId(event.eventKey);
    if (recordId) {
      const payload = await this.request(`/v2/objects/${this.config.object}/records/${recordId}`, { method: "PATCH", body: JSON.stringify({ data: { values } }) });
      return { action: "updated", recordId: payload.data?.id?.record_id ?? recordId };
    }
    const payload = await this.request(`/v2/objects/${this.config.object}/records`, { method: "POST", body: JSON.stringify({ data: { values } }) });
    const createdId = payload.data?.id?.record_id;
    if (!createdId) throw new Error("Attio creó el registro sin devolver record_id");
    return { action: "created", recordId: createdId };
  }
}
