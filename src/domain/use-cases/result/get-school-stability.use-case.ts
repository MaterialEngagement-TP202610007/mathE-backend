import { CustomError } from "../../error/custom-error.js";
import {
  SchoolStabilityReport,
  StabilityFilters,
  StabilityResultRow,
  StudentStability,
} from "../../interfaces/result/index.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { ResultRepository } from "../../repositories/result.repository.js";
import { stabilityProfile } from "./stability-profile.js";

const isPositiveInteger = (value: number) =>
  Number.isInteger(value) && value > 0;

/** Rows of one student, already in chronological order. */
function toStudentStability(rows: StabilityResultRow[]): StudentStability {
  const first = rows[0];
  const last = rows[rows.length - 1];

  let changes = 0;
  const styleCounts = new Map<string, number>();
  rows.forEach((row, index) => {
    if (index > 0 && row.predominantStyle !== rows[index - 1].predominantStyle)
      changes += 1;
    styleCounts.set(
      row.predominantStyle,
      (styleCounts.get(row.predominantStyle) ?? 0) + 1,
    );
  });
  const topStyleCount = Math.max(...styleCounts.values());

  return {
    studentId: first.studentId,
    studentName: first.studentName,
    gradeId: first.gradeId,
    gradeName: first.gradeName,
    resultsCount: rows.length,
    firstStyle: first.predominantStyle,
    lastStyle: last.predominantStyle,
    changes,
    profile: stabilityProfile(topStyleCount, rows.length),
    lastResultDate: last.resultDate,
  };
}

/**
 * HU-38: school-wide stability monitor. For every student with classified
 * results in the period, reports how the predominant style varied between
 * consecutive results and the shared stable/variable profile (null with a
 * single result). Same school access rule as the other reports.
 */
export class GetSchoolStabilityUseCase {
  constructor(
    private readonly resultRepository: ResultRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(
    filters: StabilityFilters,
    requester: Requester,
  ): Promise<SchoolStabilityReport> {
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

    const rows = await this.resultRepository.findForStability(filters);

    // Map keeps the repository order (grade, name, student).
    const byStudent = new Map<number, StabilityResultRow[]>();
    for (const row of rows) {
      const list = byStudent.get(row.studentId) ?? [];
      list.push(row);
      byStudent.set(row.studentId, list);
    }
    const students = [...byStudent.values()].map(toStudentStability);

    return {
      schoolId: filters.schoolId,
      gradeId: filters.gradeId ?? null,
      summary: {
        students: students.length,
        stable: students.filter((s) => s.profile === "stable").length,
        variable: students.filter((s) => s.profile === "variable").length,
        insufficientData: students.filter((s) => s.profile === null).length,
      },
      students,
    };
  }
}
