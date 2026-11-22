import { CustomError } from "../../error/custom-error.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { PasswordAdapter } from "../../adapters/password.adapter.js";
import { TokenAdapter } from "../../adapters/token.adapter.js";
import { LoginUserDto } from "../../dtos/auth/login-user.dto.js";
import { UserEntity } from "../../entities/user.entity.js";
import { inactiveAccountMessage } from "../../policies/account-activation.policy.js";
import { EMAIL_NOT_VERIFIED_MESSAGE } from "./email-verification.config.js";

export interface LoginUserConfig {
  /** EMAIL_VERIFICATION_ENABLED: unverified emails cannot log in (TP2 CP019). */
  emailVerificationRequired?: boolean;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordAdapter: PasswordAdapter,
    private readonly tokenAdapter: TokenAdapter,
    private readonly config: LoginUserConfig = {},
  ) {}

  async execute(
    dto: LoginUserDto,
  ): Promise<{ user: UserEntity; token: string }> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw CustomError.badRequest("Invalid credentials");

    // Verify the password first so a wrong password always yields the same
    // generic error and never reveals that an account is inactive or pending.
    const valid = this.passwordAdapter.compare(dto.password, user.password);
    if (!valid) throw CustomError.badRequest("Invalid credentials");

    // Checked before activation so a pending teacher first confirms the email.
    if (this.config.emailVerificationRequired && !user.emailVerifiedAt) {
      throw CustomError.forbidden(EMAIL_NOT_VERIFIED_MESSAGE);
    }

    if (!user.isActive) {
      throw CustomError.unauthorized(inactiveAccountMessage(user));
    }

    const token = await this.tokenAdapter.generate({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
    });
    if (!token) throw CustomError.internalServer("Error generating token");

    return { user, token };
  }
}
