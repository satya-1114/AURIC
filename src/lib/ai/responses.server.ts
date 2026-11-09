import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, type ModelMessage } from "ai";
import type { extractionSchema } from "../photo-reading";

export async function createResponsesCall(
  request: Request,
  config: { apiKey: string; model: string },
  messages: ModelMessage[],
  instructions?: string,
  schema?: typeof extractionSchema,
) {
  const provider = createGoogleGenerativeAI({
    apiKey: config.apiKey,
  });

  const result = await generateText({
    model: provider(config.model),
    ...(instructions ? { system: instructions } : {}),
    messages,
    maxRetries: 0,
    abortSignal: request.signal,
    ...(schema ? { output: Output.object({ schema }) } : {}),
  });

  return { result };
}
