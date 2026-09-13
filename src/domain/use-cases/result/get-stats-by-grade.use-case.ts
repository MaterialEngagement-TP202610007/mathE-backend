import { CustomError } from "../../error/custom-error.js";
import { GradeVakStats } from "../../interfaces/result/index.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { ResultRepository } from "../../repositories/result.repository.js";

const VALID_LEVELS = ["Primaria", "Secundaria"] as const;
type Level = (typeof VALID_LEVELS)[number];

export class GetStatsByGradeUseCase {
  constructor(
    private readonly resultRepository: ResultRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(
    schoolId: number,
    level: string | undefined,
    requester: Requester,
  ): Promise<GradeVakStats[]> {
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      throw CustomError.badRequest("Invalid School Id");
    }
    if (level !== undefined && !VALID_LEVELS.includes(level as Level)) {
      throw CustomError.badRequest(
        `level must be one of: ${VALID_LEVELS.join(", ")}`,
      );
    }
    await this.schoolAccessPolicy.assertCanAccessSchool(requester, schoolId);
    return this.resultRepository.getStatsByGrade(schoolId, level);
  }
}
