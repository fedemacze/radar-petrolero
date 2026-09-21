import assert from "node:assert/strict";
import test from "node:test";
import { Prefilter } from "../src/pipeline/prefilter.js";
import { article } from "./fixtures.js";

test("acepta una señal comercial de una operadora objetivo", () => {
  const result = new Prefilter().evaluate(article());
  assert.equal(result.accepted, true);
  assert.ok(result.score >= 60);
  assert.deepEqual(result.targetCompanies, ["ypf"]);
});

test("descarta una mención empresarial sin señal comercial", () => {
  const result = new Prefilter().evaluate(article({ title: "YPF participó de un evento deportivo", content: "La empresa acompañó un festival de fútbol." }));
  assert.equal(result.accepted, false);
});

test("descarta artículos fuera de la ventana temporal", () => {
  const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
  assert.equal(new Prefilter().evaluate(article({ publishedAt: old })).accepted, false);
});

test("no duplica señales equivalentes con y sin tilde", () => {
  const result = new Prefilter().evaluate(article({ content: "YPF confirmó inversión confirmada e inversion confirmada para reparación de ductos y reparacion de ductos." }));
  assert.equal(result.projectSignals.filter((signal) => signal.toLowerCase().includes("invers")).length, 1);
  assert.equal(result.serviceSignals.filter((signal) => signal.toLowerCase().includes("repar")).length, 1);
});

test("descarta promoción genérica de inversiones aunque mencione a YPF y un proyecto", () => {
  const result = new Prefilter().evaluate(article({
    title: "Gobernadores participaron de Argentina Week para atraer inversiones",
    content: "Se presentó la inversión de YPF, Eni y XRG en Argentina LNG, con FID prevista para 2026 y desarrollo de infraestructura.",
  }));
  assert.equal(result.accepted, false);
});

test("descarta regulación, litigios ambientales y conflictos laborales genéricos", () => {
  const filter = new Prefilter();
  assert.equal(filter.evaluate(article({ title: "YPF analiza una reforma legal", content: "La reforma legal busca atraer inversiones y mejorar la producción." })).accepted, false);
  assert.equal(filter.evaluate(article({ title: "Amparo ambiental contra YPF", content: "Reclaman reparación ambiental por daños petroleros." })).accepted, false);
  assert.equal(filter.evaluate(article({ title: "Conflicto laboral en Vientos del Sur", content: "El sindicato inició un reclamo salarial." })).accepted, false);
});

test("acepta una señal concreta de sustitución de prestadora", () => {
  const result = new Prefilter().evaluate(article({
    title: "YPF rescindió el contrato de una prestadora por incumplimientos",
    content: "La operadora evalúa el cambio de contratista para restablecer el mantenimiento de instalaciones.",
  }));
  assert.equal(result.accepted, true);
  assert.ok(result.displacementSignals.length > 0);
});

test("acepta un proyecto futuro solo si tiene alcance operativo concreto", () => {
  const result = new Prefilter().evaluate(article({
    title: "YPF confirmó una campaña de perforación para 2027",
    content: "La campaña contempla nuevos pozos y mantenimiento de instalaciones de superficie en Chubut.",
  }));
  assert.equal(result.accepted, true);
});
