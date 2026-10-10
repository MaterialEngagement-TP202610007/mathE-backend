import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { ActiveQuestionnaireResult } from "../../interfaces/questionnaire/index.js";
import { CustomError } from "../../error/custom-error.js";

export class GetActiveQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  /** Active questionnaire plus its saved answers and where to resume (HU-29). */
  async execute(studentId: number): Promise<ActiveQuestionnaireResult> {
    const active =
      await this.questionnaireRepository.findActiveWithQuestions(studentId);
    if (!active)
      throw CustomError.notFound("No active questionnaire found for this student");

    const answered = new Set(
      active.answers
        .filter((a) => a.selectedOptionId !== null)
        .map((a) => a.questionId),
    );
    const firstUnanswered = active.questions.findIndex(
      (q) => !answered.has(q.questionId),
    );
    const resumeIndex =
      firstUnanswered === -1
        ? Math.max(0, active.questions.length - 1)
        : firstUnanswered;

    return {
      ...active,
      answeredCount: active.questions.filter((q) => answered.has(q.questionId))
        .length,
      resumeIndex,
    };
  }
}
