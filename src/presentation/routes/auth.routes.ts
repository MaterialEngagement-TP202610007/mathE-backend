import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { LoginUserUseCase } from "../../domain/use-cases/auth/login-user.use-case.js";
import { RegisterUserUseCase } from "../../domain/use-cases/auth/register-user.use-case.js";
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
    );

    /**
     * @openapi
     * /api/auth/login:
     *   post:
     *     tags: [Auth]
     *     summary: Authenticate a user and return a JWT
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
     *         description: Authenticated — returns user and token
     *       400:
     *         description: Validation error
     *       401:
     *         description: Invalid credentials
     */
    router.post("/login", controller.login);

    /**
     * @openapi
     * /api/auth/register:
     *   post:
     *     tags: [Auth]
     *     summary: Register a new user
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [username, password, email, name, roleId]
     *             properties:
     *               username:
     *                 type: string
     *               password:
     *                 type: string
     *               email:
     *                 type: string
     *                 format: email
     *               name:
     *                 type: string
     *               roleId:
     *                 type: integer
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
