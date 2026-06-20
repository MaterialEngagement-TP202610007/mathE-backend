import { CustomError } from "../../error/custom-error.js";
import { SchoolResultStats } from "../../interfaces/result/index.js";
import { ResultRepository } from "../../repositories/result.repository.js";

export class GetSchoolStatsUseCase {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(schoolId: number): Promise<SchoolResultStats> {
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      throw CustomError.badRequest("Invalid School Id");
    }
    return this.resultRepository.getSchoolStats(schoolId);
  }
}
