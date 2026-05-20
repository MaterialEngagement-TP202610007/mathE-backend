import { CustomError } from "../../error/custom-error.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { PasswordAdapter } from "../../adapters/password.adapter.js";
import { RegisterUserDto } from "../../dtos/auth/register-user.dto.js";
import { UserEntity } from "../../entities/user.entity.js";

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordAdapter: PasswordAdapter,
  ) {}

  async execute(dto: RegisterUserDto): Promise<UserEntity> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) throw CustomError.badRequest("Email already registered");

    const hashedPassword = this.passwordAdapter.hash(dto.password);

    dto.password = hashedPassword;

    return this.userRepository.create(dto);
  }
}
