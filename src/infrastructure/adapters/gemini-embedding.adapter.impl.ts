import { EmbeddingAdapter } from "../../domain/adapters/embedding.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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
    const url = `${GEMINI_BASE}/${model}:embedContent?key=${envs.GEMINI_API_KEY}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: "SEMANTIC_SIMILARITY",
          outputDimensionality: envs.GEMINI_EMBEDDING_DIMENSIONS,
        }),
      });
    } catch {
      throw CustomError.serviceUnavailable("Gemini embedding request failed");
    }

    if (!response.ok) {
      throw CustomError.badGateway(
        `Gemini embedding returned status ${response.status}`,
      );
    }

    const payload = (await response.json()) as any;
    const values: number[] | undefined = payload?.embedding?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw CustomError.badGateway("Gemini embedding returned no vector");
    }

    return values;
  }
}
