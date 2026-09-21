import assert from "node:assert/strict";
import test from "node:test";
import { buildAttioValues } from "../src/clients/attio.js";
import { Prefilter } from "../src/pipeline/prefilter.js";
import { article, opportunity } from "./fixtures.js";

test("mapea una oportunidad al esquema existente de Attio", () => {
  const primary = article();
  const values = buildAttioValues({ eventKey: "RP-ABC", primaryArticle: primary, articles: [primary], prefilter: new Prefilter().evaluate(primary) }, opportunity(), { stageAttributeId: "stage-id", detectedStageId: "detected-id" });
  assert.equal(values.id_radar, "RP-ABC");
  assert.equal(values["stage-id"], "detected-id");
  assert.equal(values.prioridad, "🟢 Alta");
  assert.deepEqual(values.servicio_vermaz, ["Mantenimiento instalaciones de superficie"]);
});

test("normaliza Vaca Muerta a la opción de cuenca configurada en Attio", () => {
  const primary = article();
  const values = buildAttioValues(
    { eventKey: "RP-VM", primaryArticle: primary, articles: [primary], prefilter: new Prefilter().evaluate(primary) },
    opportunity({ provincia: "Neuquén", cuenca: "Vaca Muerta", horizonte: "Inmediata / 0–30 días" }),
    { stageAttributeId: "stage-id", detectedStageId: "detected-id" },
  );
  assert.equal(values.provincia, "Neuquén");
  assert.equal(values.cuenca, "Neuquina");
  assert.equal(values.horizonte, "Inmediata");
});
