import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { CustomError } from "../../error/custom-error.js";

export class ApproveQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(id: number, requester: Requester): Promise<QuestionEntity> {
    const question = await this.questionRepository.findById(id);
    if (!question) throw CustomError.notFound(`Question ${id} not found`);
    await this.schoolAccessPolicy.assertCanManageQuestion(requester, question);
    if (question.validationStatus !== "pending")
      throw CustomError.badRequest(
        `Question is already ${question.validationStatus}`,
      );

    return this.questionRepository.approve(id);
  }
}
