import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { CustomError } from "../../error/custom-error.js";
import { ApproveQuestionDto } from "../../dtos/question/approve-question.dto.js";
import { doubledOptionStyle } from "../../constants/vak.constant.js";

export class ApproveQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  /**
   * HU-42: the teacher may state the question's VAK style on approval; without
   * one the generated style is kept. Options keep their own VAK labels, so a
   * stated style must match the doubled option label (HU-20); legacy questions
   * without a clear 2-1-1 distribution accept the teacher's style.
   */
  async execute(
    id: number,
    requester: Requester,
    dto?: ApproveQuestionDto,
  ): Promise<QuestionEntity> {
    const question = await this.questionRepository.findById(id);
    if (!question) throw CustomError.notFound(`Question ${id} not found`);
    await this.schoolAccessPolicy.assertCanManageQuestion(requester, question);
    if (question.validationStatus !== "pending")
      throw CustomError.badRequest(
        `Question is already ${question.validationStatus}`,
      );

    if (dto?.vakStyle) {
      const expected = doubledOptionStyle(
        question.options.map((option) => option.vakValue),
      );
      if (expected && expected !== dto.vakStyle)
        throw CustomError.badRequest(
          `Selected style ${dto.vakStyle} does not match the options' VAK distribution (${expected}). Reject the question instead.`,
        );
    }

    // Approval is never blocked by MVI; a failed diagnosis is only flagged.
    return this.questionRepository.approve(id, {
      approvedOverMvi: question.mviStatus === "failed",
      vakStyle: dto?.vakStyle ?? null,
    });
  }
}
