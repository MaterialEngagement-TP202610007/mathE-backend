import { NextFunction, Request, Response } from "express";
import { LoginUserDto } from "../../domain/dtos/auth/login-user.dto.js";
import { RegisterUserDto } from "../../domain/dtos/auth/register-user.dto.js";
import { LoginUserUseCase } from "../../domain/use-cases/auth/login-user.use-case.js";
import { RegisterUserUseCase } from "../../domain/use-cases/auth/register-user.use-case.js";

export class AuthController {
  constructor(
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly registerUserUseCase: RegisterUserUseCase,
  ) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    const [error, dto] = LoginUserDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const { user, token } = await this.loginUserUseCase.execute(dto!);
      // quitamos el password del usuario para que no se envie al cliente en el response
      const { password, ...publicUser } = user;
      res.json({ user: publicUser, token });
    } catch (err) {
      next(err);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    const [error, dto] = RegisterUserDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      await this.registerUserUseCase.execute(dto!);
      res.status(201).json({ message: "User created successfully" });
    } catch (err) {
      next(err);
    }
  };
}
