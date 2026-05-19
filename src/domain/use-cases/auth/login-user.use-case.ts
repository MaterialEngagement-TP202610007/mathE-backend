import { CustomError } from "../../error/custom-error.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { PasswordAdapter } from "../../adapters/password.adapter.js";
import { TokenAdapter } from "../../adapters/token.adapter.js";
import { LoginUserDto } from "../../dtos/auth/login-user.dto.js";
import { UserEntity } from "../../entities/user.entity.js";

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordAdapter: PasswordAdapter,
    private readonly tokenAdapter: TokenAdapter,
  ) {}

  async execute(
    dto: LoginUserDto,
  ): Promise<{ user: UserEntity; token: string }> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw CustomError.badRequest("Invalid credentials");

    const valid = this.passwordAdapter.compare(dto.password, user.password);
    if (!valid) throw CustomError.badRequest("Invalid credentials");

    const token = await this.tokenAdapter.generate({
      id: user.id,
      email: user.email,
    });
    if (!token) throw CustomError.internalServer("Error generating token");

    return { user, token };
  }
}
