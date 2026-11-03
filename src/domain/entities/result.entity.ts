import { CustomError } from "../error/custom-error.js";

/** HU-44: the user who corrected a result's label. */
export interface ResultCorrector {
  id: number;
  /** `null` only when the corrector relation was not loaded. */
  name: string | null;
}

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
    /** HU-44: pilot ground-truth label set by a teacher. */
    public correctedVakLabel: string | null = null,
    /** HU-44: when the label was last corrected. */
    public correctedAt: Date | null = null,
    /** HU-44: who last corrected the label. */
    public correctedBy: ResultCorrector | null = null,
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
      correctedVakLabel,
      correctedAt,
      correctingTeacherId,
      correctingTeacher,
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
      correctedVakLabel ?? null,
      correctedAt ? new Date(correctedAt) : null,
      ResultEntity.correctorOf(correctingTeacher, correctingTeacherId),
    );
  }

  /** Only id and name of the corrector, never other account fields. */
  private static correctorOf(
    relation: { id?: number; name?: string } | null | undefined,
    correctingTeacherId: number | null | undefined,
  ): ResultCorrector | null {
    if (relation?.id) return { id: relation.id, name: relation.name ?? null };
    if (correctingTeacherId) return { id: correctingTeacherId, name: null };
    return null;
  }
}
