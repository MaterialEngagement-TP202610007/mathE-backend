import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { CustomError } from "../../error/custom-error.js";

export class GetQuestionUseCase {
  constructor(private readonly questionRepository: QuestionRepository) {}

  async execute(id: number): Promise<QuestionEntity> {
    const question = await this.questionRepository.findById(id);
    if (!question) throw CustomError.notFound(`Question ${id} not found`);
    return question;
  }
}
