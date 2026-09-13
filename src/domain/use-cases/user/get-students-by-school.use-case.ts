import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import { ListUsersDto } from "../../dtos/user/list-users.dto.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { UserEntity } from "../../entities/user.entity.js";

export class GetStudentsBySchoolUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(
    schoolId: number,
    pagination: PaginationDto,
    extraFilters: ListUsersDto | undefined,
    requester: Requester,
  ): Promise<PaginatedResult<UserEntity>> {
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      throw CustomError.badRequest("Invalid School Id");
    }
    await this.schoolAccessPolicy.assertCanAccessSchool(requester, schoolId);

    return this.userRepository.findAll(pagination, {
      ...extraFilters,
      roleId: ROLES.STUDENT,
      schoolId,
    });
  }
}
