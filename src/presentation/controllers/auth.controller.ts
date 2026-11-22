import { CookieOptions, NextFunction, Request, Response } from "express";
import { LoginUserDto } from "../../domain/dtos/auth/login-user.dto.js";
import { RegisterUserDto } from "../../domain/dtos/auth/register-user.dto.js";
import { LoginUserUseCase } from "../../domain/use-cases/auth/login-user.use-case.js";
import { RegisterUserUseCase } from "../../domain/use-cases/auth/register-user.use-case.js";
import { GetCurrentUserUseCase } from "../../domain/use-cases/auth/get-current-user.use-case.js";
import { VerifyEmailDto } from "../../domain/dtos/auth/verify-email.dto.js";
import { ResendVerificationDto } from "../../domain/dtos/auth/resend-verification.dto.js";
import { VerifyEmailUseCase } from "../../domain/use-cases/auth/verify-email.use-case.js";
import { SendEmailVerificationCodeUseCase } from "../../domain/use-cases/auth/send-email-verification-code.use-case.js";
import { toAuthUser } from "../mappers/user.mapper.js";

const AUTH_COOKIE = "auth_token";

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

export interface AuthControllerConfig {
  /** Cookie lifetime — must match the JWT expiry (SESSION_TTL_HOURS). */
  sessionTtlMs: number;
}

/** Email verification use cases; absent when EMAIL_VERIFICATION_ENABLED is off. */
export interface EmailVerificationUseCases {
  verifyEmail: VerifyEmailUseCase;
  sendCode: SendEmailVerificationCodeUseCase;
}

export class AuthController {
  constructor(
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly config: AuthControllerConfig,
    private readonly emailVerification: EmailVerificationUseCases | null = null,
  ) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    const [error, dto] = LoginUserDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const { user, token } = await this.loginUserUseCase.execute(dto!);

      res.cookie(AUTH_COOKIE, token, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: this.config.sessionTtlMs,
      });

      res.json({ user: toAuthUser(user), token });
    } catch (err) {
      next(err);
    }
  };

  logout = async (_req: Request, res: Response) => {
    res.clearCookie(AUTH_COOKIE, AUTH_COOKIE_OPTIONS);
    res.json({ ok: true });
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.getCurrentUserUseCase.execute(req.user!.id);
      res.json({ user: toAuthUser(user) });
    } catch (err) {
      next(err);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    const [error, dto] = RegisterUserDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const { user, emailVerificationRequired, verificationEmailSent } =
        await this.registerUserUseCase.execute(dto!);
      const requiresApproval = !user.isActive;
      res.status(201).json({
        message: requiresApproval
          ? "User created successfully. Your teacher account is pending administrator approval."
          : "User created successfully",
        requiresApproval,
        emailVerificationRequired,
        verificationEmailSent,
      });
    } catch (err) {
      next(err);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    if (!this.emailVerification) {
      return res.status(404).json({ error: "Email verification is disabled" });
    }
    const [error, dto] = VerifyEmailDto.create(req.body ?? {});
    if (error) return res.status(400).json({ error });

    try {
      await this.emailVerification.verifyEmail.execute(dto!);
      res.json({ message: "Email verified" });
    } catch (err) {
      next(err);
    }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction) => {
    if (!this.emailVerification) {
      return res.status(404).json({ error: "Email verification is disabled" });
    }
    const [error, dto] = ResendVerificationDto.create(req.body ?? {});
    if (error) return res.status(400).json({ error });

    try {
      await this.emailVerification.sendCode.execute(dto!);
      // Same answer whether or not the account exists (no account enumeration).
      res.json({ message: "If the account exists and is not verified, a new code was sent" });
    } catch (err) {
      next(err);
    }
  };
}
