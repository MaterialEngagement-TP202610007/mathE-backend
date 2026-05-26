import { VakFeedbackAdapter } from "../../domain/adapters/vak-feedback.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

    const url = `${GEMINI_BASE}/${envs.GEMINI_CHAT_MODEL}:generateContent?key=${envs.GEMINI_API_KEY}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
    } catch {
      throw CustomError.serviceUnavailable("Gemini feedback request failed");
    }

    if (!response.ok) {
      throw CustomError.badGateway(
        `Gemini feedback returned status ${response.status}`,
      );
    }

    const payload = (await response.json()) as any;
    const text: string | undefined =
      payload?.candidates?.[0]?.content?.parts?.[0]?.text;

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
    const vPct = Math.round(visualProbability * 100);
    const aPct = Math.round(auditoryProbability * 100);
    const kPct = Math.round(kinestheticProbability * 100);

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
