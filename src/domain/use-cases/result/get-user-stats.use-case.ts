import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import { UserResultStats } from "../../interfaces/result/index.js";
import { ResultRepository } from "../../repositories/result.repository.js";

export class GetUserStatsUseCase {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(
    userId: number,
    requesterId: number,
    requesterRole: number,
  ): Promise<UserResultStats> {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw CustomError.badRequest("Invalid userId");
    }
    if (requesterRole === ROLES.STUDENT && requesterId !== userId) {
      throw CustomError.forbidden("Cannot access another student's stats");
    }
    return this.resultRepository.getUserStats(userId);
  }
}
