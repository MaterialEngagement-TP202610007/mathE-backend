import { regularExps } from "../../../config/helpers/regular-exp.js";
import { ROLES } from "../../constants/roles.constant.js";
import { isActiveOnRegistration } from "../../policies/account-activation.policy.js";

const PUBLIC_REGISTRATION_ROLES: number[] = [ROLES.STUDENT, ROLES.TEACHER];

/** Letters (including accented ones), spaces, hyphens, apostrophes and periods. */
const NAME_CHARS = /^[\p{L}\s'.-]+$/u;
/** A name word must have at least two letters ("Ana", "de"); initials do not count. */
const NAME_WORD = /^\p{L}[\p{L}'.-]*\p{L}$/u;

/** Accepted ages per role (inclusive), so made-up birth dates cannot register. */
const AGE_RANGE_BY_ROLE: Record<number, { min: number; max: number; label: string }> = {
  [ROLES.STUDENT]: { min: 5, max: 20, label: "student" },
  [ROLES.TEACHER]: { min: 18, max: 100, label: "teacher" },
};

/** "  Ana   Pérez " → "Ana Pérez"; undefined when it is not a first and last name. */
function normalizeName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length > 100 || !NAME_CHARS.test(name)) return undefined;
  const fullWords = name.split(" ").filter((word) => NAME_WORD.test(word));
  return fullWords.length >= 2 ? name : undefined;
}

/** Whole years between the birth date and `now`, both read as UTC calendar dates. */
function ageOn(birthDate: Date, now: Date): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() &&
      now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

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
    /** Set by the register use case at the moment of acceptance; null until then. */
    public termsAcceptedAt: Date | null,
  ) {}

  static create(
    object: { [key: string]: any },
    now: Date = new Date(),
  ): [string?, RegisterUserDto?] {
    const {
      password,
      email,
      name,
      birthDate,
      roleId,
      phoneNumber,
      academicGradeId,
      schoolId,
      acceptTerms,
    } = object;

    if (!password) return ["Missing Password"];
    if (!email) return ["Missing Email"];
    if (!name) return ["Missing Name"];
    if (!birthDate) return ["Missing Birth Date"];
    if (!roleId) return ["Missing Role Id"];

    // Explicit consent (HU-02/HU-09): only a literal boolean true counts.
    if (acceptTerms !== true) {
      return ["Terms and privacy policy must be accepted"];
    }

    if (!regularExps.password.test(password)) return ["Invalid Password"];
    if (!regularExps.email.test(email)) return ["Invalid Email"];

    const normalizedName = normalizeName(name);
    if (!normalizedName) return ["Invalid Name"];

    const parsedBirthDate = new Date(birthDate);
    if (isNaN(parsedBirthDate.getTime()) || parsedBirthDate.getTime() > now.getTime()) {
      return ["Invalid Birth Date"];
    }

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

    const ageRange = AGE_RANGE_BY_ROLE[parsedRoleId];
    const age = ageOn(parsedBirthDate, now);
    if (ageRange && (age < ageRange.min || age > ageRange.max)) {
      return [
        `Birth date out of range for a ${ageRange.label} (${ageRange.min} to ${ageRange.max} years old)`,
      ];
    }
    // Students are active immediately; teachers wait for administrator approval.
    const isActive = isActiveOnRegistration(parsedRoleId);

    return [
      undefined,
      new RegisterUserDto(
        password,
        email,
        normalizedName,
        parsedBirthDate,
        parsedRoleId,
        phoneNumber ?? null,
        academicGradeId !== undefined && academicGradeId !== null
          ? Number(academicGradeId)
          : null,
        parsedSchoolId,
        isActive,
        null,
      ),
    ];
  }
}
