import { regularExps } from "../../config/helpers/regular-exp.js";
import { CustomError } from "../error/custom-error.js";

export class UserEntity {
  constructor(
    public id: number,
    public password: string,
    public email: string,
    public name: string,
    public birthDate: Date,
    public createdAt: Date,
    public updatedAt: Date,
    public phoneNumber: string | null,
    public schoolName: string | null,
    public roleId: number | null,
    public academicGradeId: number | null,
    public deletedAt: Date | null,
  ) {}

  static fromObject(object: { [key: string]: any }): UserEntity {
    const {
      id,
      password,
      email,
      name,
      birthDate,
      createdAt,
      updatedAt,
      phoneNumber,
      schoolName,
      roleId,
      academicGradeId,
      deletedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing Id");
    if (!name) throw CustomError.badRequest("Missing Name");
    if (!email) throw CustomError.badRequest("Missing Email");
    if (!regularExps.email.test(email)) {
      throw CustomError.badRequest("Invalid Email");
    }
    if (!password) throw CustomError.badRequest("Missing Password");
    if (!birthDate) throw CustomError.badRequest("Missing Birth Date");

    return new UserEntity(
      id,
      password,
      email,
      name,
      new Date(birthDate),
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
      phoneNumber ?? null,
      schoolName ?? null,
      roleId ?? null,
      academicGradeId ?? null,
      deletedAt ? new Date(deletedAt) : null,
    );
  }
}
