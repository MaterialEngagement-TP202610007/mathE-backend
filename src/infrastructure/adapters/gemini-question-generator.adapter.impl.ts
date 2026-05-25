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

  private buildPrompt(vakStyle: string): string {
    const distribution: Record<string, string> = {
      Visual:      "2 Visual (V), 1 Auditiva (A), 1 Kinestésica (K)",
      Auditory:    "2 Auditivas (A), 1 Visual (V), 1 Kinestésica (K)",
      Kinesthetic: "2 Kinestésicas (K), 1 Visual (V), 1 Auditiva (A)",
    };
  
    const topics = [
      "un experimento de ciencias", "una tarea de historia del Perú", "un trabajo grupal de comunicación",
      "una exposición de matemáticas", "un proyecto de arte", "una clase de educación física",
      "una feria escolar de tecnología", "un concurso de geografía", "una obra de teatro del colegio",
      "un problema de lógica en computación", "una visita de estudios a un museo",
      "preparar un discurso para el día de la bandera", "un debate sobre medio ambiente",
      "aprender una canción en clase de música", "diseñar un volante para un evento escolar",
    ];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const seed = Math.floor(Math.random() * 9999);

    return `Eres un experto en estilos de aprendizaje VAK, especializado en educación para niños y adolescentes de primaria y secundaria de Perú.

    Tu tarea es generar UNA situación hipotética COMPLETAMENTE NUEVA Y ÚNICA sobre: "${randomTopic}" (semilla de variación: ${seed}). La situación usa frases como "imagina que...", "si tuvieras que...", "supón que..." y el alumno debe elegir cómo actuaría. Responde siempre en español castellano peruano.

    Estilo predominante: ${vakStyle}.
    Distribución obligatoria: ${distribution[vakStyle]}.

    Reglas:
    - La situación debe ser DISTINTA a cualquier pregunta típica sobre estilos de aprendizaje; usa el tema indicado como contexto concreto.
    - Las 4 opciones deben sonar igual de válidas, ninguna debe parecer "la más correcta".
    - Redacta las opciones en primera persona ("me quedaría más claro si...", "lo entendería mejor...").
    - Evita palabras que delaten el estilo: "ver", "escuchar", "tocar", "leer", "dibujar".
    - Lenguaje cercano y simple, como hablaría un alumno de colegio peruano.
    - No menciones los estilos VAK en ninguna parte del texto.

    Responde ÚNICAMENTE con este JSON sin texto adicional:
    {"statement":"...","options":[{"text":"...","vak_value":"V|A|K"}]}`;
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
