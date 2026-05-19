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

    router.post("/login", controller.login);
    router.post("/register", controller.register);

    return router;
  }
}
