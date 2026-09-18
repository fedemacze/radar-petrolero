import type { Article, Opportunity } from "../src/domain/types.js";
import { sha256 } from "../src/lib/text.js";

export function article(overrides: Partial<Article> = {}): Article {
  const title = overrides.title ?? "YPF anunció una inversión para reactivar pozos en Chubut";
  const content = overrides.content ?? "La operadora confirmó obras, mantenimiento y una campaña de perforación en la Cuenca del Golfo San Jorge.";
  return {
    sourceId: "source-a",
    sourceName: "Fuente A",
    title,
    url: "https://example.com/noticia-1",
    publishedAt: new Date().toISOString(),
    content,
    retrievedAt: new Date().toISOString(),
    contentHash: sha256(`${title}\n${content}`),
    ...overrides,
  };
}

export function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    relevante: true, empresa: "YPF", empresa_prioritaria: false, provincia: "Chubut",
    cuenca: "Cuenca del Golfo San Jorge", proyecto: "Reactivación de pozos",
    servicios_vermaz: [{ servicio: "Mantenimiento de instalaciones de superficie", justificacion: "Habrá obras de superficie" }],
    tipo_senal: "Nueva inversión", score_radar: 82, prioridad: "Alta", etapa_temporal: "En desarrollo",
    horizonte: "Corto / 1–3 meses", hechos_publicados: ["YPF anunció la inversión"], inferencias_comerciales: ["Puede requerir mantenimiento"],
    resumen_evidencia: "Inversión confirmada", analisis_ia: "Oportunidad alineada", area_objetivo: "Operaciones",
    cargo_objetivo: "Gerente de Operaciones", persona_objetivo_nombre: "", motivo_contacto: "Proyecto en preparación",
    buscar_en_attio: true, linkedin_requerido: false, mensaje_comercial_sugerido: "Hola, podemos acompañar el proyecto.",
    tipo_accion: "BUSCAR_CONTACTO", accion_sugerida: "Buscar responsable de Operaciones en Attio.", confianza_ia: 88,
    ...overrides,
  };
}
