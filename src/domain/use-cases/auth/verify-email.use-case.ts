import { CustomError } from "../../error/custom-error.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { EmailVerificationRepository } from "../../repositories/email-verification.repository.js";
import { VerificationCodeAdapter } from "../../adapters/verification-code.adapter.js";
import { VerifyEmailDto } from "../../dtos/auth/verify-email.dto.js";
import { EmailVerificationConfig, INVALID_CODE_MESSAGE } from "./email-verification.config.js";

/** Confirms the user owns the email by checking the one-time code (TP2 CP019). */
export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationRepository: EmailVerificationRepository,
    private readonly codeAdapter: VerificationCodeAdapter,
    private readonly config: EmailVerificationConfig,
  ) {}

  async execute(dto: VerifyEmailDto): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw CustomError.badRequest(INVALID_CODE_MESSAGE);
    if (user.emailVerifiedAt) return;

    const pending = await this.verificationRepository.findByUserId(user.id);
    const now = this.now();
    if (!pending || pending.expiresAt.getTime() <= now.getTime()) {
      throw CustomError.badRequest(INVALID_CODE_MESSAGE);
    }

    if (pending.attempts >= this.config.maxAttempts) {
      throw CustomError.tooManyRequests(
        "Too many failed attempts. Request a new verification code",
      );
    }

    if (!this.codeAdapter.matches(dto.code, pending.codeHash)) {
      await this.verificationRepository.incrementAttempts(user.id);
      throw CustomError.badRequest(INVALID_CODE_MESSAGE);
    }

    await this.verificationRepository.markVerified(user.id, now);
  }

  private now(): Date {
    return (this.config.now ?? (() => new Date()))();
  }
}
