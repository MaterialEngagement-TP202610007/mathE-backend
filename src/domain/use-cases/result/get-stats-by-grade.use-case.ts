import { CustomError } from "../../error/custom-error.js";
import { GradeVakStats } from "../../interfaces/result/index.js";
import { ResultRepository } from "../../repositories/result.repository.js";

const VALID_LEVELS = ["Primaria", "Secundaria"] as const;
type Level = (typeof VALID_LEVELS)[number];

export class GetStatsByGradeUseCase {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(schoolId: number, level?: string): Promise<GradeVakStats[]> {
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      throw CustomError.badRequest("Invalid School Id");
    }
    if (level !== undefined && !VALID_LEVELS.includes(level as Level)) {
      throw CustomError.badRequest(
        `level must be one of: ${VALID_LEVELS.join(", ")}`,
      );
    }
    return this.resultRepository.getStatsByGrade(schoolId, level);
  }
}
