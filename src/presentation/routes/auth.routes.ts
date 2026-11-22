import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  loginRateLimiter,
  registerRateLimiter,
  resendVerificationRateLimiter,
  verifyEmailRateLimiter,
} from "../middlewares/rate-limit.middleware.js";
import { LoginUserUseCase } from "../../domain/use-cases/auth/login-user.use-case.js";
import { RegisterUserUseCase } from "../../domain/use-cases/auth/register-user.use-case.js";
import { GetCurrentUserUseCase } from "../../domain/use-cases/auth/get-current-user.use-case.js";
import { UserRepositoryImpl } from "../../infrastructure/repositories/user.repository.impl.js";
import { SchoolRepositoryImpl } from "../../infrastructure/repositories/school.repository.impl.js";
import { BcryptAdapter } from "../../infrastructure/adapters/bcrypt.adapter.impl.js";
import { JwtAdapter } from "../../infrastructure/adapters/jwt.adapter.impl.js";
import { SendEmailVerificationCodeUseCase } from "../../domain/use-cases/auth/send-email-verification-code.use-case.js";
import { VerifyEmailUseCase } from "../../domain/use-cases/auth/verify-email.use-case.js";
import { EmailVerificationConfig } from "../../domain/use-cases/auth/email-verification.config.js";
import { EmailVerificationRepositoryImpl } from "../../infrastructure/repositories/email-verification.repository.impl.js";
import { CryptoVerificationCodeAdapterImpl } from "../../infrastructure/adapters/crypto-verification-code.adapter.impl.js";
import { BrevoEmailSenderAdapterImpl } from "../../infrastructure/adapters/brevo-email-sender.adapter.impl.js";
import { envs } from "../../config/envs.js";

