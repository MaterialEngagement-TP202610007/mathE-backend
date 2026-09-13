import { AIImageGeneratorAdapter } from "../../domain/adapters/ai-image-generator.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";
import {
  fetchWithTimeout,
  readJson,
  upstreamStatusError,
} from "../http/fetch-with-timeout.js";

const GEMINI_IMAGE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/images/generations";

const SERVICE_NAME = "Gemini image";

export class GeminiImageGeneratorAdapter implements AIImageGeneratorAdapter {
  async generateImage(prompt: string): Promise<Buffer> {
    // OpenAI-compatible endpoint: authenticates with a Bearer API key.
    const response = await fetchWithTimeout(GEMINI_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${envs.GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: envs.GEMINI_IMAGE_MODEL,
        prompt,
        response_format: "b64_json",
        n: 1,
        size: "1792x1024",
      }),
      timeoutMs: envs.GEMINI_IMAGE_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });

    if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

    const payload = await readJson<any>(response, SERVICE_NAME);
    const b64: string | undefined = payload?.data?.[0]?.b64_json;

    if (!b64) throw CustomError.badGateway("Gemini image returned no data");

    return Buffer.from(b64, "base64");
  }
}
