import { prisma } from "../../config/database/index.js";
import { ResultRepository } from "../../domain/repositories/result.repository.js";
import { ResultEntity } from "../../domain/entities/result.entity.js";
import {
  CorrectResultLabelData,
  GradeVakStats,
  ResultListFilters,
  SaveResultData,
  SchoolResultStats,
  StudentResultFilters,
} from "../../domain/interfaces/result/index.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";
import { CustomError } from "../../domain/error/custom-error.js";

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
    });
    return result ? ResultEntity.fromObject(result) : null;
  }

  async findByQuestionnaire(
    questionnaireId: number,
  ): Promise<ResultEntity | null> {
    const result = await prisma.result.findFirst({
      where: { questionnaireId, deletedAt: null },
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
      ...(filters.gradeId !== undefined && {
        student: { academicGradeId: filters.gradeId },
      }),
      ...(filters.schoolId !== undefined && {
        student: { schoolId: filters.schoolId },
      }),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.result.findMany({
        where,
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

  async getSchoolStats(schoolId: number): Promise<SchoolResultStats> {
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
      };
    }

    const baseWhere = {
      deletedAt: null,
      predominantStyle: { not: null as null },
      studentId: { in: studentIds },
    };

    const [distinctStudents, styleGroups, agg] = await Promise.all([
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
    ]);

    return {
      schoolId,
      evaluatedStudents: distinctStudents.length,
      mostCommonStyle: styleGroups[0]?.predominantStyle ?? null,
      avgPredominantConfidence: agg._avg.predominantConfidence,
    };
  }

  async getStatsByGrade(
    schoolId: number,
    level?: string,
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
          } satisfies GradeVakStats;
        }

        const baseWhere = {
          deletedAt: null,
          predominantStyle: { not: null as null },
          studentId: { in: studentIds },
        };

        const [distinctStudents, agg] = await Promise.all([
          prisma.result.findMany({
            where: baseWhere,
            select: { studentId: true },
            distinct: ["studentId"],
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

        return {
          gradeId: grade.id,
          gradeName: grade.name,
          level: grade.level,
          evaluatedStudents: distinctStudents.length,
          avgVisualProbability: agg._avg.visualProbability,
          avgAuditoryProbability: agg._avg.auditoryProbability,
          avgKinestheticProbability: agg._avg.kinestheticProbability,
        } satisfies GradeVakStats;
      }),
    );

    return stats;
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
        },
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
