import { CustomError } from "../error/custom-error.js";
import { OptionEntity } from "./option.entity.js";

export class QuestionEntity {
  constructor(
    public id: number,
    public statement: string,
    public contentType: string,
    public vakStyle: string,
    public origin: string,
    public validationStatus: string,
    public generationDate: Date,
    public createdAt: Date,
    public updatedAt: Date,
    public teacherId: number | null,
    public mediaUrl: string | null,
    public rejectionReason: string | null,
    public deletedAt: Date | null,
    public options: OptionEntity[],
  ) {}

  static fromObject(object: { [key: string]: any }): QuestionEntity {
    const {
      id,
      statement,
      contentType,
      vakStyle,
      origin,
      validationStatus,
      generationDate,
      createdAt,
      updatedAt,
      teacherId,
      mediaUrl,
      rejectionReason,
      deletedAt,
      options,
    } = object;

    if (!id) throw CustomError.badRequest("Missing Question Id");
    if (!statement) throw CustomError.badRequest("Missing Statement");
    if (!vakStyle) throw CustomError.badRequest("Missing Vak Style");

    return new QuestionEntity(
      id,
      statement,
      contentType,
      vakStyle,
      origin,
      validationStatus,
      generationDate ? new Date(generationDate) : new Date(),
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
      teacherId ?? null,
      mediaUrl ?? null,
      rejectionReason ?? null,
      deletedAt ? new Date(deletedAt) : null,
      Array.isArray(options)
        ? options.map((opt) => OptionEntity.fromObject(opt))
        : [],
    );
  }
}
