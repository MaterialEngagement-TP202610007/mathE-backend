import { AnswerRepository } from "../../repositories/answer.repository.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { AnswerEntity } from "../../entities/answer.entity.js";
import { CustomError } from "../../error/custom-error.js";
import { assertCanReadQuestionnaire } from "../../policies/questionnaire-access.policy.js";

export class ListAnswersUseCase {
  constructor(
    private readonly answerRepository: AnswerRepository,
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  async execute(
    questionnaireId: number,
    requester: Requester,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<AnswerEntity>> {
    const questionnaire =
      await this.questionnaireRepository.findById(questionnaireId);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${questionnaireId} not found`);
    assertCanReadQuestionnaire(questionnaire, requester);

    return this.answerRepository.findByQuestionnaire(
      questionnaireId,
      pagination,
    );
  }
}
