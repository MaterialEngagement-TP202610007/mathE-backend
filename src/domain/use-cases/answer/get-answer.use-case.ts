import { AnswerEntity } from "../../entities/answer.entity.js";
import { AnswerRepository } from "../../repositories/answer.repository.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { CustomError } from "../../error/custom-error.js";
import { assertCanReadQuestionnaire } from "../../policies/questionnaire-access.policy.js";

export class GetAnswerUseCase {
  constructor(
    private readonly answerRepository: AnswerRepository,
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  async execute(
    id: number,
    questionnaireId: number,
    requester: Requester,
  ): Promise<AnswerEntity> {
    const questionnaire =
      await this.questionnaireRepository.findById(questionnaireId);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${questionnaireId} not found`);
    assertCanReadQuestionnaire(questionnaire, requester);

    const answer = await this.answerRepository.findById(id, questionnaireId);
    if (!answer)
      throw CustomError.notFound(
        `Answer ${id} not found in questionnaire ${questionnaireId}`,
      );
    return answer;
  }
}
