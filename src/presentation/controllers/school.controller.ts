import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { ListSchoolsUseCase } from "../../domain/use-cases/school/list-schools.use-case.js";
import { GetSchoolUseCase } from "../../domain/use-cases/school/get-school.use-case.js";

export class SchoolController {
  constructor(
    private readonly listSchoolsUseCase: ListSchoolsUseCase,
    private readonly getSchoolUseCase: GetSchoolUseCase,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    return PaginationDto.create(page, limit);
  }

  listAll = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    try {
      const result = await this.listSchoolsUseCase.execute(pagination!, {
        search,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid school id" });

    try {
      const school = await this.getSchoolUseCase.execute(id);
      res.json(school);
    } catch (err) {
      next(err);
    }
  };
}
