import { QuestionnaireEntity } from "../../entities/questionnaire.entity.js";
import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { CustomError } from "../../error/custom-error.js";

export class GetQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  async execute(id: number): Promise<QuestionnaireEntity> {
    const questionnaire = await this.questionnaireRepository.findById(id);
    if (!questionnaire)
      throw CustomError.notFound(`Questionnaire ${id} not found`);
    return questionnaire;
  }
}
