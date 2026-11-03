import { regularExps } from "../../../config/helpers/regular-exp.js";

export class LoginUserDto {
  private constructor(
    public email: string,
    public password: string,
  ) {}

  static create(object: { [key: string]: any }): [string?, LoginUserDto?] {
    const { email, password } = object;

    if (!email) return ["Missing Email"];
    if (!password) return ["Missing Password"];
    // Same message as a wrong password, so a failed login never reveals which field failed.
    if (typeof email !== "string" || typeof password !== "string") return ["Invalid credentials"];
    if (!regularExps.email.test(email) || !regularExps.password.test(password)) {
      return ["Invalid credentials"];
    }

    return [undefined, new LoginUserDto(email, password)];
  }
}
