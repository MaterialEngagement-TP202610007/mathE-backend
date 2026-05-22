import { GeneratedQuestion } from "../interfaces/question/index.js";

/**
 * Generative AI chat port (PASO 1). Implemented in infrastructure by the
 * Gemini adapter. Returns one VAK question with its statement and options as
 * structured data — JSON parsing lives in the impl, not in the use case.
 */
export abstract class AIQuestionGeneratorAdapter {
  abstract generateQuestion(vakStyle: string): Promise<GeneratedQuestion>;
}
