import { AIQuestionGeneratorAdapter } from "../../domain/adapters/ai-question-generator.adapter.js";
import { GeneratedQuestion } from "../../domain/interfaces/question/index.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Gemini chat implementation of the question generator (PASO 1).
 * Uses the REST `generateContent` endpoint with JSON response mode so the
 * model returns parseable structured output.
 */
export class GeminiQuestionGeneratorAdapter implements AIQuestionGeneratorAdapter {
  async generateQuestion(vakStyle: string): Promise<GeneratedQuestion> {
    const prompt = this.buildPrompt(vakStyle);

    console.log("prompt", prompt);

    const url = `${GEMINI_BASE}/${envs.GEMINI_CHAT_MODEL}:generateContent?key=${envs.GEMINI_API_KEY}`;

    console.log("url", url);

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

    console.log("response", response);

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

  private buildPrompt(vakStyle: string): string {
      return `Eres un experto en estilos de aprendizaje VAK.
    Genera UNA pregunta para identificar el estilo de aprendizaje de un estudiante.
    El estilo predominante de esta pregunta es: ${vakStyle}.
    
    Reglas:
    - El enunciado debe ser una situación cotidiana escolar.
    - Genera exactamente 4 opciones de respuesta.
    - Cada opción debe representar un estilo: incluye al menos una Visual (V), una Auditiva (A) y una Kinestésica (K).
    - No repitas el mismo estilo más de dos veces.
    
    Responde ÚNICAMENTE con este JSON, sin texto adicional:
    {
      "statement": "¿Cómo prefieres aprender un tema nuevo?",
      "options": [
        { "text": "Viendo un video explicativo", "vak_value": "V" },
        { "text": "Escuchando al profesor", "vak_value": "A" },
        { "text": "Practicando con ejercicios", "vak_value": "K" },
        { "text": "Leyendo el libro en voz alta", "vak_value": "A" }
      ]
    }`;
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
