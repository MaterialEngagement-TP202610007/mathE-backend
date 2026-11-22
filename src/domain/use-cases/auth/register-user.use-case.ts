import { CustomError } from "../../error/custom-error.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { SchoolRepository } from "../../repositories/school.repository.js";
import { PasswordAdapter } from "../../adapters/password.adapter.js";
import { RegisterUserDto } from "../../dtos/auth/register-user.dto.js";
import { UserEntity } from "../../entities/user.entity.js";
import { SendEmailVerificationCodeUseCase } from "./send-email-verification-code.use-case.js";

export interface RegisterUserConfig {
  /** Injectable clock for `termsAcceptedAt` — lets tests pin the timestamp. */
  now?: () => Date;
  /**
   * Set when EMAIL_VERIFICATION_ENABLED is on: a code is emailed after the
   * account is created (TP2 CP019). Absent means the previous flow.
   */
  emailVerification?: Pick<SendEmailVerificationCodeUseCase, "sendTo"> | null;
}

export interface RegisterUserResult {
  user: UserEntity;
  /** The user must confirm the email with a code before logging in. */
  emailVerificationRequired: boolean;
  /** False when the email provider failed; the user can ask for a new code. */
  verificationEmailSent: boolean;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordAdapter: PasswordAdapter,
    private readonly schoolRepository: SchoolRepository,
    private readonly config: RegisterUserConfig = {},
  ) {}

  async execute(dto: RegisterUserDto): Promise<RegisterUserResult> {
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

    const user = await this.userRepository.create(dto);

    const emailVerification = this.config.emailVerification;
    if (!emailVerification) {
      return { user, emailVerificationRequired: false, verificationEmailSent: false };
    }

    try {
      await emailVerification.sendTo(user);
      return { user, emailVerificationRequired: true, verificationEmailSent: true };
    } catch (error) {
      // The account exists either way: never lose it because the email failed.
      console.error("Verification email could not be sent:", (error as Error).message);
      return { user, emailVerificationRequired: true, verificationEmailSent: false };
    }
  }

  private now(): Date {
    return (this.config.now ?? (() => new Date()))();
  }
}
