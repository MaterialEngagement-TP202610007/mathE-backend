import { FallbackQuestionTemplate } from "../interfaces/questionnaire/index.js";

/** Port for the local fallback question bank (implemented in infrastructure). */
export abstract class FallbackQuestionsAdapter {
  abstract getByStyle(vakStyle: string): FallbackQuestionTemplate[];
}
