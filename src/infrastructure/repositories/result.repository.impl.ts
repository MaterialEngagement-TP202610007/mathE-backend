import { prisma } from "../../config/database/index.js";
import { ResultRepository } from "../../domain/repositories/result.repository.js";
import { ResultEntity } from "../../domain/entities/result.entity.js";
import {
  CorrectResultLabelData,
  EvolutionDataPoint,
  GradeVakStats,
  Granularity,
  ReportPeriod,
  ResultExportFilters,
  ResultExportRow,
  ResultListFilters,
  SaveResultData,
  SchoolResultStats,
  StabilityFilters,
  StabilityResultRow,
  StudentResultFilters,
  UserResultStats,
  VakStyleCounts,
} from "../../domain/interfaces/result/index.js";
import { stabilityProfile } from "../../domain/use-cases/result/stability-profile.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";
import { CustomError } from "../../domain/error/custom-error.js";

/** HU-44: load only the corrector's id and name with a result. */
const withCorrector = {
  correctingTeacher: { select: { id: true, name: true } },
} as const;

/**
 * HU-51: match results whose `resultDate` falls in the period. Legacy rows
 * without a `resultDate` fall back to `createdAt`. Empty when the period is open.
 */
function resultDateWhere(period: ReportPeriod = {}) {
  if (!period.from && !period.to) return {};
  const range = {
    ...(period.from && { gte: period.from }),
    ...(period.to && { lte: period.to }),
  };
  return {
    OR: [{ resultDate: range }, { resultDate: null, createdAt: range }],
  };
}

const emptyStyleCounts = (): VakStyleCounts => ({
  Visual: 0,
  Auditory: 0,
  Kinesthetic: 0,
});

/**
 * HU-48: keeps the first row per student (rows come newest first) and counts
 * students by that result's predominant style.
 */
function latestStyleCounts(
  rows: { studentId: number; predominantStyle: string | null }[],
): { evaluatedStudents: number; styleCounts: VakStyleCounts } {
  const latest = new Map<number, string | null>();
  for (const row of rows) {
    if (!latest.has(row.studentId)) latest.set(row.studentId, row.predominantStyle);
  }
  const styleCounts = emptyStyleCounts();
  for (const style of latest.values()) {
    if (style && style in styleCounts) styleCounts[style as keyof VakStyleCounts]++;
  }
  return { evaluatedStudents: latest.size, styleCounts };
}

export class ResultRepositoryImpl implements ResultRepository {
  async saveWithNotification(data: SaveResultData): Promise<ResultEntity> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.result.create({
        data: {
          questionnaireId: data.questionnaireId,
          studentId: data.studentId,
          mlModelId: data.mlModelId ?? undefined,
          predominantStyle: data.predominantStyle,
          secondaryStyle: data.secondaryStyle ?? undefined,
          visualProbability: data.visualProbability,
          auditoryProbability: data.auditoryProbability,
          kinestheticProbability: data.kinestheticProbability,
          predominantConfidence: data.predominantConfidence,
          profileType: data.profileType ?? undefined,
          isMixedProfile: data.isMixedProfile,
          classifierType: data.classifierType,
          modelVersion: data.modelVersion ?? undefined,
          aiFeedback: data.aiFeedback,
          feedbackSource: data.feedbackSource,
          resultDate: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          studentId: data.studentId,
          resultId: result.id,
          type: "result_available",
          message:
            "Tu resultado de estilos de aprendizaje VAK está disponible.",
        },
      });

