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
