import { AnswerEntity } from "../../entities/answer.entity.js";
import { AnswerRepository } from "../../repositories/answer.repository.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { CreateAnswerDto } from "../../dtos/answer/create-answer.dto.js";
import { CustomError } from "../../error/custom-error.js";

export class CreateAnswerUseCase {
  constructor(
    private readonly answerRepository: AnswerRepository,
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  async execute(dto: CreateAnswerDto): Promise<AnswerEntity> {
    const questionnaire = await this.questionnaireRepository.findById(
      dto.questionnaireId,
    );
    if (!questionnaire)
      throw CustomError.notFound(
        `Questionnaire ${dto.questionnaireId} not found`,
      );
    if (questionnaire.status !== "in_progress")
      throw CustomError.badRequest(
        `Questionnaire is ${questionnaire.status}, answers cannot be submitted`,
      );

    return this.answerRepository.create({
      questionnaireId: dto.questionnaireId,
      questionId: dto.questionId,
      selectedOptionId: dto.selectedOptionId,
      navigationSequence: dto.navigationSequence,
      questionTimeSeconds: dto.questionTimeSeconds,
      numberOfChanges: dto.numberOfChanges,
      timesReviewed: dto.timesReviewed,
    });
  }
}
