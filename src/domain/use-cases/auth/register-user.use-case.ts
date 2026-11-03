import { CustomError } from "../../error/custom-error.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { SchoolRepository } from "../../repositories/school.repository.js";
import { PasswordAdapter } from "../../adapters/password.adapter.js";
import { RegisterUserDto } from "../../dtos/auth/register-user.dto.js";
import { UserEntity } from "../../entities/user.entity.js";

export interface RegisterUserConfig {
  /** Injectable clock for `termsAcceptedAt` — lets tests pin the timestamp. */
  now?: () => Date;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordAdapter: PasswordAdapter,
    private readonly schoolRepository: SchoolRepository,
    private readonly config: RegisterUserConfig = {},
  ) {}

  async execute(dto: RegisterUserDto): Promise<UserEntity> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) throw CustomError.badRequest("Email already registered");

    if (dto.schoolId !== null) {
      const school = await this.schoolRepository.findById(dto.schoolId);
      if (!school) throw CustomError.badRequest("School not found");
    }

    const hashedPassword = this.passwordAdapter.hash(dto.password);

    dto.password = hashedPassword;
    // The DTO only exists when acceptTerms === true, so acceptance happens now.
    dto.termsAcceptedAt = this.now();

    return this.userRepository.create(dto);
  }

  private now(): Date {
    return (this.config.now ?? (() => new Date()))();
  }
}
