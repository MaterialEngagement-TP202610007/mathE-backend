import { FallbackQuestionsAdapter } from "../../domain/adapters/fallback-questions.adapter.js";
import { FallbackQuestionTemplate } from "../../domain/interfaces/questionnaire/index.js";
import { FALLBACK_QUESTIONS } from "../data/fallback-questions.data.js";

export class FallbackQuestionsAdapterImpl extends FallbackQuestionsAdapter {
  getByStyle(vakStyle: string): FallbackQuestionTemplate[] {
    return FALLBACK_QUESTIONS.filter((q) => q.vakStyle === vakStyle);
  }
}
