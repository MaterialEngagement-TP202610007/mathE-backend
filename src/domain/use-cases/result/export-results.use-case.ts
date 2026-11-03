import { CustomError } from "../../error/custom-error.js";
import {
  ResultExport,
  ResultExportFilters,
} from "../../interfaces/result/index.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { ResultRepository } from "../../repositories/result.repository.js";

const isPositiveInteger = (value: number) =>
  Number.isInteger(value) && value > 0;

/**
 * HU-49: results of a school (optionally one grade) in a period, for the CSV
 * export. Same school access rule as the other reports.
 */
export class ExportResultsUseCase {
  constructor(
    private readonly resultRepository: ResultRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(
    filters: ResultExportFilters,
    requester: Requester,
  ): Promise<ResultExport> {
    if (!isPositiveInteger(filters.schoolId)) {
      throw CustomError.badRequest("Invalid School Id");
    }
    if (filters.gradeId !== undefined && !isPositiveInteger(filters.gradeId)) {
      throw CustomError.badRequest("Invalid Grade Id");
    }
    await this.schoolAccessPolicy.assertCanAccessSchool(
      requester,
      filters.schoolId,
    );

    const rows = await this.resultRepository.findForExport(filters);
    if (rows.length === 0) {
      throw CustomError.notFound("No results to export for the selected filters");
    }

    const times = rows.map((row) => row.resultDate.getTime());
    return {
      schoolId: filters.schoolId,
      gradeId: filters.gradeId ?? null,
      from: filters.from ?? new Date(Math.min(...times)),
      to: filters.to ?? new Date(Math.max(...times)),
      rows,
    };
  }
}
