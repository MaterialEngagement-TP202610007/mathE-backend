import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { LoginUserUseCase } from "../../domain/use-cases/auth/login-user.use-case.js";
import { RegisterUserUseCase } from "../../domain/use-cases/auth/register-user.use-case.js";
import { GetCurrentUserUseCase } from "../../domain/use-cases/auth/get-current-user.use-case.js";
import { UserRepositoryImpl } from "../../infrastructure/repositories/user.repository.impl.js";
import { BcryptAdapter } from "../../infrastructure/adapters/bcrypt.adapter.impl.js";
import { JwtAdapter } from "../../infrastructure/adapters/jwt.adapter.impl.js";

export class AuthRoutes {
  static get routes(): Router {
    const router = Router();

    const userRepository = new UserRepositoryImpl();
    const passwordAdapter = new BcryptAdapter();
    const tokenAdapter = new JwtAdapter();

    const controller = new AuthController(
      new LoginUserUseCase(userRepository, passwordAdapter, tokenAdapter),
      new RegisterUserUseCase(userRepository, passwordAdapter),
      new GetCurrentUserUseCase(userRepository),
    );

    /**
     * @openapi
     * /api/auth/login:
     *   post:
     *     tags: [Auth]
     *     summary: Authenticate a user and set the auth_token HttpOnly cookie
     *     description: >
     *       On success sets an HttpOnly, Secure, SameSite=Strict cookie named
     *       auth_token (Max-Age 7 days, Path=/). The JWT is no longer returned
     *       in the body — only the public user is.
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
     *             description: auth_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
     *             schema: { type: string }
     *       400:
     *         description: Validation error
     *       401:
     *         description: Invalid credentials or inactive account
     */
    router.post("/login", controller.login);

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
     *     description: Creates a new user account. The account is active by default (isActive=true).
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [password, email, name, birthDate, roleId]
     *             properties:
     *               password:
     *                 type: string
     *               email:
     *                 type: string
     *                 format: email
     *               name:
     *                 type: string
     *               birthDate:
     *                 type: string
     *                 format: date
     *               roleId:
     *                 type: integer
     *               phoneNumber:
     *                 type: string
     *                 nullable: true
     *               schoolId:
     *                 type: integer
     *                 nullable: true
     *               academicGradeId:
     *                 type: integer
     *                 nullable: true
     *     responses:
     *       201:
     *         description: User created successfully
     *       400:
     *         description: Validation error
     */
    router.post("/register", controller.register);

    return router;
  }
}
