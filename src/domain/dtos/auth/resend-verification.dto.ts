import { regularExps } from "../../../config/helpers/regular-exp.js";

export class ResendVerificationDto {
  private constructor(public readonly email: string) {}

  static create(object: { [key: string]: any }): [string?, ResendVerificationDto?] {
    const { email } = object;

    if (!email || typeof email !== "string") return ["Missing Email"];
    const normalizedEmail = email.trim().toLowerCase();
    if (!regularExps.email.test(normalizedEmail)) return ["Invalid Email"];

    return [undefined, new ResendVerificationDto(normalizedEmail)];
  }
}
