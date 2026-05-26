import { prisma } from "../database/index.js";
import { ResultRepository } from "../../domain/repositories/result.repository.js";
import { ResultEntity } from "../../domain/entities/result.entity.js";
import {
  CorrectResultLabelData,
  ResultListFilters,
  SaveResultData,
} from "../../domain/interfaces/result/index.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";
import { CustomError } from "../../domain/error/custom-error.js";

export class ResultRepositoryImpl implements ResultRepository {
  async saveWithDatasetAndNotification(
    data: SaveResultData,
  ): Promise<ResultEntity> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.result.create({
        data: {
          questionnaireId: data.questionnaireId,
          studentId: data.studentId,
          mlModelId: data.mlModelId ?? undefined,
          predominantStyle: data.predominantStyle,
          visualProbability: data.visualProbability,
          auditoryProbability: data.auditoryProbability,
          kinestheticProbability: data.kinestheticProbability,
          isMixedProfile: data.isMixedProfile,
          classifierType: data.classifierType,
          modelVersion: data.modelVersion ?? undefined,
          aiFeedback: data.aiFeedback,
          feedbackSource: data.feedbackSource,
          resultDate: new Date(),
        },
      });

      await tx.mLDataset.create({
        data: {
          questionnaireId: data.questionnaireId,
          studentId: data.studentId,
          visualScore: data.visualScore,
          auditoryScore: data.auditoryScore,
          kinestheticScore: data.kinestheticScore,
          avgQuestionTime: data.avgQuestionTime,
          totalTime: data.totalTime ?? undefined,
          totalChanges: data.totalChanges,
          totalClicks: data.totalClicks,
          engagementLevel: data.engagementLevel,
          responseConsistency: data.responseConsistency,
          completionPercentage: data.completionPercentage ?? undefined,
          vakLabel: data.vakLabel,
          labelSource: "simple_score",
          includedInTraining: false,
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
  ): Promise<PaginatedResult<ResultEntity>> {
    const where = { studentId, deletedAt: null };

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
