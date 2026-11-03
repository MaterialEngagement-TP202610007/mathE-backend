import { QuestionRepository } from "../../repositories/question.repository.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { UserRepository } from "../../repositories/user.repository.js";
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
    private readonly userRepository: UserRepository,
  ) {}

  async execute(studentId: number): Promise<CreateQuestionnaireResult> {
    const existing =
      await this.questionnaireRepository.findInProgressByStudent(studentId);
    if (existing)
      throw CustomError.conflict(
        "You already have an active questionnaire in progress",
      );

    // The JWT carries no school: load the student to scope the question bank.
    const student = await this.userRepository.findById(studentId);
    const schoolId = student?.schoolId ?? null;

    // HU-17: questions already delivered in previous questionnaires are
    // avoided. When a style's unseen pool is too small, the remaining slots
    // are topped up from already-seen questions of that style instead of
    // failing (a repeated question beats no questionnaire).
    const seen = await this.questionnaireRepository.findSeenQuestions(studentId);
    const seenIds = seen.map((q) => q.questionId);
    const seenStatements = new Set(seen.map((q) => q.statement));

    // 1. For each VAK style, check whether the student's school bank has enough
    //    approved (AI-generated) questions to cover the full distribution.
    //    A student without school always gets the fallback bank.
    const dbQuestionsByStyle = new Map<VakStyle, { id: number }[]>();
    let allStylesFullyCovered = schoolId !== null;

    for (const style of VAK_STYLES) {
      if (schoolId === null) break;
      const needed = STYLE_DISTRIBUTION[style];
      const dbQuestions = await this.pickFromSchoolBank(
        style,
        needed,
        schoolId,
        seenIds,
      );
      dbQuestionsByStyle.set(style, dbQuestions);
      if (dbQuestions.length < needed) {
        allStylesFullyCovered = false;
        break; // one short style already forces the full fallback
      }
    }

    // 2. All-or-nothing: either every question comes from the DB (AI-generated)
    //    or every question comes from the fallback bank. Never mix both.
    const slots: QuestionSlot[] = [];
    const usedFallback = !allStylesFullyCovered;

    for (const style of VAK_STYLES) {
      const needed = STYLE_DISTRIBUTION[style];

      if (allStylesFullyCovered) {
        const dbQuestions = (dbQuestionsByStyle.get(style) ?? []).slice(0, needed);
        for (const q of dbQuestions) {
          slots.push({ dbQuestionId: q.id });
        }
      } else {
        const pool = this.fallbackAdapter.getByStyle(style);
        const unseen = pool.filter((fb) => !seenStatements.has(fb.statement));
        const alreadySeen = pool.filter((fb) => seenStatements.has(fb.statement));
        const picked = [...shuffle(unseen), ...shuffle(alreadySeen)].slice(0, needed);
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

  /**
   * Unseen questions first; if the unseen pool cannot fill `needed` slots,
   * top up with a random sample of the full pool (already-seen questions).
   */
  private async pickFromSchoolBank(
    style: VakStyle,
    needed: number,
    schoolId: number,
    seenIds: number[],
  ): Promise<{ id: number }[]> {
    const unseen = await this.questionRepository.findApprovedByStyle(
      style,
      needed,
      schoolId,
      seenIds,
    );
    if (unseen.length >= needed || seenIds.length === 0) return unseen;

    const pickedIds = new Set(unseen.map((q) => q.id));
    const fullPool = await this.questionRepository.findApprovedByStyle(
      style,
      needed,
      schoolId,
    );
    const topUp = fullPool
      .filter((q) => !pickedIds.has(q.id))
      .slice(0, needed - unseen.length);
    return [...unseen, ...topUp];
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
