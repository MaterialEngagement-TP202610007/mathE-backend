import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import {
  Granularity,
  UserEvolutionResult,
} from "../../interfaces/result/index.js";
import { ResultRepository } from "../../repositories/result.repository.js";

interface EvolutionOptions {
  from?: Date;
  to?: Date;
  granularity?: Granularity;
}

function inferGranularity(rangeDays: number): Granularity {
  if (rangeDays <= 90) return "day";
  if (rangeDays <= 730) return "month";
  return "year";
}

export class GetUserEvolutionUseCase {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(
    studentId: number,
    requesterId: number,
    requesterRole: number,
    options: EvolutionOptions,
  ): Promise<UserEvolutionResult> {
    if (!Number.isInteger(studentId) || studentId <= 0) {
      throw CustomError.badRequest("Invalid studentId");
    }
    if (requesterRole === ROLES.STUDENT && requesterId !== studentId) {
      throw CustomError.forbidden("Cannot access another student's evolution");
    }

    const to = options.to ?? new Date();

    let from: Date;
    if (options.from) {
      from = options.from;
    } else {
      const firstDate =
        await this.resultRepository.findFirstResultDateByStudent(studentId);
      from = firstDate ?? to;
    }

    if (from > to) from = to;

    const rangeDays = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );
    const granularity = options.granularity ?? inferGranularity(rangeDays);

    const { dataPoints, totalEvaluations } =
      await this.resultRepository.getUserEvolution(
        studentId,
        from,
        to,
        granularity,
      );

    return {
      studentId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      granularity,
      totalEvaluations,
      dataPoints,
    };
  }
}
