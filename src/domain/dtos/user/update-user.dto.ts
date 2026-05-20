import { regularExps } from "../../../config/helpers/regular-exp.js";

/**
 * Partial update for a user's profile. All fields optional, but anything
 * supplied is validated. Identity-related fields (email, password, roleId)
 * are intentionally not editable through this DTO — they need dedicated flows.
 */
export class UpdateUserDto {
  private constructor(
    public readonly name?: string,
    public readonly birthDate?: Date,
    public readonly phoneNumber?: string | null,
    public readonly academicGradeId?: number | null,
    public readonly schoolId?: number | null,
  ) {}

  static create(object: { [key: string]: any }): [string?, UpdateUserDto?] {
    const { name, birthDate, phoneNumber, academicGradeId, schoolId } = object;

    let parsedBirthDate: Date | undefined;
    if (birthDate !== undefined) {
      parsedBirthDate = new Date(birthDate);
      if (isNaN(parsedBirthDate.getTime())) return ["Invalid Birth Date"];
    }

    if (
      phoneNumber !== undefined &&
      phoneNumber !== null &&
      !regularExps.phone.test(phoneNumber)
    ) {
      return ["Invalid Phone Number"];
    }

    const hasAnyField =
      name !== undefined ||
      birthDate !== undefined ||
      phoneNumber !== undefined ||
      academicGradeId !== undefined ||
      schoolId !== undefined;

    if (!hasAnyField) return ["No fields to update"];

    return [
      undefined,
      new UpdateUserDto(
        name,
        parsedBirthDate,
        phoneNumber,
        academicGradeId !== undefined && academicGradeId !== null
          ? Number(academicGradeId)
          : academicGradeId,
        schoolId !== undefined && schoolId !== null
          ? Number(schoolId)
          : schoolId,
      ),
    ];
  }
}
