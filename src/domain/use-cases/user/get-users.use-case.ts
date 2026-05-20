import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { UserListFilters } from "../../interfaces/user/index.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { UserEntity } from "../../entities/user.entity.js";

export class GetUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  execute(
    pagination: PaginationDto,
    filters?: UserListFilters,
  ): Promise<PaginatedResult<UserEntity>> {
    return this.userRepository.findAll(pagination, filters);
  }
}
