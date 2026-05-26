import { ResultRepository } from "../../repositories/result.repository.js";
import { ResultEntity } from "../../entities/result.entity.js";
import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";

export class GetResultUseCase {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(
    id: number,
    requesterId: number,
    requesterRole: number,
  ): Promise<ResultEntity> {
    const result = await this.resultRepository.findById(id);
    if (!result) throw CustomError.notFound("Result not found");

    if (
      requesterRole === ROLES.STUDENT &&
      result.studentId !== requesterId
    ) {
      throw CustomError.forbidden("Result does not belong to you");
    }

    return result;
  }
}
