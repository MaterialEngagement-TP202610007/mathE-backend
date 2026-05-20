import { ROLES } from "../../constants/roles.constant.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { UserEntity } from "../../entities/user.entity.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { UserRepository } from "../../repositories/user.repository.js";

export class GetStudentsUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  execute(pagination: PaginationDto): Promise<PaginatedResult<UserEntity>> {
    return this.userRepository.findAll(pagination, { roleId: ROLES.STUDENT });
  }
}
