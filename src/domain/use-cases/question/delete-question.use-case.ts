import { QuestionRepository } from "../../repositories/question.repository.js";
import { CustomError } from "../../error/custom-error.js";

export class DeleteQuestionUseCase {
  constructor(private readonly questionRepository: QuestionRepository) {}

  async execute(id: number): Promise<void> {
    const question = await this.questionRepository.findById(id);
    if (!question) throw CustomError.notFound(`Question ${id} not found`);

    await this.questionRepository.softDelete(id);
  }
}
