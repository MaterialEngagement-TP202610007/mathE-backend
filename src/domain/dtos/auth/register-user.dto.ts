import { regularExps } from "../../../config/helpers/regular-exp.js";

export class RegisterUserDto {
  constructor(
    public username: string,
    public password: string,
    public email: string,
    public name: string,
    public roleId: number,
  ) {}

  static create(object: { [key: string]: any }): [string?, RegisterUserDto?] {
    const { username, password, email, name, roleId } = object;

    if (!username) return ["Missing Username"];
    if (!password) return ["Missing Password"];
    if (!email) return ["Missing Email"];
    if (!name) return ["Missing Name"];
    if (!roleId) return ["Missing Role Id"];

    if (!regularExps.username.test(username)) return ["Invalid Username"];
    if (!regularExps.password.test(password)) return ["Invalid Password"];
    if (!regularExps.email.test(email)) return ["Invalid Email"];

    return [
      undefined,
      new RegisterUserDto(username, password, email, name, roleId),
    ];
  }
}
