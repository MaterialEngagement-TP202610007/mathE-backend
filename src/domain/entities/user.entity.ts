import { regularExps } from "../../config/helpers/regular-exp.js";
import { CustomError } from "../error/custom-error.js";

export class UserEntity {
  constructor(
    public id: number,
    public username: string,
    public password: string,
    public email: string,
    public name: string,
    public status: boolean,
    public createdAt: Date,
    public roleId: number | null,
  ) {}

  static fromObject(object: { [key: string]: any }): UserEntity {
    const { id, username, password, email, name, status, createdAt, roleId } =
      object;

    if (!id) throw CustomError.badRequest("Missing Id");
    if (typeof status !== "boolean") {
      throw CustomError.badRequest("Status must be a boolean");
    }
    if (!name) throw CustomError.badRequest("Missing Name");
    if (!username) throw CustomError.badRequest("Missing Username");
    if (!email) throw CustomError.badRequest("Missing Email");
    if (!regularExps.email.test(email)) {
      throw CustomError.badRequest("Invalid Email");
    }
    if (!password) throw CustomError.badRequest("Missing Password");

    return new UserEntity(
      id,
      username,
      password,
      email,
      name,
      status,
      createdAt,
      roleId ?? null,
    );
  }
}
