import { PREFILTER } from "../config/radar.js";
import type { Article, PrefilterResult, Priority } from "../domain/types.js";
import { normalizeText, uniqueNormalized } from "../lib/text.js";

function matches(text: string, values: readonly string[]): string[] {
  return uniqueNormalized(values.filter((value) => text.includes(normalizeText(value))));
}

function ageDays(publishedAt: string | null, now: Date): number | null {
  if (!publishedAt) return null;
  const time = Date.parse(publishedAt);
  if (Number.isNaN(time)) return null;
  return (now.getTime() - time) / 86_400_000;
}

function priorityFor(score: number): Priority {
  if (score >= 80) return "critica";
  if (score >= 60) return "alta";
  if (score >= 40) return "media";
  return "baja";
}

const ACTIONABLE_PROCUREMENT_SIGNALS = [
  "licitacion", "adjudicacion", "concurso de precios", "compulsa", "rfp", "rfq",
  "convocatoria a proveedores", "busqueda de proveedores", "pliego de bases", "apertura de ofertas",
] as const;

const GENERAL_BUDGET_SIGNALS = [
  "presupuesto nacional", "presupuesto 2027", "partida presupuestaria", "partidas presupuestarias",
  "asignacion presupuestaria", "asignaciones presupuestarias", "credito presupuestario",
] as const;

export class Prefilter {
  evaluate(article: Article, now = new Date()): PrefilterResult {
    const text = normalizeText(`${article.title} ${article.content}`);
    const age = ageDays(article.publishedAt, now);
    const piresCompanies = matches(text, PREFILTER.piresCompanies);
    const targetCompanies = matches(text, PREFILTER.targetCompanies);
    const criticalSignals = matches(text, PREFILTER.criticalSignals);
    const projectSignals = matches(text, PREFILTER.projectSignals);
    const serviceSignals = matches(text, PREFILTER.serviceSignals);
    const earlySignals = matches(text, PREFILTER.earlySignals);
    const displacementSignals = matches(text, PREFILTER.displacementSignals);
    const exclusionSignals = matches(text, PREFILTER.exclusionSignals);
    const noise = matches(text, PREFILTER.noise);
    const generalBudget = matches(text, GENERAL_BUDGET_SIGNALS).length > 0;
    const actionableProcurement = matches(text, ACTIONABLE_PROCUREMENT_SIGNALS).length > 0;

    let score = 0;
    if (piresCompanies.length) score += 35;
    if (targetCompanies.length) score += 20;
    if (criticalSignals.length) score += 30;
    if (projectSignals.length) score += 20;
    if (serviceSignals.length) score += 20;
    if (earlySignals.length) score += 25;
    if (displacementSignals.length) score += 35;
    if (age !== null && age <= 3) score += 10;
    else if (age !== null && age <= 7) score += 7;
    else if (age !== null && age <= 14) score += 4;
    if (noise.length) score -= 25;
    if (exclusionSignals.length) score -= 45;
    score = Math.max(0, Math.min(100, score));

    const hasCompany = piresCompanies.length > 0 || targetCompanies.length > 0;
    const procurement = criticalSignals.length > 0 && serviceSignals.length > 0;
    const concreteProject = projectSignals.length > 0 && serviceSignals.length > 0;
    const earlyConcreteProject = earlySignals.length > 0 && projectSignals.length > 0 && serviceSignals.length > 0;
    const supplierDisplacement = hasCompany && displacementSignals.length > 0;
    const qualityRule = hasCompany && (procurement || concreteProject || earlyConcreteProject || supplierDisplacement);
    const budgetWithoutProcurement = generalBudget && !actionableProcurement;
    const hardExcluded = (exclusionSignals.length > 0 && !procurement && !supplierDisplacement) || budgetWithoutProcurement;
    const validAge = age === null || (age <= PREFILTER.maxAgeDays && age >= -2);

    return {
      accepted: validAge && qualityRule && !hardExcluded && score >= PREFILTER.minimumScore,
      score,
      priority: priorityFor(score),
      piresCompanies,
      targetCompanies,
      criticalSignals,
      projectSignals,
      serviceSignals,
      earlySignals,
      displacementSignals,
      exclusionSignals,
      ageDays: age === null ? null : Math.round(age * 10) / 10,
    };
  }
}
