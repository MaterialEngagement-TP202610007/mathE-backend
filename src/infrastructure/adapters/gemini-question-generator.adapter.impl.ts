import { AIQuestionGeneratorAdapter } from "../../domain/adapters/ai-question-generator.adapter.js";
import { GeneratedQuestion } from "../../domain/interfaces/question/index.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";
import {
  fetchWithTimeout,
  readJson,
  upstreamStatusError,
} from "../http/fetch-with-timeout.js";
import {
  GEMINI_MODELS_BASE_URL,
  extractCandidateText,
} from "./gemini-response.helper.js";

const SERVICE_NAME = "Gemini chat";

export class GeminiQuestionGeneratorAdapter implements AIQuestionGeneratorAdapter {
  async generateQuestion(prompt: string): Promise<GeneratedQuestion> {
    const url = `${GEMINI_MODELS_BASE_URL}/${envs.GEMINI_CHAT_MODEL}:generateContent`;

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": envs.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      timeoutMs: envs.GEMINI_CHAT_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });

    if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

    const payload = await readJson(response, SERVICE_NAME);
    const text = extractCandidateText(payload);

    if (!text) throw CustomError.badGateway("Gemini chat returned no content");

    return this.parse(text);
  }

  private parse(raw: string): GeneratedQuestion {
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      throw CustomError.badGateway("Gemini chat returned invalid JSON");
    }

    const options = Array.isArray(json?.options)
      ? json.options.map((o: any) => ({
          text: o?.text,
          vakValue: o?.vak_value ?? o?.vakValue,
        }))
      : [];

    return { statement: json?.statement, options };
  }
}
