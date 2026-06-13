import { CustomError } from "../error/custom-error.js";

export class ResultEntity {
  constructor(
    public id: number,
    public questionnaireId: number,
    public studentId: number,
    public mlModelId: number | null,
    public predominantStyle: string | null,
    public secondaryStyle: string | null,
    public visualProbability: number | null,
    public auditoryProbability: number | null,
    public kinestheticProbability: number | null,
    public predominantConfidence: number | null,
    public profileType: string | null,
    public isMixedProfile: boolean,
    public classifierType: string | null,
    public modelVersion: string | null,
    public aiFeedback: string | null,
    public feedbackSource: string | null,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  static fromObject(object: { [key: string]: any }): ResultEntity {
    const {
      id,
      questionnaireId,
      studentId,
      mlModelId,
      predominantStyle,
      secondaryStyle,
      visualProbability,
      auditoryProbability,
      kinestheticProbability,
      predominantConfidence,
      profileType,
      isMixedProfile,
      classifierType,
      modelVersion,
      aiFeedback,
      feedbackSource,
      createdAt,
      updatedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing Result Id");
    if (!questionnaireId) throw CustomError.badRequest("Missing Questionnaire Id");
    if (!studentId) throw CustomError.badRequest("Missing Student Id");

    return new ResultEntity(
      id,
      questionnaireId,
      studentId,
      mlModelId ?? null,
      predominantStyle ?? null,
      secondaryStyle ?? null,
      visualProbability ?? null,
      auditoryProbability ?? null,
      kinestheticProbability ?? null,
      predominantConfidence ?? null,
      profileType ?? null,
      isMixedProfile ?? false,
      classifierType ?? null,
      modelVersion ?? null,
      aiFeedback ?? null,
      feedbackSource ?? null,
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
    );
  }
}
