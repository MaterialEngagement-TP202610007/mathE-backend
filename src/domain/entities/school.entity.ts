import { CustomError } from "../error/custom-error.js";

/**
 * One real school. MINEDU publishes one service per level (COD_MOD); services
 * of the same school are merged, so `levels` and `codMods` list all of them.
 */
export class SchoolEntity {
  constructor(
    public id: number,
    public institutionKey: string,
    public cenEdu: string, // name
    public district: string,
    public address: string,
    public businessName: string,
    public levels: string[],
    public codMods: string[],
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  static fromObject(object: { [key: string]: any }): SchoolEntity {
    const {
      id,
      institutionKey,
      cenEdu,
      district,
      address,
      businessName,
      levels,
      codMods,
      createdAt,
      updatedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing School Id");
    if (!cenEdu) throw CustomError.badRequest("Missing School Name");

    return new SchoolEntity(
      id,
      institutionKey ?? "",
      cenEdu,
      district ?? "",
      address ?? "",
      businessName ?? "",
      Array.isArray(levels) ? [...levels] : [],
      Array.isArray(codMods) ? [...codMods] : [],
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
    );
  }
}
