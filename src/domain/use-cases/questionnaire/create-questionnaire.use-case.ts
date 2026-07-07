import { QuestionRepository } from "../../repositories/question.repository.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { FallbackQuestionsAdapter } from "../../adapters/fallback-questions.adapter.js";
import {
  CreateQuestionnaireResult,
  FallbackQuestionTemplate,
  QuestionnaireCreationParams,
} from "../../interfaces/questionnaire/index.js";
import { VAK_STYLES, VakStyle } from "../../constants/vak.constant.js";
import { CustomError } from "../../error/custom-error.js";

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
    const existing =
      await this.questionnaireRepository.findInProgressByStudent(studentId);
    if (existing)
      throw CustomError.conflict(
        "You already have an active questionnaire in progress",
      );

    // 1. For each VAK style, check whether the DB has enough approved
    //    (AI-generated) questions to cover the full distribution.
    const dbQuestionsByStyle = new Map<VakStyle, { id: number }[]>();
    let allStylesFullyCovered = true;

    for (const style of VAK_STYLES) {
      const needed = STYLE_DISTRIBUTION[style];
      const dbQuestions = await this.questionRepository.findApprovedByStyle(
        style,
        needed,
      );
      dbQuestionsByStyle.set(style, dbQuestions);
      if (dbQuestions.length < needed) allStylesFullyCovered = false;
    }

    // 2. All-or-nothing: either every question comes from the DB (AI-generated)
    //    or every question comes from the fallback bank. Never mix both.
    const slots: QuestionSlot[] = [];
    const usedFallback = !allStylesFullyCovered;

    for (const style of VAK_STYLES) {
      const needed = STYLE_DISTRIBUTION[style];

      if (allStylesFullyCovered) {
        const dbQuestions = dbQuestionsByStyle.get(style) ?? [];
        for (const q of dbQuestions) {
          slots.push({ dbQuestionId: q.id });
        }
      } else {
        const pool = this.fallbackAdapter.getByStyle(style);
        const picked = shuffle(pool).slice(0, needed);
        for (const fb of picked) {
          slots.push({ fallback: fb });
        }
      }
    }

    // 3. Shuffle all slots so questions are not grouped by style.
    const shuffledSlots = shuffle(slots).slice(0, TOTAL_QUESTIONS);

    // 4. Split into DB questions and fallback questions, assigning order.
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
