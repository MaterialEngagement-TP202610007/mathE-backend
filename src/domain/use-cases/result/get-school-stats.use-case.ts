import { CustomError } from "../../error/custom-error.js";
import { SchoolResultStats } from "../../interfaces/result/index.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { ResultRepository } from "../../repositories/result.repository.js";

export class GetSchoolStatsUseCase {
  constructor(
    private readonly resultRepository: ResultRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(
    schoolId: number,
    requester: Requester,
  ): Promise<SchoolResultStats> {
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      throw CustomError.badRequest("Invalid School Id");
    }
    await this.schoolAccessPolicy.assertCanAccessSchool(requester, schoolId);
    return this.resultRepository.getSchoolStats(schoolId);
  }
}
