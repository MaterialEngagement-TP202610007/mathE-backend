import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { GetDatasetUseCase } from "../../domain/use-cases/ml-dataset/get-dataset.use-case.js";
import { GetDatasetEntryUseCase } from "../../domain/use-cases/ml-dataset/get-dataset-entry.use-case.js";

export class MLDatasetController {
  constructor(
    private readonly getDatasetUseCase: GetDatasetUseCase,
    private readonly getDatasetEntryUseCase: GetDatasetEntryUseCase,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    return PaginationDto.create(page, limit);
  }

  listAll = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const studentId = req.query.studentId
      ? Number(req.query.studentId)
      : undefined;
    const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
    const schoolId = req.query.schoolId
      ? Number(req.query.schoolId)
      : undefined;
    const labelSource = req.query.labelSource as string | undefined;
    const includedRaw = req.query.includedInTraining;
    const includedInTraining =
      includedRaw === "true"
        ? true
        : includedRaw === "false"
          ? false
          : undefined;

    try {
      const result = await this.getDatasetUseCase.execute(pagination!, {
        studentId: studentId !== undefined && !isNaN(studentId) ? studentId : undefined,
        gradeId: gradeId !== undefined && !isNaN(gradeId) ? gradeId : undefined,
        schoolId: schoolId !== undefined && !isNaN(schoolId) ? schoolId : undefined,
        labelSource,
        includedInTraining,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ error: "Invalid dataset entry id" });

    try {
      const entry = await this.getDatasetEntryUseCase.execute(id);
      res.json(entry);
    } catch (err) {
      next(err);
    }
  };
}
