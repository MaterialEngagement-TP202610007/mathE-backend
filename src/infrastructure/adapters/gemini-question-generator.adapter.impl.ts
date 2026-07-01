import { AIQuestionGeneratorAdapter } from "../../domain/adapters/ai-question-generator.adapter.js";
import { GeneratedQuestion } from "../../domain/interfaces/question/index.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiQuestionGeneratorAdapter implements AIQuestionGeneratorAdapter {
  async generateQuestion(prompt: string): Promise<GeneratedQuestion> {
    const url = `${GEMINI_BASE}/${envs.GEMINI_CHAT_MODEL}:generateContent?key=${envs.GEMINI_API_KEY}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
    } catch {
      throw CustomError.serviceUnavailable("Gemini chat request failed");
    }

    if (!response.ok) {
      throw CustomError.badGateway(
        `Gemini chat returned status ${response.status}`,
      );
    }

    const payload = (await response.json()) as any;
    const text: string | undefined =
      payload?.candidates?.[0]?.content?.parts?.[0]?.text;

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
