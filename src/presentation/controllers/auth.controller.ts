import { CookieOptions, NextFunction, Request, Response } from "express";
import { LoginUserDto } from "../../domain/dtos/auth/login-user.dto.js";
import { RegisterUserDto } from "../../domain/dtos/auth/register-user.dto.js";
import { LoginUserUseCase } from "../../domain/use-cases/auth/login-user.use-case.js";
import { RegisterUserUseCase } from "../../domain/use-cases/auth/register-user.use-case.js";
import { GetCurrentUserUseCase } from "../../domain/use-cases/auth/get-current-user.use-case.js";
import { UserEntity } from "../../domain/entities/user.entity.js";

const AUTH_COOKIE = "auth_token";

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

export class AuthController {
  constructor(
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
  ) {}

  private toPublicUser(user: UserEntity) {
    const { password, schoolId, schoolName, ...rest } = user;
    return {
      ...rest,
      school: schoolId ? { id: schoolId, name: schoolName ?? null } : null,
    };
  }

  login = async (req: Request, res: Response, next: NextFunction) => {
    const [error, dto] = LoginUserDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const { user, token } = await this.loginUserUseCase.execute(dto!);

      res.cookie(AUTH_COOKIE, token, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: 604800 * 1000, // 7 days
      });

      res.json({ user: this.toPublicUser(user) });
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
      res.json({ user: this.toPublicUser(user) });
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
