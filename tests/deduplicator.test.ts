import assert from "node:assert/strict";
import test from "node:test";
import { Deduplicator } from "../src/pipeline/deduplicator.js";
import { Prefilter } from "../src/pipeline/prefilter.js";
import { article } from "./fixtures.js";

const prefilter = new Prefilter();

test("agrupa dos publicaciones del mismo evento", () => {
  const first = article();
  const second = article({ sourceId: "source-b", sourceName: "Fuente B", url: "https://example.org/ypf-inversion", title: "YPF invertirá para reactivar pozos y obras en Chubut" });
  const events = new Deduplicator().cluster([
    { article: first, prefilter: prefilter.evaluate(first) },
    { article: second, prefilter: prefilter.evaluate(second) },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.articles.length, 2);
});

test("mantiene separados eventos distintos de la misma empresa", () => {
  const first = article();
  const second = article({ url: "https://example.org/ypf-licitacion", title: "YPF licita transporte de personal en Neuquén", content: "La compañía abrió una licitación para contratar combis en Vaca Muerta." });
  const events = new Deduplicator().cluster([
    { article: first, prefilter: prefilter.evaluate(first) },
    { article: second, prefilter: prefilter.evaluate(second) },
  ]);
  assert.equal(events.length, 2);
});

test("produce una identidad determinística", () => {
  const item = article();
  const evaluated = { article: item, prefilter: prefilter.evaluate(item) };
  const first = new Deduplicator().cluster([evaluated])[0]?.eventKey;
  const second = new Deduplicator().cluster([evaluated])[0]?.eventKey;
  assert.equal(first, second);
});

test("reutiliza la identidad de un evento persistido similar", () => {
  const current = article({ title: "YPF invertirá para reactivar pozos y obras en Chubut" });
  const filter = prefilter.evaluate(current);
  const fresh = new Deduplicator().cluster([{ article: current, prefilter: filter }])[0]!;
  const reconciled = new Deduplicator().reconcile(fresh, [{ eventKey: "RP-EXISTENTE", title: "YPF anunció una inversión para reactivar pozos en Chubut", prefilter: filter }]);
  assert.equal(reconciled.eventKey, "RP-EXISTENTE");
});
