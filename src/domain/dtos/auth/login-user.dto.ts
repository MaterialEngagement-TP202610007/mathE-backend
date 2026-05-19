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
    if (!regularExps.email.test(email)) return ["Invalid Email"];
    if (!regularExps.password.test(password)) return ["Invalid Password"];

    return [undefined, new LoginUserDto(email, password)];
  }
}
