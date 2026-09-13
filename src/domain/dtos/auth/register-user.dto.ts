import { regularExps } from "../../../config/helpers/regular-exp.js";
import { ROLES } from "../../constants/roles.constant.js";
import { isActiveOnRegistration } from "../../policies/account-activation.policy.js";

const PUBLIC_REGISTRATION_ROLES: number[] = [ROLES.STUDENT, ROLES.TEACHER];

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
    // Public registration can only create students or teachers — never admins.
    if (!PUBLIC_REGISTRATION_ROLES.includes(parsedRoleId)) {
      return ["Invalid Role Id"];
    }

    // Students and teachers always belong to a school (per-school question bank).
    if (schoolId === undefined || schoolId === null || schoolId === "") {
      return ["Missing School Id"];
    }
    const parsedSchoolId = Number(schoolId);
    if (!Number.isInteger(parsedSchoolId) || parsedSchoolId <= 0) {
      return ["Invalid School Id"];
    }
    // Students are active immediately; teachers wait for administrator approval.
    const isActive = isActiveOnRegistration(parsedRoleId);

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
        parsedSchoolId,
        isActive,
      ),
    ];
  }
}