export class AuthRoutes {
  static get routes(): Router {
    const router = Router();

    const userRepository = new UserRepositoryImpl();
    const passwordAdapter = new BcryptAdapter();
    const tokenAdapter = new JwtAdapter();

    // TP2 CP019: email verification is wired only when the flag is on, so the
    // flag off keeps the previous registration and login flow untouched.
    const emailVerification = envs.EMAIL_VERIFICATION_ENABLED
      ? AuthRoutes.emailVerificationUseCases(userRepository)
      : null;

    const controller = new AuthController(
      new LoginUserUseCase(userRepository, passwordAdapter, tokenAdapter, {
        emailVerificationRequired: envs.EMAIL_VERIFICATION_ENABLED,
      }),
      new RegisterUserUseCase(
        userRepository,
        passwordAdapter,
        new SchoolRepositoryImpl(),
        { emailVerification: emailVerification?.sendCode ?? null },
      ),
      new GetCurrentUserUseCase(userRepository),
      { sessionTtlMs: envs.SESSION_TTL_HOURS * 60 * 60 * 1000 },
      emailVerification,
    );

    /**
     * @openapi
     * /api/auth/login:
     *   post:
     *     tags: [Auth]
     *     summary: Authenticate a user and set the auth_token HttpOnly cookie
     *     description: >
     *       On success sets an HttpOnly, Secure, SameSite=None cookie named
     *       auth_token (Path=/). The cookie Max-Age and the JWT expiry both equal
     *       SESSION_TTL_HOURS (default 24 h). Rate limited: 10 failed attempts per
     *       email every 15 minutes (429).
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [email, password]
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               password:
     *                 type: string
     *     responses:
     *       200:
     *         description: Authenticated — sets auth_token cookie, returns { user }
     *         headers:
     *           Set-Cookie:
     *             description: auth_token=<jwt>; HttpOnly; Secure; SameSite=None; Max-Age=<SESSION_TTL_HOURS * 3600>; Path=/
     *             schema: { type: string }
     *       400:
     *         description: >
     *           Validation error, or "Invalid credentials" for an unknown email or a wrong
     *           password (also for inactive accounts, so their state is never revealed)
     *       401:
     *         description: >
     *           Inactive account, returned only after the password is verified. Pending teachers get "Account is inactive. Your teacher
     *           account is pending administrator approval."; any other inactive account gets
     *           "Account is inactive. Contact an administrator." (both start with "Account is inactive").
     *       403:
     *         description: >
     *           Only with EMAIL_VERIFICATION_ENABLED, after the password is verified: "Email not
     *           verified. Enter the code sent to your email" (POST /api/auth/verify-email).
     *       429:
     *         description: Too many login attempts — { error }
     */
    router.post("/login", loginRateLimiter, controller.login);

    /**
     * @openapi
     * /api/auth/logout:
     *   post:
     *     tags: [Auth]
     *     summary: Log out — clears the auth_token cookie
     *     responses:
     *       200:
     *         description: Logged out
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 ok: { type: boolean, example: true }
     */
    router.post("/logout", controller.logout);

    /**
     * @openapi
     * /api/auth/me:
     *   get:
     *     tags: [Auth]
     *     summary: Validate the current session and return the authenticated user
     *     description: >
     *       Reads the auth_token cookie, verifies the JWT, and re-checks that the
     *       user still exists and is active. Use on app load to know if the user
     *       is still logged in.
     *     security: [{ cookieAuth: [] }]
     *     responses:
     *       200:
     *         description: Session valid — returns { user }
     *       401:
     *         description: No/invalid cookie, or account no longer valid/active
     */
    router.get("/me", authMiddleware, controller.me);

    /**
     * @openapi
     * /api/auth/register:
     *   post:
     *     tags: [Auth]
     *     summary: Register a new user
     *     description: >
     *       Creates a new student or teacher account. roleId must be the student or
     *       teacher role id (admin cannot self-register). Students are active immediately
     *       and can log in right away; teachers start inactive until an admin approves them
     *       (PATCH /api/users/{id}/activate). Rate limited: 10 attempts per email every 15 minutes.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [password, email, name, birthDate, roleId, schoolId, acceptTerms]
     *             properties:
     *               password:
     *                 type: string
     *               email:
     *                 type: string
     *                 format: email
     *               name:
     *                 type: string
     *                 description: >
     *                   First name and last name: at least two words of two or more letters,
     *                   letters, spaces, hyphens, apostrophes and periods only. Extra spaces are removed.
     *               birthDate:
     *                 type: string
     *                 format: date
     *                 description: >
     *                   Not in the future. Students must be 5 to 20 years old and teachers
     *                   18 to 100 years old.
     *               roleId:
     *                 type: integer
     *               phoneNumber:
     *                 type: string
     *                 nullable: true
     *               schoolId:
     *                 type: integer
     *                 minimum: 1
     *                 description: Required for students and teachers. Must be an existing school (GET /api/schools).
     *               academicGradeId:
     *                 type: integer
     *                 nullable: true
     *               acceptTerms:
     *                 type: boolean
     *                 enum: [true]
     *                 description: >
     *                   Must be exactly true (terms and privacy policy accepted). The server
     *                   stores the acceptance time as the user's termsAcceptedAt.
     *     responses:
     *       201:
     *         description: >
     *           Student — { message: "User created successfully", requiresApproval: false }.
     *           Teacher — { message: "User created successfully. Your teacher account is pending
     *           administrator approval.", requiresApproval: true }. Both also carry
     *           emailVerificationRequired (EMAIL_VERIFICATION_ENABLED) and verificationEmailSent
     *           (false when the email provider failed: use POST /api/auth/verify-email/resend).
     *       400:
     *         description: >
     *           Validation error (including "Invalid Name", "Invalid Birth Date",
     *           "Birth date out of range for a student (5 to 20 years old)",
     *           "Birth date out of range for a teacher (18 to 100 years old)",
     *           "Invalid Role Id", "Missing School Id", "Invalid School Id", "School not found",
     *           "Terms and privacy policy must be accepted")
     *       429:
     *         description: Too many registration attempts — { error }
     */
    router.post("/register", registerRateLimiter, controller.register);

    /**
     * @openapi
     * /api/auth/verify-email:
     *   post:
     *     tags: [Auth]
     *     summary: Confirm the email with the 6-digit code sent at registration
     *     description: >
     *       Only when EMAIL_VERIFICATION_ENABLED is on (404 otherwise). A code lasts
     *       EMAIL_CODE_TTL_MINUTES (default 15) and allows 5 wrong attempts. Verifying an
     *       already verified email succeeds. Rate limited: 10 failed attempts per email
     *       every 15 minutes.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [email, code]
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               code:
     *                 type: string
     *                 pattern: "^[0-9]{6}$"
     *     responses:
     *       200:
     *         description: '{ message: "Email verified" }'
     *       400:
     *         description: >
     *           "Invalid verification code format", or "Invalid or expired verification code"
     *           (also for unknown emails)
     *       404:
     *         description: Email verification is disabled
     *       429:
     *         description: >
     *           "Too many failed attempts. Request a new verification code", or the rate limit
     */
    router.post("/verify-email", verifyEmailRateLimiter, controller.verifyEmail);

    /**
     * @openapi
     * /api/auth/verify-email/resend:
     *   post:
     *     tags: [Auth]
     *     summary: Send a new verification code (replaces the previous one)
     *     description: >
     *       Only when EMAIL_VERIFICATION_ENABLED is on (404 otherwise). Answers the same
     *       message whether or not the account exists. One code per minute per account;
     *       rate limited to 5 requests per email every 15 minutes.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [email]
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *     responses:
     *       200:
     *         description: '{ message: "If the account exists and is not verified, a new code was sent" }'
     *       404:
     *         description: Email verification is disabled
     *       429:
     *         description: '"Please wait N seconds before requesting a new code", or the rate limit'
     *       502:
     *         description: The email provider rejected the message
     */
    router.post(
      "/verify-email/resend",
      resendVerificationRateLimiter,
      controller.resendVerification,
    );

    return router;
  }

  private static emailVerificationUseCases(userRepository: UserRepositoryImpl) {
    const config: EmailVerificationConfig = {
      codeTtlMinutes: envs.EMAIL_CODE_TTL_MINUTES,
      maxAttempts: 5,
      resendCooldownSeconds: 60,
    };
    const verificationRepository = new EmailVerificationRepositoryImpl();
    const codeAdapter = new CryptoVerificationCodeAdapterImpl(envs.JWT_SEED);

    return {
      sendCode: new SendEmailVerificationCodeUseCase(
        userRepository,
        verificationRepository,
        codeAdapter,
        new BrevoEmailSenderAdapterImpl(),
        config,
      ),
      verifyEmail: new VerifyEmailUseCase(
        userRepository,
        verificationRepository,
        codeAdapter,
        config,
      ),
    };
  }
}
