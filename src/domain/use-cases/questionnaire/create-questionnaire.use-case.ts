import { QuestionRepository } from "../../repositories/question.repository.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { FallbackQuestionsAdapter } from "../../adapters/fallback-questions.adapter.js";
import {
  CreateQuestionnaireResult,
  FallbackQuestionTemplate,
  QuestionnaireCreationParams,
} from "../../interfaces/questionnaire/index.js";
import { VAK_STYLES, VakStyle } from "../../constants/vak.constant.js";

const STYLE_DISTRIBUTION: Record<VakStyle, number> = {
  Visual: 4,
  Auditory: 3,
  Kinesthetic: 3,
};
const TOTAL_QUESTIONS = 10;

interface QuestionSlot {
  dbQuestionId?: number;
  fallback?: FallbackQuestionTemplate;
}

export class CreateQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly fallbackAdapter: FallbackQuestionsAdapter,
  ) {}

  async execute(studentId: number): Promise<CreateQuestionnaireResult> {
    const slots: QuestionSlot[] = [];
    let usedFallback = false;

    // 1. For each VAK style, fetch available approved questions from DB.
    //    Fill missing slots with fallback templates.
    for (const style of VAK_STYLES) {
      const needed = STYLE_DISTRIBUTION[style];
      const dbQuestions = await this.questionRepository.findApprovedByStyle(
        style,
        needed,
      );

      for (const q of dbQuestions) {
        slots.push({ dbQuestionId: q.id });
      }

      const deficit = needed - dbQuestions.length;
      if (deficit > 0) {
        usedFallback = true;
        const pool = this.fallbackAdapter.getByStyle(style);
        const picked = shuffle(pool).slice(0, deficit);
        for (const fb of picked) {
          slots.push({ fallback: fb });
        }
      }
    }

    // 2. Shuffle all slots so questions are not grouped by style.
    const shuffledSlots = shuffle(slots).slice(0, TOTAL_QUESTIONS);

    // 3. Split into DB questions and fallback questions, assigning order.
    const params: QuestionnaireCreationParams = {
      studentId,
      usedFallback,
      assignedQuestions: [],
      fallbackToCreate: [],
    };

    shuffledSlots.forEach((slot, index) => {
      const order = index + 1;
      if (slot.dbQuestionId !== undefined) {
        params.assignedQuestions.push({ questionId: slot.dbQuestionId, order });
      } else if (slot.fallback) {
        params.fallbackToCreate.push({ ...slot.fallback, order });
      }
    });

    return this.questionnaireRepository.createWithQuestions(params);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
