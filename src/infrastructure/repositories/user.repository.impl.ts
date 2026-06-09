import { prisma } from "../../config/database/index.js";
import {
  UserRepository,
} from "../../domain/repositories/user.repository.js";
import { UserEntity } from "../../domain/entities/user.entity.js";
import { RegisterUserDto } from "../../domain/dtos/auth/register-user.dto.js";
import { UpdateUserDto } from "../../domain/dtos/user/update-user.dto.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { UserListFilters } from "../../domain/interfaces/user/index.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

export class UserRepositoryImpl implements UserRepository {
  async findById(id: number): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { school: { select: { cenEdu: true } } },
    });
    if (!user) return null;
    return UserEntity.fromObject(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { school: { select: { cenEdu: true } } },
    });
    if (!user) return null;
    return UserEntity.fromObject(user);
  }

  async create(dto: RegisterUserDto): Promise<UserEntity> {
    const user = await prisma.user.create({ data: dto });
    return UserEntity.fromObject(user);
  }

  async findAll(
    pagination: PaginationDto,
    filters: UserListFilters = {},
  ): Promise<PaginatedResult<UserEntity>> {
    const where = {
      deletedAt: null,
      ...(filters.roleId !== undefined && { roleId: filters.roleId }),
      ...(filters.schoolId !== undefined && { schoolId: filters.schoolId }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: "asc" },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((row) => UserEntity.fromObject(row)),
      total,
      page,
      limit,
    };
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await prisma.user.update({ where: { id }, data: dto });
    return UserEntity.fromObject(user);
  }

  async softDelete(id: number): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return UserEntity.fromObject(user);
  }

  async setActive(id: number, isActive: boolean): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
    });
    return UserEntity.fromObject(user);
  }
}
