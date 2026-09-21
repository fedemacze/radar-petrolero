import type { EventCandidate, Opportunity } from "../domain/types.js";
import { normalizeText } from "../lib/text.js";

const EXCLUDED_CONTEXTS = [
  "argentina week", "atraer inversiones", "participacion de gobernadores", "evento tecnico", "evento empresarial",
  "conferencia", "cumbre energetica", "reforma legal", "reforma normativa", "proyecto de ley",
  "mercado de carbono", "bonos de carbono", "amparo ambiental", "demanda ambiental", "reparacion ambiental",
  "peajes free flow", "sistema de peajes", "conflicto laboral", "reclamo salarial", "conciliacion obligatoria",
];

const REPLACEMENT_SIGNALS = [
  "incumplimiento del contratista", "incumplimiento del proveedor", "rescindio el contrato", "rescision del contrato",
  "fallas del contratista", "fallas del proveedor", "reemplazo del contratista", "cambio de contratista",
  "cambio de proveedor", "paro de la contratista", "abandono del servicio",
];

const CONCRETE_SIGNALS = [
  "licitacion", "adjudicacion", "concurso de precios", "compulsa", "rfp", "rfq", "busqueda de proveedores",
  "convocatoria a proveedores", "obra adjudicada", "inicio de obra", "campana de perforacion", "nuevos pozos",
  "workover", "pulling", "mantenimiento", "reparacion de ductos", "reemplazo de ductos", "puesta en marcha de planta",
  "ampliacion de planta", "construccion de ducto", "construccion de planta", "logistica petrolera",
  "transporte de cargas", "transporte de crudo", "transporte de personal",
];

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function factualText(event: EventCandidate, opportunity: Opportunity): string {
  return normalizeText([
    event.primaryArticle.title,
    opportunity.tipo_senal,
    opportunity.proyecto,
    opportunity.resumen_evidencia,
    ...opportunity.hechos_publicados,
  ].join(" "));
}

/** Applies a deterministic safety check after AI. AI cannot waive this gate. */
export function enforceCommercialGate(event: EventCandidate, opportunity: Opportunity): Opportunity {
  // Only published facts count here. AI analysis and suggested service fits are
  // intentionally excluded because they are inferences, not evidence.
  const text = factualText(event, opportunity);
  const replacement = includesAny(text, REPLACEMENT_SIGNALS);
  const excluded = includesAny(text, EXCLUDED_CONTEXTS) && !replacement;
  const hasConcreteFact = includesAny(text, CONCRETE_SIGNALS) || replacement;
  const hasServiceFit = opportunity.servicios_vermaz.some((item) => item.servicio.trim() && item.justificacion.trim());
  const hasEvidence = opportunity.hechos_publicados.some((fact) => fact.trim().length >= 15);

  if (excluded || !hasConcreteFact || !hasServiceFit || !hasEvidence) {
    return {
      ...opportunity,
      relevante: false,
      score_radar: Math.min(opportunity.score_radar, 49),
      prioridad: "Muy baja",
      buscar_en_attio: false,
    };
  }

  const futureWithoutPurchase = opportunity.horizonte === "Futuro / +12 meses"
    && !includesAny(text, ["licitacion", "adjudicacion", "concurso de precios", "compulsa", "rfp", "rfq", "busqueda de proveedores"])
    && !replacement;
  if (futureWithoutPurchase) {
    return {
      ...opportunity,
      score_radar: Math.min(opportunity.score_radar, 69),
      prioridad: opportunity.score_radar >= 50 ? "Media" : opportunity.prioridad,
      buscar_en_attio: false,
    };
  }

  return opportunity;
}
