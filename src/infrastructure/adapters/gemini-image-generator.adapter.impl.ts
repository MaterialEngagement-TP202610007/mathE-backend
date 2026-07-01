import { AIImageGeneratorAdapter } from "../../domain/adapters/ai-image-generator.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

const GEMINI_IMAGE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/images/generations";

export class GeminiImageGeneratorAdapter implements AIImageGeneratorAdapter {
  async generateImage(prompt: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(GEMINI_IMAGE_URL, {
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
          size: "1536x1024",
        }),
      });
    } catch {
      throw CustomError.serviceUnavailable("Gemini image request failed");
    }

    if (!response.ok) {
      throw CustomError.badGateway(
        `Gemini image returned status ${response.status}`,
      );
    }

    const payload = (await response.json()) as any;
    const b64: string | undefined = payload?.data?.[0]?.b64_json;

    if (!b64) throw CustomError.badGateway("Gemini image returned no data");

    return Buffer.from(b64, "base64");
  }
}
