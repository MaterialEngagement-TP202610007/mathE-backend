import { prisma } from "../database/index.js";
import { ResultRepository } from "../../domain/repositories/result.repository.js";
import { ResultEntity } from "../../domain/entities/result.entity.js";
import { SaveResultData } from "../../domain/interfaces/result/index.js";

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
          message: "Tu resultado de estilos de aprendizaje VAK está disponible.",
        },
      });

      return ResultEntity.fromObject(result);
    });
  }
}
