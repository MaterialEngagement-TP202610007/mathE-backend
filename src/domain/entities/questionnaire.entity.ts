import { CustomError } from "../error/custom-error.js";

export class QuestionnaireEntity {
  constructor(
    public id: number,
    public studentId: number,
    public status: string,
    public startTime: Date,
    public createdAt: Date,
    public updatedAt: Date,
    public totalTimeSeconds: number | null,
    public completionPercentage: number | null,
    public usedFallback: boolean,
    public endTime: Date | null,
    public deletedAt: Date | null,
  ) {}

  static fromObject(object: { [key: string]: any }): QuestionnaireEntity {
    const {
      id,
      studentId,
      status,
      startTime,
      createdAt,
      updatedAt,
      totalTimeSeconds,
      completionPercentage,
      usedFallback,
      endTime,
      deletedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing Questionnaire Id");
    if (!studentId) throw CustomError.badRequest("Missing Student Id");
    if (!status) throw CustomError.badRequest("Missing Status");

    return new QuestionnaireEntity(
      id,
      studentId,
      status,
      startTime ? new Date(startTime) : new Date(),
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
      totalTimeSeconds ?? null,
      completionPercentage ?? null,
      usedFallback ?? false,
      endTime ? new Date(endTime) : null,
      deletedAt ? new Date(deletedAt) : null,
    );
  }
}
