import { EmbeddingAdapter } from "../../domain/adapters/embedding.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";
import {
  fetchWithTimeout,
  readJson,
  upstreamStatusError,
} from "../http/fetch-with-timeout.js";
import { GEMINI_MODELS_BASE_URL } from "./gemini-response.helper.js";

const SERVICE_NAME = "Gemini embedding";

/**
 * Gemini embeddings implementation (PASO 3). Uses the REST `embedContent`
 * endpoint to turn a statement into a dense vector.
 */
export class GeminiEmbeddingAdapter implements EmbeddingAdapter {
  get modelVersion(): string {
    return `${envs.GEMINI_EMBEDDING_MODEL}@${envs.GEMINI_EMBEDDING_DIMENSIONS}`;
  }

  async embed(text: string): Promise<number[]> {
    const model = envs.GEMINI_EMBEDDING_MODEL;
    const url = `${GEMINI_MODELS_BASE_URL}/${model}:embedContent`;

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": envs.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType: "SEMANTIC_SIMILARITY",
        outputDimensionality: envs.GEMINI_EMBEDDING_DIMENSIONS,
      }),
      timeoutMs: envs.GEMINI_EMBEDDING_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });

    if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

    const payload = await readJson<any>(response, SERVICE_NAME);
    const values: number[] | undefined = payload?.embedding?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw CustomError.badGateway("Gemini embedding returned no vector");
    }

    return values;
  }
}
