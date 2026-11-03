import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { SaveQuestionnaireProgressDto } from "../../dtos/questionnaire/save-questionnaire-progress.dto.js";
import { SaveProgressResult } from "../../interfaces/questionnaire/index.js";
import { CustomError } from "../../error/custom-error.js";
import { assertOwnsQuestionnaire } from "../../policies/questionnaire-access.policy.js";

/**
 * HU-29 S1: saves answers while the questionnaire is in progress so the
 * student can resume after leaving. Upsert by question: saving the same
 * question again replaces its previous answer. Completion still receives the
 * full answer set and replaces these drafts atomically.
 */
export class SaveQuestionnaireProgressUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  async execute(
    id: number,
    studentId: number,
    dto: SaveQuestionnaireProgressDto,
  ): Promise<SaveProgressResult> {
    const questionnaire = await this.questionnaireRepository.findById(id);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${id} not found`);
    assertOwnsQuestionnaire(questionnaire, studentId);
    if (questionnaire.status !== "in_progress")
      throw CustomError.badRequest(
        `Questionnaire is ${questionnaire.status}, answers cannot be submitted`,
      );

    await this.validateAnswers(id, dto);

    const answers = await this.questionnaireRepository.saveProgress(
      id,
      dto.answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        questionTimeSeconds: a.questionTimeSeconds,
        numberOfChanges: a.numberOfChanges,
        timesReviewed: a.timesReviewed,
      })),
    );

    return { questionnaireId: id, answers };
  }

  private async validateAnswers(
    id: number,
    dto: SaveQuestionnaireProgressDto,
  ): Promise<void> {
    const questionOptions =
      await this.questionnaireRepository.findQuestionOptions(id);
    const optionsByQuestion = new Map(
      questionOptions.map((q) => [q.questionId, new Set(q.optionIds)]),
    );

    const seen = new Set<number>();
    for (const answer of dto.answers) {
      const validOptions = optionsByQuestion.get(answer.questionId);
      if (!validOptions)
        throw CustomError.badRequest(
          `Question ${answer.questionId} does not belong to questionnaire ${id}`,
        );
      if (seen.has(answer.questionId))
        throw CustomError.badRequest(
          `Question ${answer.questionId} was answered more than once`,
        );
      seen.add(answer.questionId);

      if (
        answer.selectedOptionId !== null &&
        !validOptions.has(answer.selectedOptionId)
      )
        throw CustomError.badRequest(
          `Option ${answer.selectedOptionId} does not belong to question ${answer.questionId}`,
        );
    }
  }
}
