import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { CustomError } from "../../error/custom-error.js";

export class ApproveQuestionUseCase {
  constructor(private readonly questionRepository: QuestionRepository) {}

  async execute(id: number): Promise<QuestionEntity> {
    const question = await this.questionRepository.findById(id);
    if (!question) throw CustomError.notFound(`Question ${id} not found`);
    if (question.validationStatus !== "pending")
      throw CustomError.badRequest(
        `Question is already ${question.validationStatus}`,
      );

    return this.questionRepository.approve(id);
  }
}
