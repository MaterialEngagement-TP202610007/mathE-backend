import { regularExps } from "../../../config/helpers/regular-exp.js";

const CODE_FORMAT = /^\d{6}$/;

export class VerifyEmailDto {
  private constructor(
    public readonly email: string,
    public readonly code: string,
  ) {}

  static create(object: { [key: string]: any }): [string?, VerifyEmailDto?] {
    const { email, code } = object;

    if (!email || typeof email !== "string") return ["Missing Email"];
    const normalizedEmail = email.trim().toLowerCase();
    if (!regularExps.email.test(normalizedEmail)) return ["Invalid Email"];

    const normalizedCode = typeof code === "string" ? code.trim() : "";
    if (!CODE_FORMAT.test(normalizedCode)) return ["Invalid verification code format"];

    return [undefined, new VerifyEmailDto(normalizedEmail, normalizedCode)];
  }
}
