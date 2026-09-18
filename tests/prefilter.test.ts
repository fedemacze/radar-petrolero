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
  const result = new Prefilter().evaluate(article({ content: "YPF confirmó inversión e inversion en reparación y reparacion de ductos." }));
  assert.equal(result.projectSignals.filter((signal) => signal.toLowerCase().includes("invers")).length, 1);
  assert.equal(result.serviceSignals.filter((signal) => signal.toLowerCase().includes("repar")).length, 1);
});
