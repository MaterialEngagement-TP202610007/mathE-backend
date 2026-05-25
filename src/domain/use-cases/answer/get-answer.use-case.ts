import { AnswerEntity } from "../../entities/answer.entity.js";
import { AnswerRepository } from "../../repositories/answer.repository.js";
import { CustomError } from "../../error/custom-error.js";

export class GetAnswerUseCase {
  constructor(private readonly answerRepository: AnswerRepository) {}

  async execute(id: number, questionnaireId: number): Promise<AnswerEntity> {
    const answer = await this.answerRepository.findById(id, questionnaireId);
    if (!answer)
      throw CustomError.notFound(
        `Answer ${id} not found in questionnaire ${questionnaireId}`,
      );
    return answer;
  }
}
