import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { ListUsersDto } from "../../domain/dtos/user/list-users.dto.js";
import { UpdateUserDto } from "../../domain/dtos/user/update-user.dto.js";
import { GetUsersUseCase } from "../../domain/use-cases/user/get-users.use-case.js";
import { GetStudentsUseCase } from "../../domain/use-cases/user/get-students.use-case.js";
import { GetTeachersUseCase } from "../../domain/use-cases/user/get-teachers.use-case.js";
import { GetStudentsBySchoolUseCase } from "../../domain/use-cases/user/get-students-by-school.use-case.js";
import { GetUserByIdUseCase } from "../../domain/use-cases/user/get-user-by-id.use-case.js";
import { UpdateUserProfileUseCase } from "../../domain/use-cases/user/update-user-profile.use-case.js";
import { DeleteUserUseCase } from "../../domain/use-cases/user/delete-user.use-case.js";
import { ActivateUserUseCase } from "../../domain/use-cases/user/activate-user.use-case.js";

export class UserController {
  constructor(
    private readonly getUsersUseCase: GetUsersUseCase,
    private readonly getStudentsUseCase: GetStudentsUseCase,
    private readonly getTeachersUseCase: GetTeachersUseCase,
    private readonly getStudentsBySchoolUseCase: GetStudentsBySchoolUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly activateUserUseCase: ActivateUserUseCase,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    return PaginationDto.create(page, limit);
  }

  private parseFilters(req: Request): [string?, ListUsersDto?] {
    return ListUsersDto.create(req.query as Record<string, any>);
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const [filterError, filters] = this.parseFilters(req);
    if (filterError) return res.status(400).json({ error: filterError });

    try {
      const result = await this.getUsersUseCase.execute(pagination!, filters);
      res.json({ ...result, items: result.items });
    } catch (err) {
      next(err);
    }
  };

  getStudents = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const [filterError, filters] = this.parseFilters(req);
    if (filterError) return res.status(400).json({ error: filterError });

    try {
      const result = await this.getStudentsUseCase.execute(pagination!, filters);
      res.json({ ...result, items: result.items });
    } catch (err) {
      next(err);
    }
  };

  getTeachers = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const [filterError, filters] = this.parseFilters(req);
    if (filterError) return res.status(400).json({ error: filterError });

    try {
      const result = await this.getTeachersUseCase.execute(pagination!, filters);
      res.json({ ...result, items: result.items });
    } catch (err) {
      next(err);
    }
  };

  getStudentsBySchool = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const schoolId = Number(req.params.schoolId);
    if (isNaN(schoolId)) {
      return res.status(400).json({ error: "Invalid School Id" });
    }

    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const [filterError, filters] = this.parseFilters(req);
    if (filterError) return res.status(400).json({ error: filterError });

    try {
      const result = await this.getStudentsBySchoolUseCase.execute(
        schoolId,
        pagination!,
        filters,
      );
      res.json({ ...result, items: result.items });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid User Id" });

    try {
      const user = await this.getUserByIdUseCase.execute(id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid User Id" });

    const [error, dto] = UpdateUserDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const user = await this.updateUserProfileUseCase.execute(id, dto!);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid User Id" });

    try {
      const user = await this.deleteUserUseCase.execute(
        id,
        req.user?.roleId ?? undefined,
      );
      res.json({ message: "User deleted", user });
    } catch (err) {
      next(err);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid User Id" });

    try {
      const user = await this.activateUserUseCase.execute(
        id,
        req.user?.roleId ?? undefined,
      );
      res.json({ message: "User activated", user });
    } catch (err) {
      next(err);
    }
  };
}
