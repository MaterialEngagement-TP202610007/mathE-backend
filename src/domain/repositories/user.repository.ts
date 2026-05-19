import { UserEntity } from "../entities/user.entity.js";
import { RegisterUserDto } from "../dtos/auth/register-user.dto.js";

export abstract class UserRepository {
  abstract findById(id: number): Promise<UserEntity | null>;
  abstract findByEmail(email: string): Promise<UserEntity | null>;
  abstract create(dto: RegisterUserDto): Promise<UserEntity>;
}
