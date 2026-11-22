import { CustomError } from "../../error/custom-error.js";
import { UserEntity } from "../../entities/user.entity.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { EmailVerificationRepository } from "../../repositories/email-verification.repository.js";
import { EmailSenderAdapter } from "../../adapters/email-sender.adapter.js";
import { VerificationCodeAdapter } from "../../adapters/verification-code.adapter.js";
import { ResendVerificationDto } from "../../dtos/auth/resend-verification.dto.js";
import { EmailVerificationConfig } from "./email-verification.config.js";

/**
 * Issues a one-time email verification code (TP2 CP019): only its hash is
 * stored, and a new code replaces the previous one.
 */
export class SendEmailVerificationCodeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly verificationRepository: EmailVerificationRepository,
    private readonly codeAdapter: VerificationCodeAdapter,
    private readonly emailSender: EmailSenderAdapter,
    private readonly config: EmailVerificationConfig,
  ) {}

  /** Resend requested by the user. Silent for unknown or verified emails. */
  async execute(dto: ResendVerificationDto): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user || user.emailVerifiedAt || user.deletedAt) return;

    const pending = await this.verificationRepository.findByUserId(user.id);
    if (pending) {
      const elapsedMs = this.now().getTime() - pending.createdAt.getTime();
      const waitSeconds = Math.ceil(this.config.resendCooldownSeconds - elapsedMs / 1000);
      if (waitSeconds > 0) {
        throw CustomError.tooManyRequests(
          `Please wait ${waitSeconds} seconds before requesting a new code`,
        );
      }
    }

    await this.sendTo(user);
  }

  /** Creates a fresh code for the user and emails it. */
  async sendTo(user: UserEntity): Promise<void> {
    const now = this.now();
    const code = this.codeAdapter.generate();

    await this.verificationRepository.save({
      userId: user.id,
      codeHash: this.codeAdapter.hash(code),
      expiresAt: new Date(now.getTime() + this.config.codeTtlMinutes * 60 * 1000),
      createdAt: now,
    });

    await this.emailSender.sendVerificationCode({
      to: user.email,
      name: user.name,
      code,
      expiresInMinutes: this.config.codeTtlMinutes,
    });
  }

  private now(): Date {
    return (this.config.now ?? (() => new Date()))();
  }
}
