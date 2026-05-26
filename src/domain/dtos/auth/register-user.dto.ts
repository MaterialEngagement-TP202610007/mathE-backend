import { regularExps } from "../../../config/helpers/regular-exp.js";
import { ROLES } from "../../constants/roles.constant.js";

export class RegisterUserDto {
  private constructor(
    public password: string,
    public email: string,
    public name: string,
    public birthDate: Date,
    public roleId: number,
    public phoneNumber: string | null,
    public academicGradeId: number | null,
    public schoolId: number | null,
    public isActive: boolean,
  ) {}

  static create(object: { [key: string]: any }): [string?, RegisterUserDto?] {
    const {
      password,
      email,
      name,
      birthDate,
      roleId,
      phoneNumber,
      academicGradeId,
      schoolId,
    } = object;

    if (!password) return ["Missing Password"];
    if (!email) return ["Missing Email"];
    if (!name) return ["Missing Name"];
    if (!birthDate) return ["Missing Birth Date"];
    if (!roleId) return ["Missing Role Id"];

    if (!regularExps.password.test(password)) return ["Invalid Password"];
    if (!regularExps.email.test(email)) return ["Invalid Email"];

    const parsedBirthDate = new Date(birthDate);
    if (isNaN(parsedBirthDate.getTime())) return ["Invalid Birth Date"];

    if (
      phoneNumber !== undefined &&
      phoneNumber !== null &&
      !regularExps.phone.test(phoneNumber)
    ) {
      return ["Invalid Phone Number"];
    }

    const parsedRoleId = Number(roleId);
    // Students start inactive — require admin activation before they can log in.
    const isActive = parsedRoleId !== ROLES.STUDENT;

    return [
      undefined,
      new RegisterUserDto(
        password,
        email,
        name,
        parsedBirthDate,
        parsedRoleId,
        phoneNumber ?? null,
        academicGradeId !== undefined && academicGradeId !== null
          ? Number(academicGradeId)
          : null,
        schoolId !== undefined && schoolId !== null ? Number(schoolId) : null,
        isActive,
      ),
    ];
  }
}
