import { z } from "zod";
import type { Article, ContractFinding } from "../domain/types.js";
import { FatalAnalysisError } from "./openai.js";

const nullableDate = { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] } as const;
const nullableInteger = { anyOf: [{ type: "integer", minimum: 1, maximum: 120 }, { type: "null" }] } as const;
const findingSchema = z.object({
  relevant: z.boolean(), operator: z.string(), provider: z.string(), service: z.string(), basin: z.string(), province: z.string(), evidence: z.string(),
  reference_date: z.string().nullable(), explicit_end_date: z.string().nullable(), duration_months: z.number().int().positive().max(120).nullable(),
  option_months: z.number().int().positive().max(120).nullable(), confidence: z.number().int().min(0).max(100), confidence_basis: z.string(),
});
const schema = { type: "object", additionalProperties: false, required: Object.keys(findingSchema.shape), properties: {
  relevant: { type: "boolean" }, operator: { type: "string" }, provider: { type: "string" }, service: { type: "string" }, basin: { type: "string" }, province: { type: "string" }, evidence: { type: "string" },
  reference_date: nullableDate, explicit_end_date: nullableDate, duration_months: nullableInteger, option_months: nullableInteger,
  confidence: { type: "integer", minimum: 0, maximum: 100 }, confidence_basis: { type: "string" },
} } as const;

interface ResponsePayload { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }
function text(payload: ResponsePayload): string {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output ?? []) for (const content of item.content ?? []) if (content.text) return content.text;
  throw new Error("OpenAI no devolvió el análisis del contrato");
}

export class ContractAnalyzer {
  constructor(private readonly apiKey: string, private readonly model: string) {}
  async analyze(article: Article): Promise<ContractFinding> {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({
      model: this.model, store: false,
      instructions: `Analizá evidencia pública de contratos petroleros argentinos. relevant=true solo si el contrato corresponde a mantenimiento de instalaciones o líneas, logística/almacenes, apoyo a producción, transporte de cargas o transporte de personal. Extraé únicamente datos publicados. reference_date es la fecha documentada de inicio o adjudicación. explicit_end_date solo si la fuente publica el vencimiento. No supongas plazos dentro de esos campos. Si la prestadora no figura, provider debe quedar vacío. La confianza refleja la calidad de la evidencia, no una opinión comercial.`,
      input: `TÍTULO: ${article.title}\nFECHA: ${article.publishedAt ?? "sin fecha"}\nFUENTE: ${article.url}\nCONTENIDO: ${article.content.slice(0, 14000)}`,
      text: { format: { type: "json_schema", name: "contract_expiry", strict: true, schema } },
    }) });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 800);
      const message = `OpenAI HTTP ${response.status}: ${body}`;
      if ([401, 403].includes(response.status) || body.includes("insufficient_quota")) throw new FatalAnalysisError(message);
      throw new Error(message);
    }
    return findingSchema.parse(JSON.parse(text(await response.json() as ResponsePayload)));
  }
}
