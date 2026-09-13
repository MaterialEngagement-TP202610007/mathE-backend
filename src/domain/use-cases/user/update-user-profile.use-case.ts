import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import { UpdateUserDto } from "../../dtos/user/update-user.dto.js";
import { UserEntity } from "../../entities/user.entity.js";
import { SchoolRepository } from "../../repositories/school.repository.js";
import { UserRepository } from "../../repositories/user.repository.js";

const SCHOOL_REQUIRED_ROLES: ReadonlyArray<number> = [
  ROLES.STUDENT,
  ROLES.TEACHER,
];

export class UpdateUserProfileUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
  ) {}

  async execute(id: number, dto: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound("User not found");

    if (
      dto.schoolId === null &&
      existing.roleId !== null &&
      SCHOOL_REQUIRED_ROLES.includes(existing.roleId)
    ) {
      throw CustomError.badRequest(
        "Students and teachers must belong to a school",
      );
    }

    if (typeof dto.schoolId === "number") {
      const school = await this.schoolRepository.findById(dto.schoolId);
      if (!school) throw CustomError.badRequest("School not found");
    }

    return this.userRepository.update(id, dto);
  }
}
