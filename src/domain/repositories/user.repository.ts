import { UserEntity } from "../entities/user.entity.js";
import { RegisterUserDto } from "../dtos/auth/register-user.dto.js";
import { UpdateUserDto } from "../dtos/user/update-user.dto.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { UserListFilters } from "../interfaces/user/index.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

export abstract class UserRepository {
  abstract findById(id: number): Promise<UserEntity | null>;
  abstract findByEmail(email: string): Promise<UserEntity | null>;
  abstract create(dto: RegisterUserDto): Promise<UserEntity>;

  abstract findAll(
    pagination: PaginationDto,
    filters?: UserListFilters,
  ): Promise<PaginatedResult<UserEntity>>;

  abstract update(id: number, dto: UpdateUserDto): Promise<UserEntity>;
  abstract softDelete(id: number): Promise<UserEntity>;
  abstract setActive(id: number, isActive: boolean): Promise<UserEntity>;
}
