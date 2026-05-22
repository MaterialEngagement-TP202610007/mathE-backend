import { CustomError } from "../error/custom-error.js";

export class OptionEntity {
  constructor(
    public id: number,
    public questionId: number,
    public text: string,
    public vakValue: string,
    public createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  static fromObject(object: { [key: string]: any }): OptionEntity {
    const { id, questionId, text, vakValue, createdAt, updatedAt, deletedAt } =
      object;

    if (!id) throw CustomError.badRequest("Missing Option Id");
    if (!questionId) throw CustomError.badRequest("Missing Question Id");
    if (!text) throw CustomError.badRequest("Missing Option Text");
    if (!vakValue) throw CustomError.badRequest("Missing Vak Value");

    return new OptionEntity(
      id,
      questionId,
      text,
      vakValue,
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
      deletedAt ? new Date(deletedAt) : null,
    );
  }
}
