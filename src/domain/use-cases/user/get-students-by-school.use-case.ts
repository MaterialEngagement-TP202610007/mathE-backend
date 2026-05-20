import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { UserEntity } from "../../entities/user.entity.js";

export class GetStudentsBySchoolUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  execute(
    schoolId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<UserEntity>> {
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      throw CustomError.badRequest("Invalid School Id");
    }

    return this.userRepository.findAll(pagination, {
      roleId: ROLES.STUDENT,
      schoolId,
    });
  }
}
