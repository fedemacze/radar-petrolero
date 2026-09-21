import assert from "node:assert/strict";
import test from "node:test";
import { enforceCommercialGate } from "../src/pipeline/commercial-gate.js";
import type { EventCandidate } from "../src/domain/types.js";
import { Prefilter } from "../src/pipeline/prefilter.js";
import { article, opportunity } from "./fixtures.js";

function event(title: string): EventCandidate {
  const primaryArticle = article({ title });
  return { eventKey: "RP-TEST", primaryArticle, articles: [primaryArticle], prefilter: new Prefilter().evaluate(primaryArticle) };
}

test("bloquea una promoción genérica aunque la IA la marque con score alto", () => {
  const result = enforceCommercialGate(event("Gobernadores participaron de Argentina Week"), opportunity({
    proyecto: "Argentina LNG",
    tipo_senal: "Interés en inversiones",
    resumen_evidencia: "Participación de gobernadores para atraer inversiones; FID prevista para 2026.",
    score_radar: 85,
  }));
  assert.equal(result.relevante, false);
  assert.equal(result.score_radar, 49);
});

test("bloquea una inferencia comercial sin hecho operativo concreto", () => {
  const result = enforceCommercialGate(event("YPF presentó su estrategia corporativa"), opportunity({
    tipo_senal: "Inversión",
    resumen_evidencia: "La empresa anunció objetivos generales de crecimiento.",
    hechos_publicados: ["YPF presentó objetivos generales de crecimiento para los próximos años."],
  }));
  assert.equal(result.relevante, false);
});

test("mantiene una licitación concreta con servicio aplicable", () => {
  const result = enforceCommercialGate(event("YPF abrió una licitación de mantenimiento"), opportunity({
    tipo_senal: "Licitación",
    resumen_evidencia: "YPF abrió una licitación para mantenimiento de instalaciones de superficie.",
  }));
  assert.equal(result.relevante, true);
  assert.equal(result.score_radar, 82);
});

test("reduce el score de un proyecto futuro sin compra iniciada", () => {
  const result = enforceCommercialGate(event("YPF confirmó una campaña de perforación futura"), opportunity({
    horizonte: "Futuro / +12 meses",
    score_radar: 85,
    hechos_publicados: ["YPF confirmó una campaña de perforación con nuevos pozos para 2028."],
  }));
  assert.equal(result.relevante, true);
  assert.equal(result.score_radar, 69);
});
