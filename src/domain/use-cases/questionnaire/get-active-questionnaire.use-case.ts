import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { CreateQuestionnaireResult } from "../../interfaces/questionnaire/index.js";
import { CustomError } from "../../error/custom-error.js";

export class GetActiveQuestionnaireUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  async execute(studentId: number): Promise<CreateQuestionnaireResult> {
    const active =
      await this.questionnaireRepository.findActiveWithQuestions(studentId);
    if (!active)
      throw CustomError.notFound("No active questionnaire found for this student");
    return active;
  }
}
