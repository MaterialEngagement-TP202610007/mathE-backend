import { prisma } from "../database/index.js";
import { UserRepository } from "../../domain/repositories/user.repository.js";
import { UserEntity } from "../../domain/entities/user.entity.js";
import { RegisterUserDto } from "../../domain/dtos/auth/register-user.dto.js";

export class UserRepositoryImpl implements UserRepository {
  async findById(id: number): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return UserEntity.fromObject(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return UserEntity.fromObject(user);
  }

  async create(dto: RegisterUserDto): Promise<UserEntity> {
    const user = await prisma.user.create({
      data: dto,
    });
    return UserEntity.fromObject(user);
  }
}
