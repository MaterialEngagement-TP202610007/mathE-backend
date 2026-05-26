import { CustomError } from "../error/custom-error.js";

export class MLDatasetEntity {
  constructor(
    public id: number,
    public questionnaireId: number,
    public studentId: number,
    public visualScore: number | null,
    public auditoryScore: number | null,
    public kinestheticScore: number | null,
    public avgQuestionTime: number | null,
    public totalTime: number | null,
    public totalChanges: number | null,
    public totalClicks: number | null,
    public engagementLevel: number | null,
    public responseConsistency: number | null,
    public completionPercentage: number | null,
    public vakLabel: string | null,
    public labelSource: string | null,
    public includedInTraining: boolean,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  static fromObject(object: { [key: string]: any }): MLDatasetEntity {
    const {
      id,
      questionnaireId,
      studentId,
      visualScore,
      auditoryScore,
      kinestheticScore,
      avgQuestionTime,
      totalTime,
      totalChanges,
      totalClicks,
      engagementLevel,
      responseConsistency,
      completionPercentage,
      vakLabel,
      labelSource,
      includedInTraining,
      createdAt,
      updatedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing MLDataset Id");
    if (!questionnaireId)
      throw CustomError.badRequest("Missing Questionnaire Id");
    if (!studentId) throw CustomError.badRequest("Missing Student Id");

    return new MLDatasetEntity(
      id,
      questionnaireId,
      studentId,
      visualScore ?? null,
      auditoryScore ?? null,
      kinestheticScore ?? null,
      avgQuestionTime ?? null,
      totalTime ?? null,
      totalChanges ?? null,
      totalClicks ?? null,
      engagementLevel ?? null,
      responseConsistency ?? null,
      completionPercentage ?? null,
      vakLabel ?? null,
      labelSource ?? null,
      includedInTraining ?? false,
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
    );
  }
}
