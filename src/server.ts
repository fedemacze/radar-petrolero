import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { OpportunityAnalyzer } from "./analysis/openai.js";
import { ContractAnalyzer } from "./analysis/contract-analyzer.js";
import { AttioClient } from "./clients/attio.js";
import { loadEnv } from "./config/env.js";
import { Database } from "./db/database.js";
import { Logger } from "./lib/logger.js";
import { RadarRunner } from "./pipeline/runner.js";
import { HttpClient, SourceRouter } from "./sources/http.js";
import { RssAdapter } from "./sources/rss.js";
import { UnsupportedApiAdapter, WebAdapter } from "./sources/web.js";

const env = loadEnv();
const effectiveDryRun = env.DRY_RUN || !env.ATTIO_PUBLICATION_ENABLED;
if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY es obligatoria");
if (!env.DASHBOARD_PASSWORD) throw new Error("DASHBOARD_PASSWORD es obligatoria para publicar el panel");
if (!effectiveDryRun && !env.ATTIO_API_KEY) throw new Error("ATTIO_API_KEY es obligatoria cuando la publicación está habilitada");

const logger = new Logger(env.LOG_LEVEL);
const database = new Database(env.DATABASE_URL);
const http = new HttpClient(env.SOURCE_TIMEOUT_MS);
const sourceAdapter = new SourceRouter({
  rss: new RssAdapter(http, env.MAX_ARTICLES_PER_SOURCE),
  web: new WebAdapter(http, env.MAX_ARTICLES_PER_SOURCE),
  api: new UnsupportedApiAdapter(),
});
const analyzer = new OpportunityAnalyzer(env.OPENAI_API_KEY, env.OPENAI_MODEL);
const contractAnalyzer = new ContractAnalyzer(env.OPENAI_API_KEY, env.OPENAI_MODEL);
const attio = env.ATTIO_API_KEY ? new AttioClient({ apiKey: env.ATTIO_API_KEY, object: env.ATTIO_OBJECT, stageAttributeId: env.ATTIO_STAGE_ATTRIBUTE_ID, detectedStageId: env.ATTIO_DETECTED_STAGE_ID }) : null;
const runner = new RadarRunner({ database, sourceAdapter, analyzer, contractAnalyzer, attio, logger, dryRun: effectiveDryRun, attioSyncLimit: env.ATTIO_SYNC_LIMIT });
const indexHtml = await readFile(resolve("dashboard/dist/index.html"));
const appJs = await readFile(resolve("dashboard/dist/app.js"));
let running = false;
let attioStatus: { configured: boolean; valid: boolean; error: string | null } = { configured: Boolean(attio), valid: false, error: null };

function authorized(request: IncomingMessage): boolean {
  const value = request.headers.authorization;
  if (!value?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
  const expected = `${env.DASHBOARD_USER}:${env.DASHBOARD_PASSWORD}`;
  const a = Buffer.from(decoded); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maxBytes = 5_000_000): Promise<Buffer> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { const part = Buffer.from(chunk); size += part.length; if (size > maxBytes) throw new Error("El archivo supera el límite de 5 MB"); chunks.push(part); }
  return Buffer.concat(chunks);
}

function parseCsv(input: string): Array<Record<string, string>> {
  const lines: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < input.length; index += 1) { const char = input[index]!; const next = input[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if ((char === ',' || char === ';') && !quoted) { row.push(field); field = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(field); if (row.some((value) => value.trim())) lines.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field); if (row.some((value) => value.trim())) lines.push(row);
  const headers = (lines.shift() ?? []).map((value) => value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_"));
  return lines.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

async function execute(reason: "manual" | "scheduled" | "catch-up"): Promise<void> {
  if (running) return;
  running = true;
  logger.info("Ejecución iniciada", { reason });
  try {
    const summary = await runner.run();
    logger.info("Ejecución finalizada", summary as unknown as Record<string, unknown>);
  } catch (error) {
    logger.error(`Ejecución abortada: ${error instanceof Error ? error.message : String(error)}`);
  } finally { running = false; }
}

function scheduleNext(): void {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(11, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  setTimeout(async () => { await execute("scheduled"); scheduleNext(); }, next.getTime() - now.getTime());
  logger.info("Próxima ejecución programada", { at: next.toISOString() });
}

await database.migrate();
if (attio) {
  try {
    await attio.validateAttributes();
    attioStatus = { configured: true, valid: true, error: null };
    logger.info("Attio validado correctamente");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    attioStatus = { configured: true, valid: false, error: message };
    logger.error(`Validación de Attio fallida: ${message}`);
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/health") return json(response, 200, { ok: true, running });
    if (!authorized(request)) {
      response.writeHead(401, { "www-authenticate": 'Basic realm="Radar Petrolero"' });
      return response.end("Acceso protegido");
    }
    if (request.url === "/api/dashboard" && request.method === "GET") return json(response, 200, { ...(await database.getDashboardSnapshot()), running, dryRun: effectiveDryRun, attioStatus });
    if (request.url === "/api/contacts/import" && request.method === "POST") {
      const content = (await readBody(request)).toString("utf8").replace(/^\uFEFF/, "");
      if (content.includes("PK\u0003\u0004")) return json(response, 415, { error: "Ese archivo es Excel (.xlsx). Abrilo y elegí Guardar como → CSV UTF-8" });
      const rows = parseCsv(content);
      if (!rows.length) return json(response, 400, { error: "El archivo está vacío o no tiene filas de contactos" });
      const columns = Object.keys(rows[0] ?? {});
      if (!columns.some((column) => ["nombre", "name"].includes(column))) return json(response, 400, { error: "No encuentro la columna 'nombre' en la primera fila" });
      const result = await database.importContacts(rows);
      return json(response, 200, result);
    }
    if (request.url === "/api/followup" && request.method === "POST") {
      const payload = JSON.parse((await readBody(request, 50_000)).toString("utf8")) as { eventKey?: string; status?: string; contactId?: number | null; notes?: string };
      if (!payload.eventKey || !payload.status) return json(response, 400, { error: "Faltan datos del seguimiento" });
      await database.saveFollowup(payload.eventKey, payload.status, payload.contactId ?? null, payload.notes ?? "");
      return json(response, 200, { ok: true });
    }
    if (request.url === "/api/run" && request.method === "POST") {
      if (running) return json(response, 409, { ok: false, message: "Ya hay una ejecución en curso" });
      void execute("manual");
      return json(response, 202, { ok: true, message: "Ejecución iniciada" });
    }
    if (request.url === "/" || request.url === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" });
      return response.end(indexHtml);
    }
    if (request.url?.startsWith("/app.js")) {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      return response.end(appJs);
    }
    response.writeHead(404); response.end("No encontrado");
  } catch (error) {
    logger.error(`Solicitud fallida: ${error instanceof Error ? error.message : String(error)}`);
    json(response, 500, { error: "No se pudo completar la solicitud" });
  }
});

server.listen(env.PORT, "0.0.0.0", async () => {
  logger.info("Dashboard disponible", { port: env.PORT, dryRun: effectiveDryRun, attioPublicationEnabled: env.ATTIO_PUBLICATION_ENABLED });
  scheduleNext();
  if (!await database.hasCompletedRunToday()) void execute("catch-up");
});

async function shutdown(): Promise<void> { server.close(); await database.close(); }
process.on("SIGTERM", () => { void shutdown(); });
process.on("SIGINT", () => { void shutdown(); });
