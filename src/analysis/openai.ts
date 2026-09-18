import type { AnalysisMetadata, EventCandidate, Opportunity } from "../domain/types.js";
import { opportunityJsonSchema, opportunitySchema } from "./schema.js";
import { buildEventPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt.js";

interface OpenAIResponse {
  id?: string;
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function extractText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text;
  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) if (content.text) return content.text;
  }
  throw new Error("OpenAI no devolvió contenido de texto");
}

export class OpportunityAnalyzer {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async analyze(event: EventCandidate): Promise<{ opportunity: Opportunity; metadata: AnalysisMetadata }> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const started = Date.now();
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            instructions: SYSTEM_PROMPT,
            input: buildEventPrompt(event),
            text: { format: { type: "json_schema", name: "radar_opportunity", strict: true, schema: opportunityJsonSchema } },
            store: false,
          }),
        });
        if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${(await response.text()).slice(0, 800)}`);
        const payload = await response.json() as OpenAIResponse;
        const opportunity = opportunitySchema.parse(JSON.parse(extractText(payload)));
        return {
          opportunity,
          metadata: {
            model: this.model,
            promptVersion: PROMPT_VERSION,
            latencyMs: Date.now() - started,
            inputTokens: payload.usage?.input_tokens ?? null,
            outputTokens: payload.usage?.output_tokens ?? null,
            rawResponseId: payload.id ?? null,
          },
        };
      } catch (error) {
        lastError = error;
        if (attempt === 1) continue;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
