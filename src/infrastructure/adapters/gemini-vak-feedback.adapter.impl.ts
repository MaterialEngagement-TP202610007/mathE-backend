import { VakFeedbackAdapter } from "../../domain/adapters/vak-feedback.adapter.js";
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

const SERVICE_NAME = "Gemini feedback";

export class GeminiVakFeedbackAdapterImpl implements VakFeedbackAdapter {
  async generateFeedback(
    predominantStyle: string,
    visualProbability: number,
    auditoryProbability: number,
    kinestheticProbability: number,
  ): Promise<string> {
    const prompt = this.buildPrompt(
      predominantStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
    );

    const url = `${GEMINI_MODELS_BASE_URL}/${envs.GEMINI_CHAT_MODEL}:generateContent`;

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": envs.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      timeoutMs: envs.GEMINI_FEEDBACK_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });

    if (!response.ok) throw upstreamStatusError(response, SERVICE_NAME);

    const payload = await readJson(response, SERVICE_NAME);
    const text = extractCandidateText(payload);

    if (!text) throw CustomError.badGateway("Gemini feedback returned no content");

    return text.trim();
  }

  private buildPrompt(
    predominantStyle: string,
    visualProbability: number,
    auditoryProbability: number,
    kinestheticProbability: number,
  ): string {
    const styleES: Record<string, string> = {
      Visual: "Visual",
      Auditory: "Auditivo",
      Kinesthetic: "Kinestésico",
    };

    const styleLabel = styleES[predominantStyle] ?? predominantStyle;
    // Probabilities are already on a 0-100 scale (Lambda and simple_score).
    const vPct = Math.round(visualProbability);
    const aPct = Math.round(auditoryProbability);
    const kPct = Math.round(kinestheticProbability);

    return `Eres un experto en estilos de aprendizaje VAK especializado en educación básica (primaria y secundaria) en Perú.
Escribe una retroalimentación personalizada en español castellano peruano para un estudiante cuyos resultados son:
- Estilo predominante: ${styleLabel}
- Probabilidad Visual: ${vPct}%
- Probabilidad Auditiva: ${aPct}%
- Probabilidad Kinestésica: ${kPct}%

La retroalimentación debe:
- Estar dirigida directamente al estudiante usando "tú"
- Tener entre 3 y 5 oraciones
- Explicar qué significa su estilo predominante de manera sencilla
- Dar 2 consejos prácticos y concretos para estudiar mejor
- Usar lenguaje cercano, motivador y simple, apropiado para un alumno de colegio peruano
- No mencionar los porcentajes ni números
- No usar palabras técnicas de psicología

Responde únicamente con el texto de la retroalimentación, sin títulos ni formato adicional.`;
  }
}
