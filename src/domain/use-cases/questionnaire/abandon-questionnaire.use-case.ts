import { QuestionnaireEntity } from "../../entities/questionnaire.entity.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { CustomError } from "../../error/custom-error.js";
import { assertOwnsQuestionnaire } from "../../policies/questionnaire-access.policy.js";

export class AbandonQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  async execute(id: number, studentId: number): Promise<QuestionnaireEntity> {
    const questionnaire = await this.questionnaireRepository.findById(id);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${id} not found`);
    assertOwnsQuestionnaire(questionnaire, studentId);
    if (questionnaire.status !== "in_progress")
      throw CustomError.badRequest(
        `Questionnaire is already ${questionnaire.status}`,
      );

    return this.questionnaireRepository.abandon(id);
  }
}
