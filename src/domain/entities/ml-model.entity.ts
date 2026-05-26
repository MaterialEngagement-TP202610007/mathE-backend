import { CustomError } from "../error/custom-error.js";

export class MLModelEntity {
  constructor(
    public id: number,
    public version: string,
    public fileUrl: string,
    public algorithm: string,
    public isActive: boolean,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  static fromObject(object: { [key: string]: any }): MLModelEntity {
    const { id, version, fileUrl, algorithm, isActive, createdAt, updatedAt } =
      object;

    if (!id) throw CustomError.badRequest("Missing MLModel Id");
    if (!version) throw CustomError.badRequest("Missing MLModel version");

    return new MLModelEntity(
      id,
      version,
      fileUrl ?? "",
      algorithm ?? "",
      isActive ?? false,
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
    );
  }
}
