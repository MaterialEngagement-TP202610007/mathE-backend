import { CustomError } from "../error/custom-error.js";

export class SchoolEntity {
  constructor(
    public id: number,
    public codMod: string,
    public cenEdu: string, // name
    public level: string,
    public address: string,
    public district: string,
    public businessName: string,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  static fromObject(object: { [key: string]: any }): SchoolEntity {
    const {
      id,
      codMod,
      cenEdu,
      level,
      address,
      district,
      businessName,
      createdAt,
      updatedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing School Id");
    if (!cenEdu) throw CustomError.badRequest("Missing School Name");

    return new SchoolEntity(
      id,
      codMod ?? "",
      cenEdu,
      level ?? "",
      address ?? "",
      district ?? "",
      businessName ?? "",
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
    );
  }
}