      return ResultEntity.fromObject(result);
    });
  }

  async findById(id: number): Promise<ResultEntity | null> {
    const result = await prisma.result.findFirst({
      where: { id, deletedAt: null },
      include: withCorrector,
    });
    return result ? ResultEntity.fromObject(result) : null;
  }

  async findByQuestionnaire(
    questionnaireId: number,
  ): Promise<ResultEntity | null> {
    const result = await prisma.result.findFirst({
      where: { questionnaireId, deletedAt: null },
      include: withCorrector,
    });
    return result ? ResultEntity.fromObject(result) : null;
  }

  async findByStudent(
    studentId: number,
    pagination: PaginationDto,
    filters: StudentResultFilters = {},
  ): Promise<PaginatedResult<ResultEntity>> {
    const where = {
      studentId,
      deletedAt: null,
      ...(filters.predominantStyle !== undefined && {
        predominantStyle: filters.predominantStyle,
      }),
      ...(filters.classifierType !== undefined && {
        classifierType: filters.classifierType,
      }),
      ...((filters.startDate !== undefined || filters.endDate !== undefined) && {
        createdAt: {
          ...(filters.startDate !== undefined && { gte: filters.startDate }),
          ...(filters.endDate !== undefined && { lte: filters.endDate }),
        },
      }),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.result.findMany({
        where,
        include: withCorrector,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.result.count({ where }),
    ]);

    return {
      items: rows.map(ResultEntity.fromObject),
      total,
      page,
      limit,
    };
  }

  async findAll(
    pagination: PaginationDto,
    filters: ResultListFilters = {},
  ): Promise<PaginatedResult<ResultEntity>> {
    const where = {
      deletedAt: null,
      ...(filters.studentId !== undefined && { studentId: filters.studentId }),
      ...(filters.classifierType !== undefined && {
        classifierType: filters.classifierType,
      }),
      ...resultDateWhere({ from: filters.startDate, to: filters.endDate }),
      ...(filters.labelStatus === "corrected" && {
        correctedVakLabel: { not: null as null },
      }),
      ...(filters.labelStatus === "uncorrected" && { correctedVakLabel: null }),
      // Both conditions target the same relation — merge them into one object.
      ...((filters.gradeId !== undefined || filters.schoolId !== undefined) && {
        student: {
          ...(filters.gradeId !== undefined && {
            academicGradeId: filters.gradeId,
          }),
          ...(filters.schoolId !== undefined && { schoolId: filters.schoolId }),
        },
      }),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.result.findMany({
        where,
        include: withCorrector,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.result.count({ where }),
    ]);

    return {
      items: rows.map(ResultEntity.fromObject),
      total,
      page,
      limit,
    };
  }

  async getSchoolStats(
    schoolId: number,
    period: ReportPeriod = {},
  ): Promise<SchoolResultStats> {
    const studentIds = await prisma.user
      .findMany({
        where: { schoolId, deletedAt: null },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));

    if (studentIds.length === 0) {
      return {
        schoolId,
        evaluatedStudents: 0,
        mostCommonStyle: null,
        avgPredominantConfidence: null,
        startedQuestionnaires: 0,
        completedQuestionnaires: 0,
        completionRate: null,
        avgResponseTimeSeconds: null,
      };
    }

    const baseWhere = {
      deletedAt: null,
      predominantStyle: { not: null as null },
      studentId: { in: studentIds },
      ...resultDateWhere(period),
    };

    // HU-50: questionnaires are scoped by when they were started.
    const startedWhere = {
      deletedAt: null,
      studentId: { in: studentIds },
      ...(period.from || period.to
        ? {
            startTime: {
              ...(period.from && { gte: period.from }),
              ...(period.to && { lte: period.to }),
            },
          }
        : {}),
    };
    const completedWhere = { ...startedWhere, status: "completed" };

    const [
      distinctStudents,
      styleGroups,
      agg,
      startedQuestionnaires,
      completedQuestionnaires,
      timing,
    ] = await Promise.all([
      prisma.result.findMany({
        where: baseWhere,
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.result.groupBy({
        by: ["predominantStyle"],
        where: baseWhere,
        _count: { predominantStyle: true },
        orderBy: { _count: { predominantStyle: "desc" } },
      }),
      prisma.result.aggregate({
        where: baseWhere,
        _avg: { predominantConfidence: true },
      }),
      prisma.questionnaire.count({ where: startedWhere }),
      prisma.questionnaire.count({ where: completedWhere }),
      prisma.mLDataset.aggregate({
        where: { questionnaire: completedWhere },
        _avg: { avgQuestionTime: true },
      }),
    ]);

    return {
      schoolId,
      evaluatedStudents: distinctStudents.length,
      mostCommonStyle: styleGroups[0]?.predominantStyle ?? null,
      avgPredominantConfidence: agg._avg.predominantConfidence,
      startedQuestionnaires,
      completedQuestionnaires,
      completionRate:
        startedQuestionnaires > 0
          ? completedQuestionnaires / startedQuestionnaires
          : null,
      avgResponseTimeSeconds:
        completedQuestionnaires > 0 ? timing._avg.avgQuestionTime : null,
    };
  }

  async getStatsByGrade(
    schoolId: number,
    level?: string,
    period: ReportPeriod = {},
  ): Promise<GradeVakStats[]> {
    const grades = await prisma.academicGrade.findMany({
      where: level ? { level } : undefined,
      orderBy: { order: "asc" },
    });

    const stats = await Promise.all(
      grades.map(async (grade) => {
        const studentIds = await prisma.user
          .findMany({
            where: { schoolId, academicGradeId: grade.id, deletedAt: null },
            select: { id: true },
          })
          .then((rows) => rows.map((r) => r.id));

        if (studentIds.length === 0) {
          return {
            gradeId: grade.id,
            gradeName: grade.name,
            level: grade.level,
            evaluatedStudents: 0,
            avgVisualProbability: null,
            avgAuditoryProbability: null,
            avgKinestheticProbability: null,
            styleCounts: emptyStyleCounts(),
          } satisfies GradeVakStats;
        }

        const baseWhere = {
          deletedAt: null,
          predominantStyle: { not: null as null },
          studentId: { in: studentIds },
          ...resultDateWhere(period),
        };

        const [studentResults, agg] = await Promise.all([
          prisma.result.findMany({
            where: baseWhere,
            select: { studentId: true, predominantStyle: true },
            // Postgres sorts NULLs first on DESC; legacy rows without resultDate go last.
            orderBy: [
              { resultDate: { sort: "desc", nulls: "last" } },
              { createdAt: "desc" },
            ],
          }),
          prisma.result.aggregate({
            where: baseWhere,
            _avg: {
              visualProbability: true,
              auditoryProbability: true,
              kinestheticProbability: true,
            },
          }),
        ]);

        const { evaluatedStudents, styleCounts } =
          latestStyleCounts(studentResults);

        return {
          gradeId: grade.id,
          gradeName: grade.name,
          level: grade.level,
          evaluatedStudents,
          avgVisualProbability: agg._avg.visualProbability,
          avgAuditoryProbability: agg._avg.auditoryProbability,
          avgKinestheticProbability: agg._avg.kinestheticProbability,
          styleCounts,
        } satisfies GradeVakStats;
      }),
    );

    return stats;
  }

  async findForExport(filters: ResultExportFilters): Promise<ResultExportRow[]> {
    const rows = await prisma.result.findMany({
      where: {
        deletedAt: null,
        predominantStyle: { not: null as null },
        student: {
          schoolId: filters.schoolId,
          deletedAt: null,
          ...(filters.gradeId !== undefined && {
            academicGradeId: filters.gradeId,
          }),
        },
        ...resultDateWhere(filters),
      },
      // Report columns only: no account (email, password) or MVI data.
      select: {
        resultDate: true,
        createdAt: true,
        predominantStyle: true,
        predominantConfidence: true,
        visualProbability: true,
        auditoryProbability: true,
        kinestheticProbability: true,
        isMixedProfile: true,
        secondaryStyle: true,
        classifierType: true,
        student: {
          select: {
            id: true,
            name: true,
            academicGrade: { select: { name: true, level: true } },
          },
        },
      },
      orderBy: [
        { student: { academicGrade: { order: "asc" } } },
        { student: { name: "asc" } },
        { resultDate: { sort: "asc", nulls: "first" } },
        { createdAt: "asc" },
      ],
    });

    return rows.map((row) => ({
      gradeName: row.student.academicGrade?.name ?? null,
      gradeLevel: row.student.academicGrade?.level ?? null,
      studentId: row.student.id,
      studentName: row.student.name,
      resultDate: row.resultDate ?? row.createdAt,
      predominantStyle: row.predominantStyle!,
      predominantConfidence: row.predominantConfidence,
      visualProbability: row.visualProbability,
      auditoryProbability: row.auditoryProbability,
      kinestheticProbability: row.kinestheticProbability,
      isMixedProfile: row.isMixedProfile,
      secondaryStyle: row.secondaryStyle,
      classifierType: row.classifierType,
    }));
  }

  async findForStability(
    filters: StabilityFilters,
  ): Promise<StabilityResultRow[]> {
    const rows = await prisma.result.findMany({
      where: {
        deletedAt: null,
        predominantStyle: { not: null as null },
        student: {
          schoolId: filters.schoolId,
          deletedAt: null,
          ...(filters.gradeId !== undefined && {
            academicGradeId: filters.gradeId,
          }),
        },
        ...resultDateWhere(filters),
      },
      // Only what the monitor shows: no account or MVI data.
      select: {
        resultDate: true,
        createdAt: true,
        predominantStyle: true,
        student: {
          select: {
            id: true,
            name: true,
            academicGradeId: true,
            academicGrade: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { student: { academicGrade: { order: "asc" } } },
        { student: { name: "asc" } },
        { studentId: "asc" },
        { resultDate: { sort: "asc", nulls: "first" } },
        { createdAt: "asc" },
      ],
    });

    return rows.map((row) => ({
      studentId: row.student.id,
      studentName: row.student.name,
      gradeId: row.student.academicGradeId,
      gradeName: row.student.academicGrade?.name ?? null,
      predominantStyle: row.predominantStyle as StabilityResultRow["predominantStyle"],
      resultDate: row.resultDate ?? row.createdAt,
    }));
  }

  async getUserStats(userId: number): Promise<UserResultStats> {
    const baseWhere = { studentId: userId, deletedAt: null };

    const [total, styleGroups] = await Promise.all([
      prisma.result.count({ where: baseWhere }),
      prisma.result.groupBy({
        by: ["predominantStyle"],
        where: { ...baseWhere, predominantStyle: { not: null } },
        _count: { predominantStyle: true },
        orderBy: { _count: { predominantStyle: "desc" } },
      }),
    ]);

    if (total === 0) {
      return { userId, total: 0, predominantStyle: null, profile: null };
    }

    const topGroup = styleGroups[0];
    const predominantStyle = (topGroup?.predominantStyle ?? null) as
      | "Visual"
      | "Auditory"
      | "Kinesthetic"
      | null;
    const topCount = predominantStyle
      ? (topGroup?._count.predominantStyle ?? 0)
      : 0;
    // HU-38: shared rule; a single result has no profile (null), not "Estable".
    const shared = stabilityProfile(topCount, total);
    const profile =
      shared === null ? null : shared === "stable" ? "Estable" : "Variable";

    return { userId, total, predominantStyle, profile };
  }

  async findFirstResultDateByStudent(studentId: number): Promise<Date | null> {
    const first = await prisma.result.findFirst({
      where: { studentId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return first?.createdAt ?? null;
  }

  async getUserEvolution(
    studentId: number,
    from: Date,
    to: Date,
    granularity: Granularity,
  ): Promise<{ dataPoints: EvolutionDataPoint[]; totalEvaluations: number }> {
    const endOfTo = new Date(to);
    endOfTo.setUTCHours(23, 59, 59, 999);

    type RawRow = {
      period: Date;
      predominantStyle: string;
      avgVisualProbability: number | null;
      avgAuditoryProbability: number | null;
      avgKinestheticProbability: number | null;
      count: bigint;
    };

    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        period,
        MODE() WITHIN GROUP (ORDER BY "predominantStyle")           AS "predominantStyle",
        ROUND(AVG("visualProbability")::numeric, 2)::float          AS "avgVisualProbability",
        ROUND(AVG("auditoryProbability")::numeric, 2)::float        AS "avgAuditoryProbability",
        ROUND(AVG("kinestheticProbability")::numeric, 2)::float     AS "avgKinestheticProbability",
        COUNT(*)                                                     AS count
      FROM (
        SELECT
          DATE_TRUNC(${granularity}, "createdAt") AS period,
          "predominantStyle",
          "visualProbability",
          "auditoryProbability",
          "kinestheticProbability"
        FROM "Result"
        WHERE "studentId" = ${studentId}
          AND "deletedAt" IS NULL
          AND "predominantStyle" IS NOT NULL
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${endOfTo}
      ) sub
      GROUP BY period
      ORDER BY period ASC
    `;

    const dataPoints: EvolutionDataPoint[] = rows.map((row) => {
      let period: string;
      const d = new Date(row.period);
      if (granularity === "day") period = d.toISOString().slice(0, 10);
      else if (granularity === "month") period = d.toISOString().slice(0, 7);
      else period = d.toISOString().slice(0, 4);

      return {
        period,
        predominantStyle: row.predominantStyle as
          | "Visual"
          | "Auditory"
          | "Kinesthetic",
        avgVisualProbability: row.avgVisualProbability ?? 0,
        avgAuditoryProbability: row.avgAuditoryProbability ?? 0,
        avgKinestheticProbability: row.avgKinestheticProbability ?? 0,
        count: Number(row.count),
      };
    });

    const totalEvaluations = dataPoints.reduce((sum, p) => sum + p.count, 0);
    return { dataPoints, totalEvaluations };
  }

  async correctLabel(data: CorrectResultLabelData): Promise<ResultEntity> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.result.findFirst({
        where: { id: data.resultId, deletedAt: null },
      });
      if (!result) throw CustomError.notFound("Result not found");

      const updated = await tx.result.update({
        where: { id: data.resultId },
        data: {
          correctedVakLabel: data.vakLabel,
          correctingTeacherId: data.teacherId,
          correctedAt: data.correctedAt,
        },
        include: withCorrector,
      });

      await tx.mLDataset.updateMany({
        where: { questionnaireId: result.questionnaireId },
        data: {
          vakLabel: data.vakLabel,
          labelSource: "teacher_validated",
        },
      });

      return ResultEntity.fromObject(updated);
    });
  }
}
