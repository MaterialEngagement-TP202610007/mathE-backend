import { CustomError } from "../error/custom-error.js";

export class AnswerEntity {
  constructor(
    public id: number,
    public questionnaireId: number,
    public questionId: number,
    public createdAt: Date,
    public updatedAt: Date,
    public selectedOptionId: number | null,
    public navigationSequence: number | null,
    public questionTimeSeconds: number | null,
    public numberOfChanges: number | null,
    public numberOfClicks: number | null,
    public timesReviewed: number | null,
    public deletedAt: Date | null,
  ) {}

  static fromObject(object: { [key: string]: any }): AnswerEntity {
    const {
      id,
      questionnaireId,
      questionId,
      createdAt,
      updatedAt,
      selectedOptionId,
      navigationSequence,
      questionTimeSeconds,
      numberOfChanges,
      numberOfClicks,
      timesReviewed,
      deletedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing Answer Id");
    if (!questionnaireId) throw CustomError.badRequest("Missing Questionnaire Id");
    if (!questionId) throw CustomError.badRequest("Missing Question Id");

    return new AnswerEntity(
      id,
      questionnaireId,
      questionId,
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
      selectedOptionId ?? null,
      navigationSequence ?? null,
      questionTimeSeconds ?? null,
      numberOfChanges ?? null,
      numberOfClicks ?? null,
      timesReviewed ?? null,
      deletedAt ? new Date(deletedAt) : null,
    );
  }
}
